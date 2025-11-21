const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const ip = require('ip');
const { getMediaList, MEDIA_ROOT } = require('./scanner');

const app = express();
const PORT = 3000;

app.use(cors());
app.use(express.json());
// Serve media files (images/videos) statically
app.use('/media', express.static(MEDIA_ROOT));

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

// API to stream video
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
            'Content-Type': 'video/mp4', // Simplified, ideally detect mime type
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
