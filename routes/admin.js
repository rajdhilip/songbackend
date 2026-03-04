const express     = require('express');
const multer      = require('multer');
const path        = require('path');
const fs          = require('fs');
// crypto built-in
const verifyToken = require('../middleware/verifyToken');
const router      = express.Router();

const DB_PATH     = path.join(__dirname, '../db.json');
const UPLOADS_DIR = path.join(__dirname, '../uploads');

// ── Helper: read/write db ──
function readDB()       { if (!fs.existsSync(DB_PATH)) return { songs: [] }; return JSON.parse(fs.readFileSync(DB_PATH, 'utf-8')); }
function writeDB(data)  { fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2)); }

// ── Multer config ──
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOADS_DIR),
  filename:    (req, file, cb) => {
    const unique = `${Date.now()}-${Math.round(Math.random() * 1e6)}`;
    cb(null, unique + path.extname(file.originalname));
  },
});

const fileFilter = (req, file, cb) => {
  const allowed = /audio\/(mpeg|wav|flac|ogg|aac|x-m4a|mp4)/;
  if (allowed.test(file.mimetype) || /\.(mp3|wav|flac|ogg|aac|m4a)$/i.test(file.originalname)) {
    cb(null, true);
  } else {
    cb(new Error('Only audio files are allowed!'), false);
  }
};

const upload = multer({ storage, fileFilter, limits: { fileSize: 50 * 1024 * 1024 } }); // 50MB

// ── POST /api/admin/upload ── upload a song (protected)
router.post('/upload', verifyToken, upload.single('song'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No audio file uploaded.' });

  const { title, artist, album } = req.body;
  const originalName = req.file.originalname.replace(/\.[^/.]+$/, '');

  // Auto-detect title/artist from filename if not provided
  const parts      = originalName.split(' - ');
  const autoArtist = parts.length > 1 ? parts[0].trim() : 'Unknown Artist';
  const autoTitle  = parts.length > 1 ? parts.slice(1).join(' - ').trim() : originalName.trim();

  const song = {
    id:        `song_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    title:     title  || autoTitle,
    artist:    artist || autoArtist,
    album:     album  || 'Unknown Album',
    filename:  req.file.filename,
    mimetype:  req.file.mimetype,
    size:      req.file.size,
    streamUrl: '',
    uploadedAt: new Date().toISOString(),
  };

  // Fix streamUrl now that we have the id
  song.streamUrl = `/api/songs/stream/${song.id}`;

  const db = readDB();
  db.songs.push(song);
  writeDB(db);

  res.status(201).json({ message: 'Song uploaded successfully!', song });
});

// ── DELETE /api/admin/songs/:id ── delete a song (protected)
router.delete('/songs/:id', verifyToken, (req, res) => {
  const db   = readDB();
  const idx  = db.songs.findIndex(s => s.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Song not found.' });

  const song     = db.songs[idx];
  const filePath = path.join(UPLOADS_DIR, song.filename);

  // Delete file from disk
  if (fs.existsSync(filePath)) fs.unlinkSync(filePath);

  // Remove from db
  db.songs.splice(idx, 1);
  writeDB(db);

  res.json({ message: 'Song deleted successfully!' });
});

// ── GET /api/admin/songs ── list all songs (protected)
router.get('/songs', verifyToken, (req, res) => {
  const db = readDB();
  res.json({ songs: db.songs, total: db.songs.length });
});

module.exports = router;
