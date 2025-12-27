const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const ip = require('ip');
const { getMediaList, MEDIA_ROOT } = require('./scanner');
const ffmpeg = require('fluent-ffmpeg');
const ffmpegPath = require('ffmpeg-static');

// Set ffmpeg path
ffmpeg.setFfmpegPath(ffmpegPath);

const app = express();
const PORT = 3000;
const TEMP_DIR = path.join(__dirname, 'temp');

// Ensure temp dir exists
if (!fs.existsSync(TEMP_DIR)) {
    fs.mkdirSync(TEMP_DIR);
}

// Clean temp dir on startup
fs.readdirSync(TEMP_DIR).forEach(file => {
    const filePath = path.join(TEMP_DIR, file);
    if (fs.lstatSync(filePath).isDirectory()) {
        fs.rmdirSync(filePath, { recursive: true });
    }
});

app.use(cors());
app.use(express.json());
// Serve media files (images/videos) statically
app.use('/media', express.static(MEDIA_ROOT));

// Active transcoding sessions
const activeSessions = {};

// API to get list of media
app.get('/api/media', (req, res) => {
    try {
        const media = getMediaList();
        res.json(media);
    } catch (error) {
        console.error('Error scanning media:', error);
        res.status(500).json({ error: 'Failed to scan media' });
    }
});

