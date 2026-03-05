require('dotenv').config();
const express    = require('express');
const cors       = require('cors');
const path       = require('path');
const fs         = require('fs');

const authRoutes  = require('./routes/auth');
const songRoutes  = require('./routes/songs');
const adminRoutes = require('./routes/admin');

const app  = express();
const PORT = process.env.PORT || 5000;

// ── Ensure uploads folder exists ──
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir);

const dbPath = path.join(__dirname, 'db.json');
if (!fs.existsSync(dbPath)) {
  fs.writeFileSync(dbPath, JSON.stringify({ songs: [] }));
}

// ── Middleware ──
app.use(cors({
  origin: '*',
  credentials: false,
}));
app.use(express.json());

// ── Static: serve uploaded audio files ──
app.use('/uploads', express.static(uploadsDir));

// ── Serve Admin Panel HTML ──
app.use('/admin', express.static(path.join(__dirname, 'admin')));

// ── Routes ──
app.use('/api/auth',  authRoutes);
app.use('/api/songs', songRoutes);
app.use('/api/admin', adminRoutes);

// ── Health check ──
app.get('/', (req, res) => {
  res.json({ message: '🎵 Melodia Backend is running!', status: 'ok' });
});

// ── Start ──
app.listen(PORT, '0.0.0.0', () => {
  console.log(`\n🎵 Melodia Backend running at http://localhost:${PORT}`);
  console.log(`🔐 Admin Panel at        http://localhost:${PORT}/admin`);
  console.log(`🎧 Songs API at          http://localhost:${PORT}/api/songs\n`);
});
