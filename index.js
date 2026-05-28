// ═══════════════════════════════════════════════════════════
// api/index.js — Vercel Serverless Function
// ═══════════════════════════════════════════════════════════

const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const JWT_SECRET = process.env.JWT_SECRET || 'dev_jwt_secret_change_me';

const app = express();

// ───────────────────────────────────────────────────────────
// MIDDLEWARE
// ───────────────────────────────────────────────────────────
app.use(cors({
  origin: "*",
  methods: ["GET","POST","PUT","DELETE"],
  allowedHeaders: ["Content-Type", "Authorization"]
}));
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: true, limit: "50mb" }));

// Use shared DB connector & centralized models
const { connectDB } = require('../lib/db');
const { Series, Season, Episode, WatchProgress, Category, Film, User, Rating } = require('../lib/models');

// Local schema definitions removed — models are imported from ../lib/models
// (keeps serverless redeploys and hot reloads from re-defining models)

// ───────────────────────────────────────────────────────────
// SAĞLIK (Health) Endpoint - DB durumunu kontrol eder
// Bu endpoint DB middleware'inden önce gelmelidir, böylece
// bağlantı durumunu ayrı olarak sorgulayabiliriz.
app.get('/api/health', async (req, res) => {
  try {
    await connectDB();
    const state = mongoose.connection.readyState;
    const ok = state === 1;
    res.json({
      api: 'ok',
      dbReady: ok,
      mongooseReadyState: state,
      message: ok ? 'MongoDB bağlı' : 'MongoDB bağlı değil'
    });
  } catch (err) {
    res.status(500).json({ api: 'ok', dbReady: false, error: err.message });
  }
});

// ───────────────────────────────────────────────────────────
// QasimFlix HTML5 player için Google Drive video proxy
// Bu endpoint DB istemez; bu yüzden DB middleware'inden önce durur.
// ───────────────────────────────────────────────────────────
function extractDriveFileId(input = '') {
  const url = String(input || '');
  const patterns = [
    /\/file\/d\/([a-zA-Z0-9_-]+)/,
    /[?&]id=([a-zA-Z0-9_-]+)/,
    /\/uc\?[^#]*id=([a-zA-Z0-9_-]+)/,
    /\/open\?[^#]*id=([a-zA-Z0-9_-]+)/,
    /\/d\/([a-zA-Z0-9_-]+)/
  ];
  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) return match[1];
  }
  return '';
}

function toDriveDownloadUrl(input = '') {
  const raw = String(input || '').trim();
  const id = extractDriveFileId(raw);
  if (!id) return raw;
  return `https://drive.google.com/uc?export=download&id=${id}`;
}

async function fetchVideoUpstream(targetUrl, headers) {
  let upstream = await fetch(targetUrl, { headers, redirect: 'follow' });
  let contentType = upstream.headers.get('content-type') || '';

  // Büyük Google Drive dosyaları bazen önce onay HTML'i döndürür.
  // HTML içinden gerçek indirme linkini bulup ikinci isteği yapıyoruz.
  if (contentType.includes('text/html') && targetUrl.includes('drive.google.com')) {
    const html = await upstream.text();
    const cookie = upstream.headers.get('set-cookie') || '';
    const confirmMatch = html.match(/href="([^"]*(?:uc\?export=download|drive\.usercontent\.google\.com\/download)[^"]*)"/i);
    let confirmUrl = confirmMatch ? confirmMatch[1].replace(/&amp;/g, '&') : '';

    if (confirmUrl && confirmUrl.startsWith('/')) {
      confirmUrl = 'https://drive.google.com' + confirmUrl;
    }

    if (!confirmUrl) {
      const token = (html.match(/confirm=([0-9A-Za-z_\-]+)/) || [])[1];
      const id = extractDriveFileId(targetUrl);
      if (token && id) confirmUrl = `https://drive.google.com/uc?export=download&confirm=${token}&id=${id}`;
    }

    if (confirmUrl) {
      upstream = await fetch(confirmUrl, {
        headers: { ...headers, Cookie: cookie },
        redirect: 'follow'
      });
    }
  }

  return upstream;
}

