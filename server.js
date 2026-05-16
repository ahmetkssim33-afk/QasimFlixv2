const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const multer = require("multer");
const path = require("path");
const fs = require("fs");

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

// ═══════════════════════════════════════════════════════════
// DATABASE CONNECTION
// ═══════════════════════════════════════════════════════════
mongoose.connect("mongodb://127.0.0.1:27017/streamingDB")
  .then(() => console.log('✅ MongoDB Connected'))
  .catch(err => console.error('❌ MongoDB Error:', err));

// ═══════════════════════════════════════════════════════════
// SCHEMAS
// ═══════════════════════════════════════════════════════════

// SERIES SCHEMA
const seriesSchema = new mongoose.Schema({
  title: { type: String, required: true, unique: true },
  description: String,
  poster: String, // base64 or URL
  categories: [String],
  releaseYear: Number,
  rating: { type: Number, default: 0, min: 0, max: 10 },
  type: { type: String, enum: ['series', 'movie'], default: 'series' },
  createdAt: { type: Date, default: Date.now }
});

// SEASON SCHEMA
const seasonSchema = new mongoose.Schema({
  seriesId: { type: mongoose.Schema.Types.ObjectId, ref: 'Series', required: true },
  seasonNumber: { type: Number, required: true },
  title: String,
  description: String,
  releaseDate: Date,
  createdAt: { type: Date, default: Date.now }
});

// EPISODE SCHEMA
const episodeSchema = new mongoose.Schema({
  seasonId: { type: mongoose.Schema.Types.ObjectId, ref: 'Season', required: true },
  seriesId: { type: mongoose.Schema.Types.ObjectId, ref: 'Series', required: true },
  episodeNumber: { type: Number, required: true },
  title: { type: String, required: true },
  description: String,
  videoUrl: { type: String, required: true }, // URL to video
  subtitles: [{
    language: { type: String, default: 'TR' }, // TR, EN, etc.
    vttContent: String // .vtt file content
  }],
  duration: Number, // in seconds
  thumbnail: String,
  createdAt: { type: Date, default: Date.now }
});

// WATCH PROGRESS SCHEMA (for continue watching feature)
const watchProgressSchema = new mongoose.Schema({
  userId: String, // simple user ID (can be improved with auth)
  seriesId: { type: mongoose.Schema.Types.ObjectId, ref: 'Series' },
  episodeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Episode' },
  progress: Number, // in seconds
  lastWatchedAt: { type: Date, default: Date.now }
});

// CATEGORY SCHEMA
const categorySchema = new mongoose.Schema({
  name: { type: String, unique: true, required: true }
});

// ═══════════════════════════════════════════════════════════
// MODELS
// ═══════════════════════════════════════════════════════════
const Series = mongoose.model('Series', seriesSchema);
const Season = mongoose.model('Season', seasonSchema);
const Episode = mongoose.model('Episode', episodeSchema);
const WatchProgress = mongoose.model('WatchProgress', watchProgressSchema);
const Category = mongoose.model('Category', categorySchema);

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
initializeCategories();

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

// Get single episode
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

// Save watch progress
app.post('/api/progress', async (req, res) => {
  try {
    const { userId, seriesId, episodeId, progress } = req.body;

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

// Get watch progress for episode
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

// Get continue watching (recent series)
app.get('/api/progress/continue/:userId', async (req, res) => {
  try {
    const recentWatches = await WatchProgress.find({
      userId: req.params.userId
    })
      .sort({ lastWatchedAt: -1 })
      .limit(10)
      .populate('seriesId');

    res.json(recentWatches);
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

// ═══════════════════════════════════════════════════════════
// START SERVER
// ═══════════════════════════════════════════════════════════
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`\n🎬 Streaming Platform Server Running on http://localhost:${PORT}`);
  console.log(`📝 Admin Panel: http://localhost:${PORT}/admin.html`);
  console.log(`🎭 Frontend: http://localhost:${PORT}/index.html\n`);
});

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