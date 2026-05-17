// ═══════════════════════════════════════════════════════════
// api/index.js — Vercel Serverless Function
// ═══════════════════════════════════════════════════════════

const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");

const app = express();

// ───────────────────────────────────────────────────────────
// MIDDLEWARE
// ───────────────────────────────────────────────────────────
app.use(cors({
  origin: "*",
  methods: ["GET","POST","PUT","DELETE"],
  allowedHeaders: ["Content-Type"]
}));
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: true, limit: "50mb" }));

// ───────────────────────────────────────────────────────────
// VERİTABANI BAĞLANTISI
// ───────────────────────────────────────────────────────────
let isConnected = false;

async function connectDB() {
  if (isConnected) return;

  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error("❌ MONGODB_URI environment variable tanımlı değil!");
    return;
  }

  try {
    await mongoose.connect(uri, {
      bufferCommands: false,
      serverSelectionTimeoutMS: 5000,
    });
    isConnected = true;
    console.log("✅ MongoDB Atlas bağlantısı kuruldu");
  } catch (err) {
    console.error("❌ MongoDB bağlantı hatası:", err.message);
    isConnected = false;
  }
}

// ───────────────────────────────────────────────────────────
// SCHEMAS
// ───────────────────────────────────────────────────────────

const seriesSchema = new mongoose.Schema({
  title:       { type: String, required: true, unique: true },
  description: String,
  poster:      String,
  categories:  [String],
  releaseYear: Number,
  rating:      { type: Number, default: 0, min: 0, max: 10 },
  type:        { type: String, enum: ["series", "movie"], default: "series" },
  createdAt:   { type: Date, default: Date.now }
});

const seasonSchema = new mongoose.Schema({
  seriesId:     { type: mongoose.Schema.Types.ObjectId, ref: "Series", required: true },
  seasonNumber: { type: Number, required: true },
  title:        String,
  description:  String,
  releaseDate:  Date,
  createdAt:    { type: Date, default: Date.now }
});

const episodeSchema = new mongoose.Schema({
  seasonId:      { type: mongoose.Schema.Types.ObjectId, ref: "Season", required: true },
  seriesId:      { type: mongoose.Schema.Types.ObjectId, ref: "Series", required: true },
  episodeNumber: { type: Number, required: true },
  title:         { type: String, required: true },
  description:   String,
  videoUrl:      { type: String, required: true },
  subtitles: [{
    language:   { type: String, default: "TR" },
    vttContent: String
  }],
  duration:    Number,
  thumbnail:   String,
  createdAt:   { type: Date, default: Date.now }
});

const watchProgressSchema = new mongoose.Schema({
  userId:        { type: String, required: true },
  seriesId:      { type: mongoose.Schema.Types.ObjectId, ref: "Series" },
  episodeId:     { type: mongoose.Schema.Types.ObjectId, ref: "Episode" },
  progress:      Number,
  lastWatchedAt: { type: Date, default: Date.now }
});

const categorySchema = new mongoose.Schema({
  name: { type: String, unique: true, required: true }
});

// ───────────────────────────────────────────────────────────
// MODELS
// ───────────────────────────────────────────────────────────
const Series        = mongoose.models.Series        || mongoose.model("Series",        seriesSchema);
const Season        = mongoose.models.Season        || mongoose.model("Season",        seasonSchema);
const Episode       = mongoose.models.Episode       || mongoose.model("Episode",       episodeSchema);
const WatchProgress = mongoose.models.WatchProgress || mongoose.model("WatchProgress", watchProgressSchema);
const Category      = mongoose.models.Category      || mongoose.model("Category",      categorySchema);

// ───────────────────────────────────────────────────────────
// DB MIDDLEWARE
// ───────────────────────────────────────────────────────────
app.use(async (req, res, next) => {
  await connectDB();
  next();
});

// ═══════════════════════════════════════════════════════════
// API ENDPOINTS — SERİ / FİLM
// ═══════════════════════════════════════════════════════════