app.get('/api/video-proxy', async (req, res) => {
  try {
    const rawUrl = String(req.query.url || '');
    if (!rawUrl) return res.status(400).send('Video URL gerekli');

    const targetUrl = toDriveDownloadUrl(rawUrl);
    if (!/^https:\/\//i.test(targetUrl)) {
      return res.status(400).send('Sadece güvenli HTTPS video linkleri desteklenir');
    }

    const headers = {
      'User-Agent': 'Mozilla/5.0 QasimFlixPlayer/1.0'
    };
    if (req.headers.range) headers.Range = req.headers.range;

    const upstream = await fetchVideoUpstream(targetUrl, headers);
    const contentType = upstream.headers.get('content-type') || 'video/mp4';

    if (!upstream.ok && upstream.status !== 206) {
      return res.status(upstream.status).send('Video kaynağına ulaşılamadı');
    }

    if (contentType.includes('text/html')) {
      return res.status(422).send('Google Drive doğrudan video akışı vermedi. Dosya herkese açık olmalı veya farklı depolama/CDN kullanılmalı.');
    }

    res.status(upstream.status === 206 ? 206 : 200);
    res.setHeader('Accept-Ranges', 'bytes');
    res.setHeader('Content-Type', contentType);
    ['content-length', 'content-range', 'cache-control', 'etag', 'last-modified'].forEach(name => {
      const value = upstream.headers.get(name);
      if (value) res.setHeader(name, value);
    });

    if (!upstream.body) return res.end();

    const reader = upstream.body.getReader();
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (!res.write(Buffer.from(value))) {
        await new Promise(resolve => res.once('drain', resolve));
      }
    }
    res.end();
  } catch (err) {
    console.error('[video-proxy]', err);
    res.status(500).send('Video proxy hatası: ' + err.message);
  }
});

