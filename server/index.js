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

// Set ffprobe path
const ffprobePath = require('ffprobe-static').path;
ffmpeg.setFfprobePath(ffprobePath);

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

// API to get media metadata (audio/subtitle tracks)
app.get('/api/metadata', (req, res) => {
    const videoId = req.query.id;
    if (!videoId) return res.status(400).send('Missing video ID');

    const safePath = path.normalize(videoId).replace(/^(\.\.[\/\\])+/, '');
    const filePath = path.join(MEDIA_ROOT, safePath);

    if (!fs.existsSync(filePath)) return res.status(404).send('File not found');

    ffmpeg.ffprobe(filePath, (err, metadata) => {
        if (err) {
            console.error('FFprobe error:', err);
            return res.status(500).send('Failed to probe file');
        }

        const audioStreams = metadata.streams
            .filter(s => s.codec_type === 'audio')
            .map((s, index) => ({
                index: s.index, // Global index
                streamIndex: index, // Relative audio index
                language: s.tags?.language || 'unknown',
                title: s.tags?.title || `Audio ${index + 1}`,
                codec: s.codec_name
            }));

        const subtitleStreams = metadata.streams
            .filter(s => s.codec_type === 'subtitle')
            .map((s, index) => ({
                index: s.index, // Global index
                streamIndex: index, // Relative subtitle index
                language: s.tags?.language || 'unknown',
                title: s.tags?.title || `Subtitle ${index + 1}`,
                codec: s.codec_name
            }));

        res.json({ audio: audioStreams, subtitles: subtitleStreams });
    });
});

// API to stream video (HLS or Native)
app.get('/api/stream', (req, res) => {
    const videoId = req.query.id;
    const audioStreamIndex = req.query.audioStream; // This should be the global stream index
    const subtitleStreamIndex = req.query.subtitleStream; // This should be the global stream index

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
        // Create a unique session ID based on the file path AND selected tracks
        // We use base64 of the path + tracks to be safe and unique per selection
        const sessionKey = `${safePath}-${audioStreamIndex || 'def'}-${subtitleStreamIndex || 'none'}`;
        const sessionId = Buffer.from(sessionKey).toString('base64').replace(/=/g, '').replace(/\//g, '_').replace(/\+/g, '-');
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

        let inputOptions = [];
        let outputOptions = [
            '-preset ultrafast',
            '-tune zerolatency',
            '-g 48', // Keyframe interval (approx 2s at 24fps)
            '-sc_threshold 0',
            '-hls_time 10', // Segment duration
            '-hls_list_size 0', // Keep all segments
            '-hls_segment_filename', path.join(sessionDir, 'segment_%03d.ts'),
            '-f hls'
        ];

        // Construct complex filter for subtitles if selected
        let complexFilter = [];

        // Map video stream (usually 0:v:0, but we rely on ffmpeg auto-select for video, just being explicit if needed)
        // We always want the video.
        // For audio, if index provided, map it. Else default.

        const command = ffmpeg(filePath);

        // Audio Selection
        if (audioStreamIndex !== undefined && audioStreamIndex !== null) {
            command.outputOptions(['-map 0:' + audioStreamIndex]);
        } else {
            // Default behavior usually picks first audio, but let's be safe if we are mapping manually elsewhere
            // If we don't map explicitly, ffmpeg defaults.
        }

        // Subtitle Selection (Burning)
        if (subtitleStreamIndex !== undefined && subtitleStreamIndex !== null) {
            // We need to escape the path for the subtitles filter
            // On Windows, paths like C:\... need escaping. 
            // The safest way for 'subtitles' filter with a local file is often just using the filename if we are in the dir, 
            // but here we are not.
            // Documentation says: subtitles='filename':stream_index=...
            // We must escape colons and backslashes.

            // However, fluent-ffmpeg handles some simple cases.
            // Ideally we use the `subtitles` filter with `stream_index`.
            // Note: `subtitles=filename:si=index`

            // Escape path for Windows (replace \ with / or \\\\)
            // FFmpeg filter syntax is tricky with Windows paths.
            // Using forward slashes usually works best.
            const escapedPath = filePath.replace(/\\/g, '/').replace(/:/g, '\\\\:');

            // complexFilter.push(`subtitles='${escapedPath}':si=${subtitleStreamIndex}`);
            // Note: 'si' in subtitles filter is the index in the file's subtitle streams, NOT the global index?
            // Actually, `subtitles` filter `si` option refers to the index in the list of subtitles.
            // But we have global index from ffprobe. We might need to map global index to subtitle-only index.
            // Let's rely on the frontend passing the global index, but we might verify if filter needs relative.
            // It seems "si" does verify the stream index in the file.

            // Let's try simpler fluent-ffmpeg .videoFilters() approach
            // But we need to specify stream index.
            // vf: "subtitles='path':si=index"

            // Wait, we need to find the relative subtitle index for the filter if it requires it, 
            // OR we can just use the global index if supported?
            // The `subtitles` filter documentation says `stream_index` (si) is "index of the subtitle stream to render".
            // It usually expects the index among subtitle streams (0, 1, 2...), NOT the global stream index.
            // We need to confirm this.
            // The /api/metadata endpoint returns both. Let's pass the relative subtitle index from frontend for safe burning?
            // Actually, let's keep it robust: The frontend sends what `metadata.subtitles[i].streamIndex` gave it.
            // Let's assume `req.query.subtitleStream` IS the index we need for the filter.

            // IMPORTANT: If we are already mapping stream 0 for video, we just add the filter.

            // To be safe with path escaping in filters:
            const filterPath = filePath.replace(/\\/g, '/').replace(/:/g, '\\:');
            command.videoFilters(`subtitles='${filterPath}':si=${subtitleStreamIndex}`);
        }

        // Also we must ensure we map the video track (which is implicitly 0:v:0 usually)
        // If we used -map for audio, we MUST also use -map for video, otherwise it might be excluded?
        // FFmpeg behavior: if -map is used, only mapped streams are included.
        if (audioStreamIndex !== undefined && audioStreamIndex !== null) {
            // Re-add video map if we mapped audio
            command.outputOptions(['-map 0:v:0']);
        }

        command.outputOptions(outputOptions)
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