// Tüm serileri getir
app.get("/api/series", async (req, res) => {
  try {
    const page  = parseInt(req.query.page)  || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip  = (page - 1) * limit;

    const query = {};
    if (req.query.type)     query.type = req.query.type;
    if (req.query.category) query.categories = req.query.category;
    if (req.query.search)   query.title = { $regex: req.query.search, $options: "i" };

    const [series, total] = await Promise.all([
      Series.find(query).sort({ createdAt: -1 }).skip(skip).limit(limit),
      Series.countDocuments(query)
    ]);

    res.json({
      series,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── TEK SERİ — sezonlar ve bölümler dahil ───────────────
// app.js'deki openDetail() fonksiyonu series.seasons[].episodes[]
// yapısını bekliyor. Bu endpoint tüm ağacı birleştirip döndürür.

    // Sezonları çek ve sırala
    const seasons = await Season.find({ seriesId: series._id })
      .sort({ seasonNumber: 1 })
      .lean();

    // Her sezon için bölümleri çek — _id'leri string'e çevir
    const seasonsWithEpisodes = await Promise.all(
      seasons.map(async (season) => {
        const episodes = await Episode.find({ seasonId: season._id })
          .sort({ episodeNumber: 1 })
          .lean();
        return {
          ...season,
          _id: String(season._id),
          episodes: episodes.map(ep => ({
            ...ep,
            _id: String(ep._id),
            seasonId: String(ep.seasonId),
            seriesId: String(ep.seriesId)
          }))
        };
      })
    );

    // Film tipinde doğrudan bölüm arama (sezon olmadan eklenmiş olabilir)
    if (series.type === "movie" && seasonsWithEpisodes.length === 0) {
      const directEpisodes = await Episode.find({ seriesId: series._id })
        .sort({ episodeNumber: 1 })
        .lean();
      if (directEpisodes.length > 0) {
        seasonsWithEpisodes.push({
          _id: null,
          seasonNumber: 1,
          title: series.title,
          episodes: directEpisodes.map(ep => ({
            ...ep,
            _id: String(ep._id),
            seriesId: String(ep.seriesId)
          }))
        });
      }
    }

    res.json({ ...series, seasons: seasonsWithEpisodes });
<<<<<<< Updated upstream
<<<<<<< HEAD
=======
>>>>>>> Stashed changes
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Seri ekle
app.post("/api/series", async (req, res) => {
  try {
    const { title, description, poster, categories, releaseYear, rating, type } = req.body;
    const newSeries = new Series({ title, description, poster, categories, releaseYear, rating, type });
    const saved = await newSeries.save();
    res.status(201).json(saved);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Seri güncelle
app.put("/api/series/:id", async (req, res) => {
  try {
    const updated = await Series.findByIdAndUpdate(req.params.id, req.body, { new: true });
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Seri sil (sezon ve bölümleri de temizle)
app.delete("/api/series/:id", async (req, res) => {
  try {
    const seriesId = req.params.id;
    const seasons = await Season.find({ seriesId }).lean();
    const seasonIds = seasons.map(s => s._id);
    await Episode.deleteMany({ seasonId: { $in: seasonIds } });
    await Season.deleteMany({ seriesId });
    await Series.findByIdAndDelete(seriesId);
    res.json({ message: "Seri ve tüm sezon/bölümler silindi" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ═══════════════════════════════════════════════════════════
// API ENDPOINTS — SEZONLAR
// ═══════════════════════════════════════════════════════════

app.get("/api/seasons/:seriesId", async (req, res) => {
  try {
    const seasons = await Season.find({ seriesId: req.params.seriesId }).sort({ seasonNumber: 1 });
    res.json(seasons);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/seasons", async (req, res) => {
  try {
    const { seriesId, seasonNumber, title, description, releaseDate } = req.body;
    const newSeason = new Season({ seriesId, seasonNumber, title, description, releaseDate });
    const saved = await newSeason.save();
    res.status(201).json(saved);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put("/api/seasons/:id", async (req, res) => {
  try {
    const updated = await Season.findByIdAndUpdate(req.params.id, req.body, { new: true });
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete("/api/seasons/:id", async (req, res) => {
  try {
    const seasonId = req.params.id;
    await Episode.deleteMany({ seasonId });
    await Season.findByIdAndDelete(seasonId);
    res.json({ message: "Sezon ve bölümleri silindi" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ═══════════════════════════════════════════════════════════
// API ENDPOINTS — BÖLÜMLER
// ═══════════════════════════════════════════════════════════

app.get("/api/episodes/:seasonId", async (req, res) => {
  try {
    const episodes = await Episode.find({ seasonId: req.params.seasonId }).sort({ episodeNumber: 1 });
    res.json(episodes);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get("/api/episode/:id", async (req, res) => {
  try {
    const episode = await Episode.findById(req.params.id);
    if (!episode) return res.status(404).json({ error: "Bölüm bulunamadı" });
    res.json(episode);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/episodes", async (req, res) => {
  try {
    const { seasonId, seriesId, episodeNumber, title, description, videoUrl, duration, thumbnail } = req.body;
    const newEpisode = new Episode({ seasonId, seriesId, episodeNumber, title, description, videoUrl, duration, thumbnail, subtitles: [] });
    const saved = await newEpisode.save();
    res.status(201).json(saved);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/episodes/:id/subtitle", async (req, res) => {
  try {
    const { language, vttContent } = req.body;
    const episode = await Episode.findById(req.params.id);
    if (!episode) return res.status(404).json({ error: "Bölüm bulunamadı" });
    episode.subtitles = episode.subtitles.filter(s => s.language !== language);
    episode.subtitles.push({ language, vttContent });
    const updated = await episode.save();
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put("/api/episodes/:id", async (req, res) => {
  try {
    const updated = await Episode.findByIdAndUpdate(req.params.id, req.body, { new: true });
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete("/api/episodes/:id", async (req, res) => {
  try {
    await Episode.findByIdAndDelete(req.params.id);
    res.json({ message: "Bölüm silindi" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ═══════════════════════════════════════════════════════════
// API ENDPOINTS — İZLEME GEÇMİŞİ
// ═══════════════════════════════════════════════════════════

app.post("/api/progress", async (req, res) => {
  try {
    const { userId, seriesId, episodeId, progress } = req.body;
    if (!userId || !seriesId || !episodeId) {
      return res.status(400).json({ error: "userId, seriesId ve episodeId gerekli" });
    }

    const updated = await WatchProgress.findOneAndUpdate(
      { userId, episodeId },
      { userId, seriesId, episodeId, progress: Number(progress) || 0, lastWatchedAt: new Date() },
      { upsert: true, new: true }
    );
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get("/api/progress/continue/:userId", async (req, res) => {
  try {
    const recentWatches = await WatchProgress.find({ userId: req.params.userId })
      .sort({ lastWatchedAt: -1 })
      .limit(10)
      .populate("seriesId")
      .populate("episodeId");
    res.json(recentWatches);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get("/api/progress/:userId/:episodeId", async (req, res) => {
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

// ═══════════════════════════════════════════════════════════
// API ENDPOINTS — KATEGORİLER
// ═══════════════════════════════════════════════════════════

app.get("/api/categories", async (req, res) => {
  try {
    const categories = await Category.find().sort({ name: 1 });
    res.json(categories);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/categories", async (req, res) => {
  try {
    const { name } = req.body;
    const cat = new Category({ name });
    await cat.save();
    res.status(201).json(cat);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// ═══════════════════════════════════════════════════════════
// SAĞLIK KONTROLÜ
// ═══════════════════════════════════════════════════════════
app.get("/api", (req, res) => {
  res.json({
    status: "ok",
    message: "🎬 Streaming Platform API çalışıyor",
    version: "1.1.0",
    endpoints: [
      "GET  /api/series              — tüm içerikler (sayfalama)",
      "GET  /api/series/:id          — seri + sezonlar + bölümler",
      "POST /api/series              — seri ekle",
      "PUT  /api/series/:id          — seri güncelle",
      "DELETE /api/series/:id        — seri + sezon + bölüm sil",
      "GET  /api/seasons/:seriesId   — sezonlar",
      "POST /api/seasons             — sezon ekle",
      "DELETE /api/seasons/:id       — sezon + bölümleri sil",
      "GET  /api/episodes/:seasonId  — bölümler",
      "GET  /api/episode/:id         — tek bölüm",
      "POST /api/episodes            — bölüm ekle",
      "GET  /api/categories          — kategoriler"
    ]
  });
});

// ═══════════════════════════════════════════════════════════
// EXPORT — Vercel için app.listen() YOK
// ═══════════════════════════════════════════════════════════
module.exports = app;