// ───────────────────────────────────────────────────────────
// DB MIDDLEWARE
// ───────────────────────────────────────────────────────────
app.use(async (req, res, next) => {
  await connectDB();
  const mongoose = require('mongoose');
  if (mongoose.connection.readyState !== 1) {
    return res.status(503).json({ error: 'MongoDB bağlantısı yok. Lütfen `MONGODB_URI` veya MongoDB servisini kontrol edin.' });
  }
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
app.get("/api/series/:id", async (req, res) => {
  try {
    const series = await Series.findById(req.params.id).lean();
    if (!series) return res.status(404).json({ error: "Seri bulunamadı" });

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
          episodes: directEpisodes
        });
      }
    }

    res.json({ ...series, seasons: seasonsWithEpisodes });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Seri ekle
app.post("/api/series", async (req, res) => {
  try {
    const { title, description, description_tr, description_ar, poster, banner, categories = [], releaseYear, rating, type, videoUrl, duration } = req.body;

    // If content is marked as 'yerli' (local), ensure it belongs to the "Yerli Diziler" category
    const cats = Array.isArray(categories) ? categories.slice() : (typeof categories === 'string' ? categories.split(',').map(c=>c.trim()).filter(Boolean) : []);
    if (type === 'yerli' && !cats.some(c => c.toLowerCase() === 'yerli diziler')) {
      cats.push('Yerli Diziler');
    }

    const newSeries = new Series({ title, description, description_tr, description_ar, poster, banner, categories: cats, releaseYear, rating, type });
    const saved = await newSeries.save();

    // Film veya Belgesel ise otomatik Sezon 1 ve Bölüm 1 oluştur
    if ((type === 'movie' || type === 'documentary') && videoUrl) {
      const season = new Season({
        seriesId: saved._id,
        seasonNumber: 1,
        title: title,
        description: description || description_tr || description_ar || ''
      });
      const savedSeason = await season.save();

      const episode = new Episode({
        seasonId: savedSeason._id,
        seriesId: saved._id,
        episodeNumber: 1,
        title: title,
        description: description || description_tr || description_ar || '',
        videoUrl: videoUrl,
        duration: duration || 0,
        subtitles: []
      });
      await episode.save();
    }

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
    const seasons = await Season.find({ seriesId: req.params.seriesId })
      .sort({ seasonNumber: 1 })
      .lean();
    
    // Her sezon için bölümleri çek
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
    
    res.json(seasonsWithEpisodes);
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

app.get("/api/progress/me/:episodeId", async (req, res) => {
  try {
    const userId = getUserIdFromReq(req);
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });
    const progress = await WatchProgress.findOne({ userId, episodeId: req.params.episodeId });
    res.json(progress || { progress: 0 });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// NOTE: /me/:episodeId must be registered BEFORE /:userId/:episodeId
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

// NOTE: /continue/me must be registered BEFORE /continue/:userId
app.get("/api/progress/continue/me", async (req, res) => {
  try {
    const userId = getUserIdFromReq(req);
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });
    const recentWatches = await WatchProgress.find({ userId })
      .sort({ lastWatchedAt: -1 }).limit(10)
      .populate("seriesId").populate("episodeId");
    res.json(recentWatches);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get("/api/progress/continue/:userId", async (req, res) => {
  try {
    const recentWatches = await WatchProgress.find({ userId: req.params.userId })
      .sort({ lastWatchedAt: -1 }).limit(10).populate("seriesId");
    res.json(recentWatches);
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
// ARAMA — isim, açıklama, kategori ile arama
// ═══════════════════════════════════════════════════════════
app.get("/api/series/search/:query", async (req, res) => {
  try {
    const query = req.params.query;
    const results = await Series.find({
      $or: [
        { title: { $regex: query, $options: 'i' } },
        { description: { $regex: query, $options: 'i' } },
        { categories: { $regex: query, $options: 'i' } }
      ]
    }).limit(30);
    res.json(results);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Kategoriye göre arama
app.get("/api/series/category/:category", async (req, res) => {
  try {
    const series = await Series.find({
      categories: { $regex: req.params.category, $options: 'i' }
    }).limit(30);
    res.json(series);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ═══════════════════════════════════════════════════════════
// SAĞLIK KONTROLÜ
// ═══════════════════════════════════════════════════════════
app.get("/api", (req, res) => {
  res.json({
    status: "ok",
    message: "🎬 Streaming Platform API çalışıyor",
    version: "2.0.0",
    endpoints: [
      "GET  /api/series              — tüm içerikler (sayfalama)",
      "GET  /api/series/:id          — seri + sezonlar + bölümler",
      "GET  /api/series/search/:q    — arama (isim, açıklama, kategori)",
      "GET  /api/series/category/:c  — kategoriye göre filtreleme",
      "POST /api/series              — seri ekle",
      "PUT  /api/series/:id          — seri güncelle",
      "DELETE /api/series/:id        — seri + sezon + bölüm sil",
      "GET  /api/seasons/:seriesId   — sezonlar",
      "POST /api/seasons             — sezon ekle",
      "DELETE /api/seasons/:id       — sezon + bölümleri sil",
      "GET  /api/episodes/:seasonId  — bölümler",
      "GET  /api/episode/:id         — tek bölüm",
      "POST /api/episodes            — bölüm ekle",
      "POST /api/progress            — izleme kaydı",
      "GET  /api/progress/me/:epId   — kullanıcı ilerleme",
      "GET  /api/progress/continue/me— devam et listesi",
      "POST /api/auth/register       — kayıt",
      "POST /api/auth/login          — giriş",
      "GET  /api/auth/me             — kullanıcı bilgisi",
      "GET  /api/categories          — kategoriler"
    ]
  });
});

// ═══════════════════════════════════════════════════════════
// AUTH helpers & endpoints (register/login/me)
// Added so serverless `/api` routes include authentication handlers
// ═══════════════════════════════════════════════════════════

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

// ═══════════════════════════════════════════════════════════
// API ENDPOINTS — FAVORİLER (WISHLIST)
// ═══════════════════════════════════════════════════════════

app.get('/api/favorites', async (req, res) => {
  try {
    const userId = getUserIdFromReq(req);
    const progress = await WatchProgress.find({ userId, isFavorite: true });
    const seriesIds = [...new Set(progress.map(p => p.seriesId))];
    const favorites = await Series.find({ _id: { $in: seriesIds } });
    res.json(favorites);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/favorites/:seriesId', async (req, res) => {
  try {
    const userId = getUserIdFromReq(req);
    const seriesId = req.params.seriesId;
    const existing = await WatchProgress.findOne({ userId, seriesId });
    
    if (existing) {
      existing.isFavorite = !existing.isFavorite;
      await existing.save();
    } else {
      const newFav = new WatchProgress({ userId, seriesId, isFavorite: true });
      await newFav.save();
    }
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ═══════════════════════════════════════════════════════════

// ═══════════════════════════════════════════════════════════
// API ENDPOINTS — PUAN & YORUMLAR
// ═══════════════════════════════════════════════════════════
app.post('/api/ratings/add', async (req, res) => {
  try {
    const userId = getUserIdFromReq(req);
    if (!userId) return res.status(401).json({ error: 'Yorum yapmak için giriş yapmalısın.' });

    const { seriesId, rating, review } = req.body;
    const numericRating = Number(rating);
    if (!seriesId) return res.status(400).json({ error: 'İçerik bilgisi eksik.' });
    if (!Number.isFinite(numericRating) || numericRating < 1 || numericRating > 5) {
      return res.status(400).json({ error: 'Puan 1 ile 5 arasında olmalı.' });
    }

    const cleanReview = String(review || '').trim().slice(0, 1000);
    const ratingDoc = await Rating.findOneAndUpdate(
      { userId, seriesId },
      { userId, seriesId, rating: numericRating, review: cleanReview, createdAt: new Date() },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    const ratings = await Rating.find({ seriesId });
    if (ratings.length) {
      const avgRating = ratings.reduce((sum, item) => sum + Number(item.rating || 0), 0) / ratings.length;
      await Series.findByIdAndUpdate(seriesId, { rating: avgRating.toFixed(1) });
    }

    res.json({ success: true, message: 'Yorumun kaydedildi.', rating: ratingDoc });
  } catch (err) {
    res.status(500).json({ error: 'Yorum kaydedilemedi.' });
  }
});

app.get('/api/ratings/:seriesId', async (req, res) => {
  try {
    const ratings = await Rating.find({ seriesId: req.params.seriesId })
      .populate('userId', 'name email')
      .sort({ createdAt: -1 })
      .limit(50)
      .lean();
    res.json(ratings);
  } catch (err) {
    res.status(500).json({ error: 'Yorumlar yüklenemedi.' });
  }
});

// API ENDPOINTS — KULLANICI PROFİL YÖNETİMİ
// ═══════════════════════════════════════════════════════════

// Kullanıcının kendi profilini güncelle (isim, profil resmi)
app.put('/api/user/profile', async (req, res) => {
  try {
    const userId = getUserIdFromReq(req);
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });
    const { name, profilePicture } = req.body;
    const update = {};
    if (name !== undefined) update.name = name;
    if (profilePicture !== undefined) update.profilePicture = profilePicture;
    const user = await User.findByIdAndUpdate(userId, update, { new: true }).select('-passwordHash');
    if (!user) return res.status(404).json({ error: 'Kullanıcı bulunamadı' });
    res.json(user);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Tüm alt profilleri listele
app.get('/api/user/profiles', async (req, res) => {
  try {
    const userId = getUserIdFromReq(req);
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });
    const user = await User.findById(userId).select('profiles name profilePicture');
    if (!user) return res.status(404).json({ error: 'Kullanıcı bulunamadı' });
    res.json({
      mainProfile: { name: user.name, profilePicture: user.profilePicture, isMain: true },
      childProfiles: user.profiles || []
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Yeni alt profil oluştur
app.post('/api/user/profiles', async (req, res) => {
  try {
    const userId = getUserIdFromReq(req);
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });
    const { name, ageRestriction, pinCode } = req.body;
    if (!name) return res.status(400).json({ error: 'Profil adı gerekli' });
    const hashedPin = pinCode ? await bcrypt.hash(String(pinCode), 10) : null;
    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ error: 'Kullanıcı bulunamadı' });
    if (user.profiles.length >= 4) return res.status(400).json({ error: 'En fazla 4 alt profil oluşturabilirsiniz' });
    const newProfile = { name, ageRestriction: ageRestriction || 18, pinCode: hashedPin };
    user.profiles.push(newProfile);
    await user.save();
    const added = user.profiles[user.profiles.length - 1];
    res.status(201).json({ _id: added._id, name: added.name, ageRestriction: added.ageRestriction, hasPin: !!hashedPin });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Alt profil güncelle
app.put('/api/user/profiles/:profileId', async (req, res) => {
  try {
    const userId = getUserIdFromReq(req);
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });
    const { name, ageRestriction, pinCode } = req.body;
    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ error: 'Kullanıcı bulunamadı' });
    const profile = user.profiles.id(req.params.profileId);
    if (!profile) return res.status(404).json({ error: 'Profil bulunamadı' });
    if (name !== undefined) profile.name = name;
    if (ageRestriction !== undefined) profile.ageRestriction = ageRestriction;
    if (pinCode !== undefined) {
      profile.pinCode = pinCode ? await bcrypt.hash(String(pinCode), 10) : null;
    }
    await user.save();
    res.json({ _id: profile._id, name: profile.name, ageRestriction: profile.ageRestriction, hasPin: !!profile.pinCode });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Alt profil sil
app.delete('/api/user/profiles/:profileId', async (req, res) => {
  try {
    const userId = getUserIdFromReq(req);
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });
    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ error: 'Kullanıcı bulunamadı' });
    const profile = user.profiles.id(req.params.profileId);
    if (!profile) return res.status(404).json({ error: 'Profil bulunamadı' });
    profile.deleteOne();
    await user.save();
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PIN doğrula (profil geçişi için)
app.post('/api/user/profiles/:profileId/verify-pin', async (req, res) => {
  try {
    const userId = getUserIdFromReq(req);
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });
    const { pin } = req.body;
    if (!pin) return res.status(400).json({ error: 'PIN gerekli' });
    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ error: 'Kullanıcı bulunamadı' });
    const profile = user.profiles.id(req.params.profileId);
    if (!profile) return res.status(404).json({ error: 'Profil bulunamadı' });
    if (!profile.pinCode) return res.json({ success: true }); // PIN yoksa direkt geç
    const ok = await bcrypt.compare(String(pin), profile.pinCode);
    if (!ok) return res.status(401).json({ error: 'Yanlış PIN' });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Şifre değiştir
app.put('/api/user/change-password', async (req, res) => {
  try {
    const userId = getUserIdFromReq(req);
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) return res.status(400).json({ error: 'Mevcut ve yeni şifre gerekli' });
    if (newPassword.length < 6) return res.status(400).json({ error: 'Yeni şifre en az 6 karakter olmalı' });
    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ error: 'Kullanıcı bulunamadı' });
    const ok = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!ok) return res.status(401).json({ error: 'Mevcut şifre yanlış' });
    user.passwordHash = await bcrypt.hash(newPassword, 10);
    await user.save();
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ═══════════════════════════════════════════════════════════
// EXPORT — Vercel için app.listen() YOK
// ═══════════════════════════════════════════════════════════
module.exports = app;