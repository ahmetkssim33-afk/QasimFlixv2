const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const multer = require("multer");
const path = require("path");
const fs = require("fs");

require('dotenv').config();

const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const JWT_SECRET = process.env.JWT_SECRET || 'dev_jwt_secret_change_me';
const nodemailer = require('nodemailer');

const app = express();
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// ═══════════════════════════════════════════════════════════
// UPLOADS — Multer config
// ═══════════════════════════════════════════════════════════
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadsDir),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const name = Date.now() + '-' + Math.round(Math.random() * 1e6) + ext;
    cb(null, name);
  }
});
const upload = multer({
  storage,
  limits: { fileSize: 20 * 1024 * 1024 }, // 20 MB
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) cb(null, true);
    else cb(new Error('Sadece görsel dosyaları kabul edilir'));
  }
});

// Serve uploaded files
app.use('/uploads', express.static(uploadsDir));
// Use shared DB connector and centralized models
const { connectDB } = require('./lib/db');
const { Series, Season, Episode, WatchProgress, Category, Film, User } = require('./lib/models');

// Helper: try to extract user id from Authorization header (Bearer token)
function getUserIdFromReq(req) {
  try {
    const auth = req.headers && req.headers.authorization;
    if (!auth) return null;
    const parts = auth.split(' ');
    if (parts.length !== 2) return null;
    const payload = jwt.verify(parts[1], JWT_SECRET);
    return payload && (payload.id || payload._id || payload.userId) ? String(payload.id || payload._id || payload.userId) : null;
  } catch (e) {
    return null;
  }
}

// Email helper for password reset
async function sendResetEmail(toEmail, token) {
  try {
    const appUrl = process.env.APP_URL || `http://localhost:${process.env.PORT || 3000}`;
    const resetLink = `${String(appUrl).replace(/\/$/, '')}/auth?resetToken=${token}`;
    if (process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS) {
      const transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: parseInt(process.env.SMTP_PORT || '587', 10),
        secure: process.env.SMTP_SECURE === 'true',
        auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
      });
      const info = await transporter.sendMail({
        from: process.env.EMAIL_FROM || process.env.SMTP_USER,
        to: toEmail,
        subject: 'Şifre sıfırlama isteği',
        html: `<p>Şifre sıfırlama isteği alındı. Bu bağlantı 1 saat geçerlidir:</p><p><a href="${resetLink}">${resetLink}</a></p>`
      });
      console.log('Reset email sent:', info.messageId);
    } else {
      // No SMTP configured — fallback to logging the link for developer testing
      console.log('Reset link (no SMTP configured):', resetLink);
    }
    return resetLink;
  } catch (err) {
    console.error('Failed to send reset email:', err);
    return null;
  }
}


// ═══════════════════════════════════════════════════════════
// INITIALIZE DEFAULT CATEGORIES
// ═══════════════════════════════════════════════════════════
const defaultCategories = [
  'Action', 'Comedy', 'Drama', 'Horror', 'Thriller', 
  'Romance', 'Sci-Fi', 'Fantasy', 'Documentary', 'Animation'
];

async function initializeCategories() {
  for (const cat of defaultCategories) {
    await Category.updateOne(
      { name: cat },
      { $setOnInsert: { name: cat } },
      { upsert: true }
    );
  }
}

// ═══════════════════════════════════════════════════════════
// API ENDPOINTS - CATEGORIES
// ═══════════════════════════════════════════════════════════