// API to stream video (HLS or Native)
app.get('/api/stream', (req, res) => {
    const videoId = req.query.id;
    if (!videoId) {
        return res.status(400).send('Missing video ID');
    }

    // Prevent directory traversal attacks
    const safePath = path.normalize(videoId).replace(/^(\.\.[\/\\])+/, '');
    const filePath = path.join(MEDIA_ROOT, safePath);

    if (!fs.existsSync(filePath)) {
        return res.status(404).send('File not found');
    }

    const ext = path.extname(filePath).toLowerCase();

    // Check if transcoding is needed (MKV, AVI, etc.)
    if (ext === '.mkv' || ext === '.avi') {
        // HLS Transcoding
        // Create a unique session ID based on the file path (simple hashing)
        // We use base64 of the path to be safe
        const sessionId = Buffer.from(safePath).toString('base64').replace(/=/g, '').replace(/\//g, '_').replace(/\+/g, '-');
        const sessionDir = path.join(TEMP_DIR, sessionId);
        const playlistPath = path.join(sessionDir, 'index.m3u8');

        // Check if session is already active
        if (activeSessions[sessionId]) {
            // If active, just return the playlist URL
            return res.json({ type: 'hls', url: `/api/hls/${sessionId}/index.m3u8` });
        }

        // Clean up any old files for this session if it crashed
        if (fs.existsSync(sessionDir)) {
            fs.rmdirSync(sessionDir, { recursive: true });
        }
        fs.mkdirSync(sessionDir);

        const logStream = fs.createWriteStream(path.join(__dirname, 'ffmpeg.log'), { flags: 'a' });
        const serverLog = (msg) => {
            const logMsg = `[${new Date().toISOString()}] ${msg}\n`;
            fs.appendFileSync(path.join(__dirname, 'server.log'), logMsg);
            console.log(msg);
        };

        serverLog(`Starting HLS transcoding for ${videoId} (Session: ${sessionId})`);

        const command = ffmpeg(filePath)
            .outputOptions([
                '-preset ultrafast',
                '-tune zerolatency',
                '-g 48', // Keyframe interval (approx 2s at 24fps)
                '-sc_threshold 0',
                '-hls_time 10', // Segment duration
                '-hls_list_size 0', // Keep all segments
                '-hls_segment_filename', path.join(sessionDir, 'segment_%03d.ts'),
                '-f hls'
            ])
            .output(playlistPath)
            .on('start', (commandLine) => {
                serverLog('Spawned Ffmpeg with command: ' + commandLine);
            })
            .on('stderr', (stderrLine) => {
                logStream.write(stderrLine + '\n');
            })
            .on('error', (err) => {
                if (err.message.includes('SIGKILL')) {
                    serverLog('Transcoding stopped (killed)');
                } else {
                    serverLog('Transcoding error: ' + err.message);
                }
                delete activeSessions[sessionId];
            })
            .on('end', () => {
                serverLog('Transcoding finished');
                delete activeSessions[sessionId];
            });

        command.run();
        activeSessions[sessionId] = command;

        // Wait for the playlist file to be created before returning
        const checkInterval = setInterval(() => {
            if (fs.existsSync(playlistPath)) {
                clearInterval(checkInterval);
                res.json({ type: 'hls', url: `/api/hls/${sessionId}/index.m3u8` });
            }
        }, 500);

        // Timeout after 30 seconds
        setTimeout(() => {
            clearInterval(checkInterval);
            if (!res.headersSent) {
                res.status(500).send('Timeout starting transcoding');
            }
        }, 30000);

    } else {
        // Native streaming for MP4, WebM
        // Return type 'native' and the direct URL
        // We can just redirect or return JSON. Returning JSON is cleaner for the client to handle switching.
        res.json({ type: 'native', url: `/api/stream/native?id=${encodeURIComponent(videoId)}` });
    }
});

// Endpoint for native streaming (moved from /api/stream)
app.get('/api/stream/native', (req, res) => {
    const videoId = req.query.id;
    if (!videoId) return res.status(400).send('Missing ID');

    const safePath = path.normalize(videoId).replace(/^(\.\.[\/\\])+/, '');
    const filePath = path.join(MEDIA_ROOT, safePath);

    if (!fs.existsSync(filePath)) return res.status(404).send('File not found');

    const stat = fs.statSync(filePath);
    const fileSize = stat.size;
    const range = req.headers.range;

    if (range) {
        const parts = range.replace(/bytes=/, "").split("-");
        const start = parseInt(parts[0], 10);
        const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
        const chunksize = (end - start) + 1;
        const file = fs.createReadStream(filePath, { start, end });
        const head = {
            'Content-Range': `bytes ${start}-${end}/${fileSize}`,
            'Accept-Ranges': 'bytes',
            'Content-Length': chunksize,
            'Content-Type': 'video/mp4',
        };
        res.writeHead(206, head);
        file.pipe(res);
    } else {
        const head = {
            'Content-Length': fileSize,
            'Content-Type': 'video/mp4',
        };
        res.writeHead(200, head);
        fs.createReadStream(filePath).pipe(res);
    }
});

// Serve HLS files
app.get('/api/hls/:sessionId/:file', (req, res) => {
    const { sessionId, file } = req.params;
    // Validate sessionId (alphanumeric + - _)
    if (!/^[a-zA-Z0-9\-_]+$/.test(sessionId)) {
        return res.status(400).send('Invalid session ID');
    }
    const filePath = path.join(TEMP_DIR, sessionId, file);

    if (fs.existsSync(filePath)) {
        res.sendFile(filePath);
    } else {
        res.status(404).send('File not found');
    }
});

// Serve static frontend (after build)
app.use(express.static(path.join(__dirname, '../client/dist')));

const WATCHED_FILE = path.join(__dirname, 'data/watched.json');

// API to get watched status
app.get('/api/watched', (req, res) => {
    if (fs.existsSync(WATCHED_FILE)) {
        res.sendFile(WATCHED_FILE);
    } else {
        res.json({});
    }
});

// API to update watched status
app.post('/api/watched', (req, res) => {
    const { id, status } = req.body;
    if (!id) return res.status(400).send('Missing ID');

    let watched = {};
    if (fs.existsSync(WATCHED_FILE)) {
        try {
            watched = JSON.parse(fs.readFileSync(WATCHED_FILE, 'utf8'));
        } catch (e) {
            console.error('Error reading watched file', e);
        }
    }

    watched[id] = status;

    try {
        fs.writeFileSync(WATCHED_FILE, JSON.stringify(watched, null, 2));
        res.json({ success: true });
    } catch (e) {
        console.error('Error writing watched file', e);
        res.status(500).send('Failed to save');
    }
});

// Fallback for SPA routing
app.get('*', (req, res) => {
    // Only serve index.html if it exists (i.e., frontend is built)
    const indexHtml = path.join(__dirname, '../client/dist/index.html');
    if (fs.existsSync(indexHtml)) {
        res.sendFile(indexHtml);
    } else {
        res.send('API Server Running. Frontend not built yet.');
    }
});

app.listen(PORT, '0.0.0.0', () => {
    const localIp = ip.address();
    console.log(`Server running on:`);
    console.log(`- Local:   http://localhost:${PORT}`);
    console.log(`- Network: http://${localIp}:${PORT}`);
});
