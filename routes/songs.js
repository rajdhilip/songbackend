const express = require('express');
const fs      = require('fs');
const path    = require('path');
const router  = express.Router();

const DB_PATH      = path.join(__dirname, '../db.json');
const UPLOADS_DIR  = path.join(__dirname, '../uploads');

// ── Helper: read db ──
function readDB() {
  if (!fs.existsSync(DB_PATH)) return { songs: [] };
  return JSON.parse(fs.readFileSync(DB_PATH, 'utf-8'));
}

// ── GET /api/songs ── get all songs (public)
router.get('/', (req, res) => {
  const db = readDB();
  res.json({ songs: db.songs });
});

// ── GET /api/songs/:id ── get single song info
router.get('/:id', (req, res) => {
  const db   = readDB();
  const song = db.songs.find(s => s.id === req.params.id);
  if (!song) return res.status(404).json({ error: 'Song not found.' });
  res.json(song);
});

// ── GET /api/songs/stream/:id ── stream audio file
router.get('/stream/:id', (req, res) => {
  const db   = readDB();
  const song = db.songs.find(s => s.id === req.params.id);
  if (!song) return res.status(404).json({ error: 'Song not found.' });

  const filePath = path.join(UPLOADS_DIR, song.filename);
  if (!fs.existsSync(filePath)) return res.status(404).json({ error: 'File not found on server.' });

  const stat     = fs.statSync(filePath);
  const fileSize = stat.size;
  const range    = req.headers.range;

  if (range) {
    // ── Range request (seekable streaming) ──
    const parts = range.replace(/bytes=/, '').split('-');
    const start = parseInt(parts[0], 10);
    const end   = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
    const chunkSize = end - start + 1;

    const fileStream = fs.createReadStream(filePath, { start, end });
    res.writeHead(206, {
      'Content-Range':  `bytes ${start}-${end}/${fileSize}`,
      'Accept-Ranges':  'bytes',
      'Content-Length': chunkSize,
      'Content-Type':   song.mimetype || 'audio/mpeg',
    });
    fileStream.pipe(res);
  } else {
    // ── Full file ──
    res.writeHead(200, {
      'Content-Length': fileSize,
      'Content-Type':   song.mimetype || 'audio/mpeg',
    });
    fs.createReadStream(filePath).pipe(res);
  }
});

module.exports = router;