app.get('/api/categories', async (req, res) => {
  try {
    const categories = await Category.find().sort({ name: 1 });
    res.json(categories);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ═══════════════════════════════════════════════════════════
// API ENDPOINTS - SERIES
// ═══════════════════════════════════════════════════════════

// Get all series (with pagination)
app.get('/api/series', async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = 12;
    const skip = (page - 1) * limit;

    const series = await Series.find()
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const total = await Series.countDocuments();

    res.json({
      series,
      total,
      pages: Math.ceil(total / limit),
      currentPage: page
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Search series
app.get('/api/series/search/:query', async (req, res) => {
  try {
    const query = req.params.query;
    const results = await Series.find({
      $or: [
        { title: { $regex: query, $options: 'i' } },
        { description: { $regex: query, $options: 'i' } }
      ]
    }).limit(20);
    res.json(results);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get series by category
app.get('/api/series/category/:category', async (req, res) => {
  try {
    const series = await Series.find({
      categories: req.params.category
    }).limit(20);
    res.json(series);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get single series with all seasons and episodes
app.get('/api/series/:id', async (req, res) => {
  try {
    const series = await Series.findById(req.params.id);
    if (!series) return res.status(404).json({ error: 'Series not found' });

    const seasons = await Season.find({ seriesId: series._id })
      .sort({ seasonNumber: 1 });

    const seasonsWithEpisodes = await Promise.all(
      seasons.map(async (season) => ({
        ...season.toObject(),
        episodes: await Episode.find({ seasonId: season._id })
          .sort({ episodeNumber: 1 })
      }))
    );

    res.json({
      ...series.toObject(),
      seasons: seasonsWithEpisodes
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Create series (Admin)
app.post('/api/series', async (req, res) => {
  try {
    const { title, description, poster, categories, releaseYear, type } = req.body;

    const newSeries = new Series({
      title,
      description,
      poster,
      categories,
      releaseYear,
      type: type || 'series'
    });

    const saved = await newSeries.save();
    res.status(201).json(saved);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Update series (Admin)
app.put('/api/series/:id', async (req, res) => {
  try {
    const updated = await Series.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true }
    );
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Delete series (Admin)
app.delete('/api/series/:id', async (req, res) => {
  try {
    await Series.findByIdAndDelete(req.params.id);
    await Season.deleteMany({ seriesId: req.params.id });
    await Episode.deleteMany({ seriesId: req.params.id });
    res.json({ message: 'Series deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ═══════════════════════════════════════════════════════════
// API ENDPOINTS - SEASONS
// ═══════════════════════════════════════════════════════════

// Get seasons of a series
app.get('/api/seasons/:seriesId', async (req, res) => {
  try {
    const seasons = await Season.find({ seriesId: req.params.seriesId })
      .sort({ seasonNumber: 1 });
    res.json(seasons);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Create season (Admin)
app.post('/api/seasons', async (req, res) => {
  try {
    const { seriesId, seasonNumber, title, description, releaseDate } = req.body;

    // Check if season already exists
    const exists = await Season.findOne({ seriesId, seasonNumber });
    if (exists) {
      return res.status(400).json({ error: 'Season already exists' });
    }

    const newSeason = new Season({
      seriesId,
      seasonNumber,
      title,
      description,
      releaseDate
    });

    const saved = await newSeason.save();
    res.status(201).json(saved);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Update season (Admin)
app.put('/api/seasons/:id', async (req, res) => {
  try {
    const updated = await Season.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true }
    );
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Delete season (Admin)
app.delete('/api/seasons/:id', async (req, res) => {
  try {
    const season = await Season.findById(req.params.id);
    if (!season) return res.status(404).json({ error: 'Season not found' });

    await Episode.deleteMany({ seasonId: req.params.id });
    await Season.findByIdAndDelete(req.params.id);

    res.json({ message: 'Season deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ═══════════════════════════════════════════════════════════
// API ENDPOINTS - EPISODES
// ═══════════════════════════════════════════════════════════

// Get episodes of a season
app.get('/api/episodes/season/:seasonId', async (req, res) => {
  try {
    const episodes = await Episode.find({ seasonId: req.params.seasonId })
      .sort({ episodeNumber: 1 });
    res.json(episodes);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get single episode — tekil form (app.js /api/episode/:id olarak çağırıyor)
app.get('/api/episode/:id', async (req, res) => {
  try {
    const episode = await Episode.findById(req.params.id);
    if (!episode) return res.status(404).json({ error: 'Bölüm bulunamadı' });
    res.json(episode);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get single episode — çoğul form (geriye dönük uyumluluk)
app.get('/api/episodes/:id', async (req, res) => {
  try {
    const episode = await Episode.findById(req.params.id);
    if (!episode) return res.status(404).json({ error: 'Episode not found' });
    res.json(episode);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Create episode (Admin)
app.post('/api/episodes', async (req, res) => {
  try {
    const {
      seasonId,
      seriesId,
      episodeNumber,
      title,
      description,
      videoUrl,
      duration,
      thumbnail
    } = req.body;

    const newEpisode = new Episode({
      seasonId,
      seriesId,
      episodeNumber,
      title,
      description,
      videoUrl,
      duration,
      thumbnail,
      subtitles: []
    });

    const saved = await newEpisode.save();
    res.status(201).json(saved);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Add subtitle to episode (Admin)
app.post('/api/episodes/:id/subtitle', async (req, res) => {
  try {
    const { language, vttContent } = req.body;

    const episode = await Episode.findById(req.params.id);
    if (!episode) return res.status(404).json({ error: 'Episode not found' });

    // Remove existing subtitle in same language
    episode.subtitles = episode.subtitles.filter(s => s.language !== language);

    // Add new subtitle
    episode.subtitles.push({ language, vttContent });

    const updated = await episode.save();
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Update episode (Admin)
app.put('/api/episodes/:id', async (req, res) => {
  try {
    const updated = await Episode.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true }
    );
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Delete episode (Admin)
app.delete('/api/episodes/:id', async (req, res) => {
  try {
    await Episode.findByIdAndDelete(req.params.id);
    res.json({ message: 'Episode deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ═══════════════════════════════════════════════════════════
// API ENDPOINTS - WATCH PROGRESS
// ═══════════════════════════════════════════════════════════

// Save watch progress - accepts `userId` in body OR Bearer token in Authorization header
app.post('/api/progress', async (req, res) => {
  try {
    let { userId, seriesId, episodeId, progress } = req.body;
    const headerUser = getUserIdFromReq(req);
    if (headerUser) userId = headerUser;

    if (!userId) return res.status(400).json({ error: 'userId missing' });

    const updated = await WatchProgress.findOneAndUpdate(
      { userId, episodeId },
      { userId, seriesId, episodeId, progress, lastWatchedAt: new Date() },
      { upsert: true, new: true }
    );

    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get watch progress for episode (by explicit userId)
app.get('/api/progress/:userId/:episodeId', async (req, res) => {
  try {
    const progress = await WatchProgress.findOne({
      userId: req.params.userId,
      episodeId: req.params.episodeId
    });
    res.json(progress || { progress: 0 });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get watch progress for currently authenticated user (uses Bearer token)
app.get('/api/progress/me/:episodeId', async (req, res) => {
  try {
    const userId = getUserIdFromReq(req);
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });
    const progress = await WatchProgress.findOne({ userId, episodeId: req.params.episodeId });
    res.json(progress || { progress: 0 });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get continue watching (recent series) for explicit userId
app.get('/api/progress/continue/:userId', async (req, res) => {
  try {
    const recentWatches = await WatchProgress.find({ userId: req.params.userId })
      .sort({ lastWatchedAt: -1 })
      .limit(10)
      .populate('seriesId');

    res.json(recentWatches);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get continue watching for authenticated user (Bearer token)
app.get('/api/progress/continue/me', async (req, res) => {
  try {
    const userId = getUserIdFromReq(req);
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });
    const recentWatches = await WatchProgress.find({ userId })
      .sort({ lastWatchedAt: -1 })
      .limit(10)
      .populate('seriesId');
    res.json(recentWatches);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ═══════════════════════════════════════════════════════════
// AUTH & USER-SAVED ENDPOINTS
// ═══════════════════════════════════════════════════════════

// Register
app.post('/api/auth/register', async (req, res) => {
  try {
    const { email, password, name, username, passwordConfirm } = req.body;
    const displayName = name || username || '';
    if (!email || !password) return res.status(400).json({ error: 'Email and password required', message: 'Email and password required' });
    if (passwordConfirm && password !== passwordConfirm) return res.status(400).json({ error: 'Passwords do not match', message: 'Şifreler eşleşmiyor' });
    if (password.length < 6) return res.status(400).json({ error: 'Password too short', message: 'Şifre en az 6 karakter olmalıdır' });
    const exists = await User.findOne({ email });
    if (exists) return res.status(400).json({ error: 'Email already registered', message: 'Bu e-posta zaten kayıtlı' });
    const hash = await bcrypt.hash(password, 10);
    const user = new User({ email, passwordHash: hash, name: displayName });
    await user.save();
    const token = jwt.sign({ id: user._id, email: user.email }, JWT_SECRET, { expiresIn: '30d' });
    res.json({ token, user: { _id: user._id, email: user.email, name: user.name } });
  } catch (err) {
    res.status(500).json({ error: err.message, message: err.message });
  }
});

// Login
app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'Email and password required', message: 'Email and password required' });
    const user = await User.findOne({ email });
    if (!user) return res.status(401).json({ error: 'Invalid credentials', message: 'Invalid credentials' });
    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) return res.status(401).json({ error: 'Invalid credentials', message: 'Invalid credentials' });
    const token = jwt.sign({ id: user._id, email: user.email }, JWT_SECRET, { expiresIn: '30d' });
    res.json({ token, user: { _id: user._id, email: user.email, name: user.name } });
  } catch (err) {
    res.status(500).json({ error: err.message, message: err.message });
  }
});

// Forgot password (simulated)
app.post('/api/auth/forgot-password', async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: 'Email required', message: 'E-posta gerekli' });
    const user = await User.findOne({ email });
    if (user) {
      const token = jwt.sign({ id: user._id, action: 'reset' }, JWT_SECRET, { expiresIn: '1h' });
      // Send reset email if possible (falls back to console.log)
      await sendResetEmail(email, token);
    }
    res.json({ message: 'Eğer e-posta kayıtlıysa sıfırlama bağlantısı gönderildi' });
  } catch (err) {
    res.status(500).json({ error: err.message, message: err.message });
  }
});

// Reset password using token
app.post('/api/auth/reset-password', async (req, res) => {
  try {
    const { token, password, passwordConfirm } = req.body;
    if (!token || !password) return res.status(400).json({ error: 'token and password required', message: 'Token ve şifre gerekli' });
    if (passwordConfirm && password !== passwordConfirm) return res.status(400).json({ error: 'Passwords do not match', message: 'Şifreler eşleşmiyor' });
    if (password.length < 6) return res.status(400).json({ error: 'Password too short', message: 'Şifre en az 6 karakter olmalıdır' });
    let payload;
    try { payload = jwt.verify(token, JWT_SECRET); } catch (e) { return res.status(400).json({ error: 'Invalid or expired token', message: 'Geçersiz veya süresi dolmuş token' }); }
    const user = await User.findById(payload.id);
    if (!user) return res.status(404).json({ error: 'User not found', message: 'Kullanıcı bulunamadı' });
    user.passwordHash = await bcrypt.hash(password, 10);
    await user.save();
    res.json({ message: 'Şifre başarıyla yenilendi' });
  } catch (err) {
    res.status(500).json({ error: err.message, message: err.message });
  }
});

// Me
app.get('/api/auth/me', async (req, res) => {
  try {
    const userId = getUserIdFromReq(req);
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });
    const user = await User.findById(userId).select('-passwordHash');
    res.json(user);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get saved items for user
app.get('/api/user/saved', async (req, res) => {
  try {
    const userId = getUserIdFromReq(req);
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });
    const user = await User.findById(userId).populate('savedSeries').populate('savedFilms');
    res.json({ savedSeries: user.savedSeries || [], savedFilms: user.savedFilms || [] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Add saved item (type: 'series' or 'film')
app.post('/api/user/saved', async (req, res) => {
  try {
    const userId = getUserIdFromReq(req);
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });
    const { type, itemId } = req.body;
    if (!type || !itemId) return res.status(400).json({ error: 'type and itemId required' });
    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ error: 'User not found' });
    if (type === 'series') {
      if (!user.savedSeries.includes(itemId)) user.savedSeries.push(itemId);
    } else if (type === 'film') {
      if (!user.savedFilms.includes(itemId)) user.savedFilms.push(itemId);
    }
    await user.save();
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Remove saved item
app.delete('/api/user/saved', async (req, res) => {
  try {
    const userId = getUserIdFromReq(req);
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });
    const { type, itemId } = req.body;
    if (!type || !itemId) return res.status(400).json({ error: 'type and itemId required' });
    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ error: 'User not found' });
    if (type === 'series') user.savedSeries = user.savedSeries.filter(id => String(id) !== String(itemId));
    else if (type === 'film') user.savedFilms = user.savedFilms.filter(id => String(id) !== String(itemId));
    await user.save();
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ═══════════════════════════════════════════════════════════
// UPLOAD ENDPOINT
// ═══════════════════════════════════════════════════════════

app.post('/api/upload', upload.single('image'), (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'Dosya seçilmedi' });
    const filePath = '/uploads/' + req.file.filename;
    res.json({ ok: true, path: filePath });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ═══════════════════════════════════════════════════════════
// STATIC & SERVE — root dizininden serve et (public/ değil)
// ═══════════════════════════════════════════════════════════
app.use(express.static(path.join(__dirname)));
app.get('/admin', (req, res) => res.sendFile(path.join(__dirname, 'admin.html')));
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'index.html')));
app.get('/auth', (req, res) => res.sendFile(path.join(__dirname, 'auth.html')));

// ═══════════════════════════════════════════════════════════
// START SERVER — önce DB'ye bağlan ve kategorileri başlat
// ═══════════════════════════════════════════════════════════
const PORT = process.env.PORT || 3000;
(async () => {
  try {
    await connectDB();
    await initializeCategories();
    app.listen(PORT, () => {
      console.log(`\n🎬 Streaming Platform Server Running on http://localhost:${PORT}`);
      console.log(`📝 Admin Panel: http://localhost:${PORT}/admin.html`);
      console.log(`🎭 Frontend: http://localhost:${PORT}/index.html\n`);
    });
  } catch (err) {
    console.error('Sunucu başlatılırken hata:', err);
    process.exit(1);
  }
})();

// Kategori ekle (Admin)
app.post('/kategori-ekle', async (req, res) => {
  try {
    const { name, types } = req.body;
    const c = new Category({ name, types });
    await c.save();
    res.json({ ok: true, c });
  } catch (e) {
    res.status(400).json({ ok: false, error: e.message });
  }
});

// Kategorileri getir
app.get('/kategoriler', async (req, res) => {
  const cats = await Category.find().sort({ name: 1 });
  res.json(cats);
});

// İçerik ekle (film/dizi/anime)
app.post('/icerik-ekle', async (req, res) => {
  try{
    const { ad, type, kategori, video, thumb } = req.body;
    const film = new Film({ ad, type, kategori, video, thumb });
    await film.save();
    res.json({ ok: true, film });
  }catch(e){
    res.status(400).json({ ok: false, error: e.message });
  }
});

// Tüm içerikler veya tip/kategori bazlı filtre
app.get('/icerikler', async (req, res) => {
  const q = {};
  if (req.query.type) q.type = req.query.type;
  if (req.query.kategori) q.kategori = req.query.kategori;
  const items = await Film.find(q).sort({ ad: 1 });
  res.json(items);
});

// Kategoriye göre içerikler (opsiyonel tip param)
app.get('/kategori/:name', async (req, res) => {
  const query = { kategori: req.params.name };
  if (req.query.type) query.type = req.query.type;
  const data = await Film.find(query);
  res.json(data);
});

// İçerik sil
app.delete('/icerik/:id', async (req, res) => {
  try{
    await Film.findByIdAndDelete(req.params.id);
    res.json({ ok: true });
  }catch(e){ res.status(400).json({ ok: false, error: e.message }); }
});

// Puan verme (uyumluluk için bırakıldı)
app.post('/puan', async (req, res) => {
  const { id, puan } = req.body;
  try{
    await Film.findByIdAndUpdate(id, { puan });
    res.send('Puan verildi');
  }catch(e){ res.status(400).send('Hata'); }
});

// Eski endpoint (geri uyumluluk)
app.get('/filmler', async (req, res) => {
  const filmler = await Film.find();
  res.json(filmler);
});

// Duplicate listener removed (one listener is started earlier with `PORT`)
