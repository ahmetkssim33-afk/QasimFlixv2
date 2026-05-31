const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const multer = require("multer");
const path = require("path");
const fs = require("fs");

require('dotenv').config();

const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const {
  createCorsOptions,
  securityHeaders,
  createRateLimiter,
  getJwtSecret,
  getAdminJwtSecret,
  hasAdminPasswordConfigured,
  verifyConfiguredAdminPassword,
  isSafeExternalUrl
} = require('./lib/security');
const { isConfigured: isTMDBConfigured, searchTMDB, getTMDBDetails } = require('./lib/tmdb');
const nodemailer = require('nodemailer');

const app = express();
app.use(securityHeaders);
app.use(cors(createCorsOptions()));
app.use(express.json({ limit: '20mb' }));
app.use(express.urlencoded({ extended: true, limit: '20mb' }));

const authLimiter = createRateLimiter({ windowMs: 15 * 60 * 1000, max: 12, message: 'Çok fazla giriş denemesi. Biraz sonra tekrar deneyin.' });
const reportLimiter = createRateLimiter({ windowMs: 10 * 60 * 1000, max: 10 });
const strictLimiter = createRateLimiter({ windowMs: 15 * 60 * 1000, max: 40 });
app.use('/api/admin/login', authLimiter);
app.use('/api/auth/login', authLimiter);
app.use('/api/auth/register', authLimiter);
app.use('/api/auth/forgot-password', authLimiter);
app.use('/api/auth/reset-password', authLimiter);
app.use('/api/reports', reportLimiter);
app.use('/api/content-requests', reportLimiter);
app.use('/api/link-check', strictLimiter);

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
const { Series, Season, Episode, WatchProgress, Category, Film, User, Rating, Analytics, EmailLog, ContentRequest, IssueReport, PushSubscription, Announcement, AdminLog } = require('./lib/models');

// ───────────────────────────────────────────────────────────
// ADMIN SECURITY — local server için de Vercel API ile aynı koruma
// ───────────────────────────────────────────────────────────
const ADMIN_API_KEY = String(process.env.ADMIN_API_KEY || '');
const ADMIN_SESSION_TTL = process.env.ADMIN_SESSION_TTL || '12h';

function getRequestIp(req) {
  return String(req.headers['x-forwarded-for'] || req.socket?.remoteAddress || 'unknown').split(',')[0].trim();
}

function getBearerToken(req) {
  const auth = String(req.headers.authorization || '');
  const match = auth.match(/^Bearer\s+(.+)$/i);
  return match ? match[1].trim() : '';
}

function getAdminFromRequest(req) {
  const token = getBearerToken(req);
  if (token) {
    try {
      const secret = getAdminJwtSecret();
      if (!secret) return null;
      const payload = jwt.verify(token, secret);
      if (payload && payload.role === 'admin') return payload;
    } catch (_) {}
  }

  const key = String(req.headers['x-admin-key'] || '').trim();
  if (ADMIN_API_KEY && key && key === ADMIN_API_KEY) return { role: 'admin', mode: 'api-key' };
  return null;
}

function requireAdmin(req, res, next) {
  const admin = getAdminFromRequest(req);
  if (!admin) return res.status(401).json({ error: 'Admin yetkisi gerekli. Lütfen admin paneline tekrar giriş yapın.' });
  req.admin = admin;
  next();
}

function pathStarts(path, value) { return String(path || '').startsWith(value); }
function pathMatches(path, rx) { return rx.test(String(path || '')); }

function shouldRequireAdmin(req) {
  const method = req.method.toUpperCase();
  const path = req.path;
  if (method === 'OPTIONS') return false;
  if (path === '/api/admin/login') return false;
  if (pathStarts(path, '/api/admin/')) return true;
  if (pathStarts(path, '/api/tmdb/')) return true;
  if (pathStarts(path, '/api/email/')) return true;
  if (path === '/api/link-check') return true;
  if (['POST','PUT','PATCH','DELETE'].includes(method) && pathMatches(path, /^\/api\/series(?:\/[^/]+)?$/)) return true;
  if (['POST','PUT','PATCH','DELETE'].includes(method) && pathMatches(path, /^\/api\/seasons(?:\/[^/]+)?$/)) return true;
  if (['POST','PUT','PATCH','DELETE'].includes(method) && pathMatches(path, /^\/api\/episodes(?:\/[^/]+)?(?:\/subtitle)?$/)) return true;
  if (['POST','PUT','PATCH','DELETE'].includes(method) && pathMatches(path, /^\/api\/categories(?:\/[^/]+)?$/)) return true;
  if (['POST','PUT','PATCH','DELETE'].includes(method) && pathStarts(path, '/api/announcements')) return true;
  if (method === 'GET' && path === '/api/announcements') return true;
  if (['GET','PATCH','DELETE'].includes(method) && pathMatches(path, /^\/api\/reports(?:\/[^/]+)?$/)) return true;
  if (['GET','PATCH','DELETE'].includes(method) && pathMatches(path, /^\/api\/content-requests(?:\/[^/]+)?$/)) return true;
  return false;
}

async function writeAdminLog(action, req, detail = '') {
  try {
    await AdminLog.create({
      action: String(action || 'admin_event').slice(0, 80),
      detail: String(detail || '').slice(0, 800),
      ip: getRequestIp(req).slice(0, 120),
      userAgent: String(req.headers['user-agent'] || '').slice(0, 400)
    });
  } catch (_) {}
}

app.post('/api/admin/login', async (req, res) => {
  try {
    await connectDB();
    if (!hasAdminPasswordConfigured() || !getAdminJwtSecret()) {
      await writeAdminLog('admin_login_config_error', req, 'ADMIN_PASSWORD/ADMIN_JWT_SECRET eksik');
      return res.status(500).json({ error: 'Admin güvenlik ayarları eksik. Environment Variables içinde ADMIN_PASSWORD ve ADMIN_JWT_SECRET tanımlayın.' });
    }
    const ok = await verifyConfiguredAdminPassword(req.body?.password);
    if (!ok) {
      await writeAdminLog('admin_login_failed', req, 'Hatalı admin şifresi');
      return res.status(401).json({ error: 'Hatalı admin şifresi.' });
    }
    const token = jwt.sign({ role: 'admin', mode: 'panel' }, getAdminJwtSecret(), { expiresIn: ADMIN_SESSION_TTL });
    await writeAdminLog('admin_login_success', req, 'Admin panel girişi');
    res.json({ success: true, token, expiresIn: ADMIN_SESSION_TTL });
  } catch (err) {
    res.status(500).json({ error: 'Admin girişi yapılamadı.' });
  }
});

app.use((req, res, next) => {
  if (!shouldRequireAdmin(req)) return next();
  return requireAdmin(req, res, next);
});

function ensureJwtConfigured(res) {
  const secret = getJwtSecret();
  if (!secret) {
    res.status(500).json({ error: 'JWT_SECRET eksik. Environment Variables içinde tanımlayın.' });
    return '';
  }
  return secret;
}

function signUserToken(user) {
  return jwt.sign({ id: user._id, email: user.email }, getJwtSecret(), { expiresIn: '30d' });
}


// Helper: try to extract user id from Authorization header (Bearer token)
function getUserIdFromReq(req) {
  try {
    const auth = req.headers && req.headers.authorization;
    if (!auth) return null;
    const parts = auth.split(' ');
    if (parts.length !== 2) return null;
    const secret = getJwtSecret();
    if (!secret) return null;
    const payload = jwt.verify(parts[1], secret);
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
// SAĞLIK (Health) Endpoint - local server için
// ═══════════════════════════════════════════════════════════
app.get('/api/health', async (req, res) => {
  try {
    await connectDB();
    const state = mongoose.connection.readyState;
    res.json({ api: 'ok', dbReady: state === 1, mongooseReadyState: state, message: state === 1 ? 'MongoDB bağlı' : 'MongoDB bağlı değil' });
  } catch (err) {
    res.status(500).json({ api: 'ok', dbReady: false, error: err.message });
  }
});



// ───────────────────────────────────────────────────────────
// TMDB METADATA + LINK CHECK + ANNOUNCEMENTS
// ───────────────────────────────────────────────────────────
function tmdbError(res, err) {
  const status = err.statusCode || err.status || 500;
  res.status(status).json({ error: err.message || 'TMDB isteği başarısız.', configured: isTMDBConfigured() });
}

app.get('/api/tmdb/status', (req, res) => {
  res.json({ configured: isTMDBConfigured(), envName: process.env.TMDB_TOKEN ? 'TMDB_TOKEN' : (process.env.TMDB_API_KEY ? 'TMDB_API_KEY' : '') });
});

app.get('/api/tmdb/search', async (req, res) => {
  try {
    const items = await searchTMDB({
      q: req.query.q,
      type: req.query.type || 'multi',
      language: req.query.language || 'tr-TR',
      page: req.query.page || 1
    });
    res.json({ configured: true, results: items });
  } catch (err) { tmdbError(res, err); }
});

app.get('/api/tmdb/details/:mediaType/:id', async (req, res) => {
  try {
    const details = await getTMDBDetails(req.params.mediaType, req.params.id, req.query.language || 'tr-TR');
    res.json(details);
  } catch (err) { tmdbError(res, err); }
});

function normalizeCheckUrl(rawUrl = '') {
  const raw = String(rawUrl || '').trim();
  if (!raw) return '';
  const driveId = (raw.match(/\/file\/d\/([a-zA-Z0-9_-]+)/) || raw.match(/[?&]id=([a-zA-Z0-9_-]+)/) || [])[1];
  if (driveId) return `https://drive.google.com/file/d/${driveId}/preview`;
  return raw;
}

async function checkOneVideoLink(rawUrl = '') {
  const url = normalizeCheckUrl(rawUrl);
  if (!url) return { status: 'empty', ok: false, message: 'Link boş.' };
  const safe = isSafeExternalUrl(url, { allowHttp: false });
  if (!safe.ok) return { status: 'broken', ok: false, message: safe.reason || 'Geçersiz link.' };
  try {
    const signal = AbortSignal.timeout ? AbortSignal.timeout(8500) : undefined;
    let response = await fetch(url, { method: 'HEAD', redirect: 'follow', signal, headers: { 'User-Agent': 'QasimFlixLinkCheck/1.0' } }).catch(async () => null);
    if (!response || response.status === 405 || response.status === 403) {
      response = await fetch(url, { method: 'GET', redirect: 'follow', signal, headers: { 'Range': 'bytes=0-0', 'User-Agent': 'QasimFlixLinkCheck/1.0' } });
    }
    if (response.status === 401 || response.status === 403) return { status: 'access_denied', ok: false, httpStatus: response.status, message: 'Erişim yok / izin kapalı.' };
    if (response.status === 404) return { status: 'broken', ok: false, httpStatus: response.status, message: 'Link bulunamadı.' };
    if (response.ok || response.status === 206) return { status: 'ok', ok: true, httpStatus: response.status, contentType: response.headers.get('content-type') || '', finalUrl: response.url, message: 'Çalışıyor.' };
    return { status: 'broken', ok: false, httpStatus: response.status, message: `HTTP ${response.status}` };
  } catch (err) {
    return { status: 'broken', ok: false, message: err.name === 'TimeoutError' ? 'Zaman aşımı.' : (err.message || 'Kontrol edilemedi.') };
  }
}

app.post('/api/link-check', async (req, res) => {
  const result = await checkOneVideoLink(req.body.url || req.query.url || '');
  res.json(result);
});

app.get('/api/admin/summary', async (req, res) => {
  try {
    await connectDB();
    const activeCutoff = new Date(Date.now() - 15 * 60 * 1000);
    const dailyCutoff = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const [totalSeries, totalMovies, totalSeasons, totalEpisodes, totalUsers, activeUsers, newUsersToday, activeUsersToday, totalWatches, totalPushSubscribers, activePushSubscribers, openReports, openRequests, lastContent, topReported] = await Promise.all([
      Series.countDocuments({ type: { $ne: 'movie' } }),
      Series.countDocuments({ type: 'movie' }),
      Season.countDocuments(),
      Episode.countDocuments(),
      User.countDocuments().catch(() => 0),
      User.countDocuments({ $or: [{ lastActiveAt: { $gte: activeCutoff } }, { lastLoginAt: { $gte: activeCutoff } }] }).catch(() => 0),
      User.countDocuments({ createdAt: { $gte: dailyCutoff } }).catch(() => 0),
      User.countDocuments({ $or: [{ lastActiveAt: { $gte: dailyCutoff } }, { lastLoginAt: { $gte: dailyCutoff } }] }).catch(() => 0),
      WatchProgress.countDocuments().catch(() => 0),
      PushSubscription.countDocuments().catch(() => 0),
      PushSubscription.countDocuments({ lastSeenAt: { $gte: dailyCutoff } }).catch(() => 0),
      IssueReport.countDocuments({ status: 'open' }),
      ContentRequest.countDocuments({ status: 'open' }),
      Series.find().sort({ createdAt: -1 }).limit(6).select('title type poster releaseYear rating createdAt').lean(),
      IssueReport.aggregate([{ $match: { contentTitle: { $ne: null } } }, { $group: { _id: '$contentTitle', count: { $sum: 1 } } }, { $sort: { count: -1 } }, { $limit: 5 }]).catch(() => [])
    ]);
    res.json({ totalSeries, totalMovies, totalSeasons, totalEpisodes, totalUsers, activeUsers, newUsersToday, activeUsersToday, totalWatches, totalPushSubscribers, activePushSubscribers, openReports, openRequests, lastContent, topReported, generatedAt: new Date().toISOString() });
  } catch (err) { res.status(500).json({ error: 'Özet yüklenemedi.' }); }
});

app.get('/api/announcements/public', async (req, res) => {
  try {
    await connectDB();
    const now = new Date();
    const items = await Announcement.find({
      isActive: true,
      $and: [
        { $or: [{ startsAt: null }, { startsAt: { $exists: false } }, { startsAt: { $lte: now } }] },
        { $or: [{ endsAt: null }, { endsAt: { $exists: false } }, { endsAt: { $gte: now } }] }
      ]
    }).sort({ createdAt: -1 }).limit(3).lean();
    res.json(items);
  } catch (err) { res.json([]); }
});

app.get('/api/announcements', async (req, res) => {
  try { await connectDB(); res.json(await Announcement.find().sort({ createdAt: -1 }).limit(100).lean()); }
  catch (err) { res.status(500).json({ error: 'Duyurular yüklenemedi.' }); }
});
app.post('/api/announcements', async (req, res) => {
  try {
    await connectDB();
    const title = String(req.body.title || '').trim();
    const message = String(req.body.message || '').trim();
    if (!title || !message) return res.status(400).json({ error: 'Başlık ve mesaj zorunlu.' });
    const doc = await Announcement.create({ title: title.slice(0,120), message: message.slice(0,800), level: req.body.level || 'info', isActive: req.body.isActive !== false, startsAt: req.body.startsAt || undefined, endsAt: req.body.endsAt || undefined });
    res.status(201).json(doc);
  } catch (err) { res.status(500).json({ error: 'Duyuru eklenemedi.' }); }
});
app.patch('/api/announcements/:id', async (req, res) => {
  try { await connectDB(); const update = { ...req.body, updatedAt: new Date() }; res.json(await Announcement.findByIdAndUpdate(req.params.id, update, { new: true })); }
  catch (err) { res.status(500).json({ error: 'Duyuru güncellenemedi.' }); }
});
app.delete('/api/announcements/:id', async (req, res) => {
  try { await connectDB(); await Announcement.findByIdAndDelete(req.params.id); res.json({ success: true }); }
  catch (err) { res.status(500).json({ error: 'Duyuru silinemedi.' }); }
});

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
        { description: { $regex: query, $options: 'i' } },
        { description_tr: { $regex: query, $options: 'i' } },
        { description_ar: { $regex: query, $options: 'i' } },
        { categories: { $regex: query, $options: 'i' } },
        { type: { $regex: query, $options: 'i' } },
        ...(Number.isFinite(Number(query)) ? [{ releaseYear: Number(query) }] : [])
      ]
    }).limit(30);
    res.json(results);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});


// Full search — title, episode title, category, year, descriptions
app.get('/api/search/full', async (req, res) => {
  try {
    const q = String(req.query.q || '').trim();
    if (!q) return res.json([]);
    const rx = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
    const year = Number(q);
    const seriesMatches = await Series.find({ $or: [
      { title: rx }, { description: rx }, { description_tr: rx }, { description_ar: rx }, { categories: rx }, { type: rx },
      ...(Number.isFinite(year) ? [{ releaseYear: year }] : [])
    ] }).limit(40).lean();
    const episodeMatches = await Episode.find({ $or: [{ title: rx }, { description: rx }] }).limit(40).populate('seriesId').lean();
    const map = new Map();
    for (const s of seriesMatches) map.set(String(s._id), { ...s, matchType: 'series' });
    for (const ep of episodeMatches) {
      const s = ep.seriesId; if (!s || !s._id) continue;
      const key = String(s._id); const item = map.get(key) || { ...s, matchType: 'episode', matchedEpisodes: [] };
      item.matchedEpisodes = item.matchedEpisodes || []; item.matchedEpisodes.push({ _id: ep._id, title: ep.title, episodeNumber: ep.episodeNumber, duration: ep.duration });
      item.matchType = item.matchType === 'series' ? 'series+episode' : 'episode'; map.set(key, item);
    }
    res.json([...map.values()].slice(0, 60));
  } catch (err) { res.status(500).json({ error: 'Arama yapılamadı.' }); }
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
    const { title, description, description_tr, description_ar, poster, banner, categories = [], releaseYear, rating, type, videoUrl, duration, tmdbId, tmdbType, originalTitle, trailerUrl, cast, tmdbPoster, tmdbBackdrop } = req.body;
    const cats = Array.isArray(categories) ? categories.slice() : (typeof categories === 'string' ? categories.split(',').map(c=>c.trim()).filter(Boolean) : []);
    if (type === 'yerli' && !cats.some(c => c.toLowerCase() === 'yerli diziler')) cats.push('Yerli Diziler');

    const newSeries = new Series({
      title, description, description_tr, description_ar, poster, banner, categories: cats, releaseYear, rating, type: type || 'series',
      tmdbId, tmdbType, originalTitle, trailerUrl, cast: Array.isArray(cast) ? cast : [], tmdbPoster, tmdbBackdrop
    });

    const saved = await newSeries.save();
    if ((type === 'movie' || type === 'documentary') && videoUrl) {
      const season = await Season.create({ seriesId: saved._id, seasonNumber: 1, title, description: description || description_tr || description_ar || '' });
      await Episode.create({ seasonId: season._id, seriesId: saved._id, episodeNumber: 1, title, description: description || description_tr || description_ar || '', videoUrl, duration: duration || 0, subtitles: [] });
    }
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

// Get watch progress for currently authenticated user (uses Bearer token)
// NOTE: Must be registered BEFORE /:userId/:episodeId to avoid "me" being treated as a userId
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


// Continue routes must stay before /api/progress/:userId/:episodeId
app.get('/api/progress/continue/me', async (req, res) => {
  try {
    const userId = getUserIdFromReq(req);
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });
    const recentWatches = await WatchProgress.find({ userId: String(userId) }).sort({ lastWatchedAt: -1 }).limit(10).populate('seriesId').populate('episodeId');
    res.json(recentWatches);
  } catch (err) { res.status(500).json({ error: err.message }); }
});
app.get('/api/progress/continue/:userId', async (req, res) => {
  try {
    const recentWatches = await WatchProgress.find({ userId: String(req.params.userId) }).sort({ lastWatchedAt: -1 }).limit(10).populate('seriesId').populate('episodeId');
    res.json(recentWatches);
  } catch (err) { res.status(500).json({ error: err.message }); }
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

// Get continue watching for authenticated user (Bearer token)
// NOTE: Must be registered BEFORE /continue/:userId to avoid "me" being treated as a userId
app.get('/api/progress/continue/me', async (req, res) => {
  try {
    const userId = getUserIdFromReq(req);
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });
    const recentWatches = await WatchProgress.find({ userId })
      .sort({ lastWatchedAt: -1 })
      .limit(10)
      .populate('seriesId')
      .populate('episodeId');
    res.json(recentWatches);
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
      .populate('seriesId')
      .populate('episodeId');

    res.json(recentWatches);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});


// ═══════════════════════════════════════════════════════════
// API ENDPOINTS — KULLANICI İÇERİK İSTEKLERİ + LİSTE AKSİYONLARI
// ═══════════════════════════════════════════════════════════
app.post('/api/content-requests', async (req, res) => {
  try {
    const userId = getUserIdFromReq(req) || req.body.userId || '';
    const { title, releaseYear, note, userName, userEmail, requestType } = req.body;
    const cleanTitle = String(title || '').trim();
    if (!cleanTitle) return res.status(400).json({ error: 'Film/dizi adı zorunlu.' });
    const safeTitle = cleanTitle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const existing = await ContentRequest.findOne({ title: { $regex: '^' + safeTitle + '$', $options: 'i' }, status: 'open' });
    if (existing) { existing.voteCount = Number(existing.voteCount || 1) + 1; if(note) existing.note = String(note).trim().slice(0,1200); await existing.save(); return res.status(200).json({ success:true, request:existing, message:'İstek sayacı artırıldı' }); }
    const doc = await ContentRequest.create({ title: cleanTitle.slice(0,180), requestType: ['movie','series','documentary'].includes(requestType) ? requestType : 'unknown', releaseYear: Number(releaseYear)||undefined, note: String(note||'').trim().slice(0,1200), userId:String(userId||''), userName:String(userName||'').slice(0,120), userEmail:String(userEmail||'').slice(0,180), voteCount:1 });
    res.status(201).json({ success:true, request:doc, message:'İstek gönderildi' });
  } catch (err) { res.status(500).json({ error:'İstek gönderilemedi.' }); }
});
app.get('/api/content-requests', async (req, res) => {
  try { const filter = req.query.status ? { status:req.query.status } : {}; res.json(await ContentRequest.find(filter).sort({ createdAt:-1 }).limit(200).lean()); }
  catch (err) { res.status(500).json({ error:'İstekler yüklenemedi.' }); }
});
app.patch('/api/content-requests/:id', async (req, res) => {
  try { const status=['open','done','rejected'].includes(req.body.status)?req.body.status:'open'; const update={status}; if(status==='done') update.completedAt=new Date(); res.json(await ContentRequest.findByIdAndUpdate(req.params.id, update, {new:true})); }
  catch (err) { res.status(500).json({ error:'İstek güncellenemedi.' }); }
});
app.delete('/api/content-requests/:id', async (req, res) => {
  try { await ContentRequest.findByIdAndDelete(req.params.id); res.json({success:true,message:'İstek silindi'}); }
  catch (err) { res.status(500).json({ error:'İstek silinemedi.' }); }
});

// ═══════════════════════════════════════════════════════════
// API ENDPOINTS — SORUN RAPORLARI
// ═══════════════════════════════════════════════════════════
function isValidObjectIdLocal(id) { return !!id && mongoose.Types.ObjectId.isValid(String(id)); }
app.post('/api/reports', async (req, res) => {
  try {
    const userId = getUserIdFromReq(req) || req.body.userId || '';
    const type = ['bug', 'player', 'account', 'other'].includes(req.body.type) ? req.body.type : 'bug';
    const message = String(req.body.message || '').trim();
    if (!message) return res.status(400).json({ error: 'Rapor mesajı zorunlu.' });
    const doc = await IssueReport.create({ type, message: message.slice(0,2000), pageUrl: String(req.body.pageUrl||'').slice(0,500), userAgent: String(req.body.userAgent||'').slice(0,500), userId: String(userId||'').slice(0,120), userName: String(req.body.userName||'').slice(0,120), userEmail: String(req.body.userEmail||'').slice(0,180), contact: String(req.body.contact||'').slice(0,180), contentTitle: String(req.body.contentTitle||'').slice(0,180), seriesId: String(req.body.seriesId||'').slice(0,120), seasonNumber: Number(req.body.seasonNumber)||undefined, episodeNumber: Number(req.body.episodeNumber)||undefined, episodeId: String(req.body.episodeId||'').slice(0,120), videoUrl: String(req.body.videoUrl||'').slice(0,1200), errorType: String(req.body.errorType||'').slice(0,80), status:'open' });
    res.status(201).json({ success:true, report:doc, message:'Rapor gönderildi' });
  } catch (err) { res.status(500).json({ error:'Rapor gönderilemedi.' }); }
});
app.get('/api/reports', async (req, res) => {
  try { const status=String(req.query.status||'').trim(); const filter=status?{status}:{}; res.json(await IssueReport.find(filter).sort({createdAt:-1}).limit(300).lean()); }
  catch (err) { res.status(500).json({ error:'Raporlar yüklenemedi.' }); }
});
app.patch('/api/reports/:id', async (req, res) => {
  try { if(!isValidObjectIdLocal(req.params.id)) return res.status(400).json({ error:'Geçersiz rapor.' }); const status=['open','read','resolved'].includes(req.body.status)?req.body.status:'read'; const update={status,updatedAt:new Date()}; if(status==='resolved') update.resolvedAt=new Date(); if(status==='open') update.resolvedAt=undefined; res.json(await IssueReport.findByIdAndUpdate(req.params.id, update, {new:true})); }
  catch (err) { res.status(500).json({ error:'Rapor güncellenemedi.' }); }
});
app.delete('/api/reports/:id', async (req, res) => {
  try { if(!isValidObjectIdLocal(req.params.id)) return res.status(400).json({ error:'Geçersiz rapor.' }); await IssueReport.findByIdAndDelete(req.params.id); res.json({success:true,message:'Rapor silindi'}); }
  catch (err) { res.status(500).json({ error:'Rapor silinemedi.' }); }
});

app.post('/api/user/list-action', async (req, res) => {
  try {
    const userId = getUserIdFromReq(req) || req.body.userId;
    const { seriesId, action } = req.body;
    if (!userId || !seriesId) return res.status(400).json({ error:'Eksik bilgi.' });
    const update = { userId:String(userId), seriesId, lastWatchedAt:new Date() };
    if(action==='remove'){ update.listStatus='none'; update.isWatched=false; update.isFavorite=false; }
    if(action==='watchLater') update.listStatus='watchLater';
    if(action==='liked'){ update.listStatus='liked'; update.isFavorite=true; }
    if(action==='disliked') update.listStatus='disliked';
    if(action==='watched'){ update.listStatus='watched'; update.isWatched=true; }
    await WatchProgress.findOneAndUpdate({ userId:String(userId), seriesId }, update, { upsert:true, new:true });
    res.json({ success:true, message:'Liste güncellendi', action });
  } catch (err) { res.status(500).json({ error:'Liste işlemi başarısız.' }); }
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
    const user = new User({ email, passwordHash: hash, name: displayName, lastLoginAt: new Date(), lastActiveAt: new Date() });
    await user.save();
    const secret = ensureJwtConfigured(res);
    if (!secret) return;
    const token = signUserToken(user);
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
    user.lastLoginAt = new Date();
    user.lastActiveAt = new Date();
    await user.save();
    const secret = ensureJwtConfigured(res);
    if (!secret) return;
    const token = signUserToken(user);
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
      const secret = ensureJwtConfigured(res);
      if (!secret) return;
      const token = jwt.sign({ id: user._id, action: 'reset' }, secret, { expiresIn: '1h' });
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
    try {
      const secret = ensureJwtConfigured(res);
      if (!secret) return;
      payload = jwt.verify(token, secret);
    } catch (e) { return res.status(400).json({ error: 'Invalid or expired token', message: 'Geçersiz veya süresi dolmuş token' }); }
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
    const user = await User.findByIdAndUpdate(userId, { lastActiveAt: new Date() }, { new: true }).select('-passwordHash');
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
// FAVORITES & WATCHLIST
// ═══════════════════════════════════════════════════════════

// Add to favorites
app.post('/api/favorites/add', async (req, res) => {
  try {
    const userId = getUserIdFromReq(req);
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });
    const { seriesId } = req.body;
    const user = await User.findById(userId);
    if (!user.favorites.includes(seriesId)) user.favorites.push(seriesId);
    await user.save();
    res.json({ ok: true, message: 'Favorilere eklendi' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Remove from favorites
app.post('/api/favorites/remove', async (req, res) => {
  try {
    const userId = getUserIdFromReq(req);
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });
    const { seriesId } = req.body;
    const user = await User.findById(userId);
    user.favorites = user.favorites.filter(id => String(id) !== String(seriesId));
    await user.save();
    res.json({ ok: true, message: 'Favorilerden çıkartıldı' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get favorites
app.get('/api/favorites', async (req, res) => {
  try {
    const userId = getUserIdFromReq(req);
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });
    const user = await User.findById(userId).populate('favorites');
    res.json(user.favorites || []);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Add to watchlist
app.post('/api/watchlist/add', async (req, res) => {
  try {
    const userId = getUserIdFromReq(req);
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });
    const { seriesId } = req.body;
    const user = await User.findById(userId);
    if (!user.watchlist.includes(seriesId)) user.watchlist.push(seriesId);
    await user.save();
    res.json({ ok: true, message: 'İzlenecekler listesine eklendi' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get watchlist
app.get('/api/watchlist', async (req, res) => {
  try {
    const userId = getUserIdFromReq(req);
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });
    const user = await User.findById(userId).populate('watchlist');
    res.json(user.watchlist || []);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ═══════════════════════════════════════════════════════════
// RATING & REVIEWS
// ═══════════════════════════════════════════════════════════

// Add rating and review
app.post('/api/ratings/add', async (req, res) => {
  try {
    const userId = getUserIdFromReq(req);
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });
    const { seriesId, rating, review } = req.body;
    if (!rating || rating < 1 || rating > 5) return res.status(400).json({ error: 'Rating 1-5 arası olmalı' });
    
    let ratingDoc = await Rating.findOne({ userId, seriesId });
    if (ratingDoc) {
      ratingDoc.rating = rating;
      ratingDoc.review = review;
    } else {
      ratingDoc = new Rating({ userId, seriesId, rating, review });
    }
    await ratingDoc.save();
    
    // Update series average rating
    const ratings = await Rating.find({ seriesId });
    const avgRating = ratings.reduce((sum, r) => sum + r.rating, 0) / ratings.length;
    await Series.findByIdAndUpdate(seriesId, { rating: avgRating.toFixed(1) });
    
    res.json({ ok: true, message: 'Puanlandırıldı' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get ratings for a series
app.get('/api/ratings/:seriesId', async (req, res) => {
  try {
    const ratings = await Rating.find({ seriesId: req.params.seriesId })
      .populate('userId', 'name profilePicture')
      .sort({ createdAt: -1 });
    res.json(ratings);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ═══════════════════════════════════════════════════════════
// ADVANCED SEARCH & FILTERING
// ═══════════════════════════════════════════════════════════

// Advanced search with filters
app.get('/api/search/advanced', async (req, res) => {
  try {
    const { query, category, year, minRating, sortBy } = req.query;
    let filter = {};
    
    if (query) filter.$or = [{ title: new RegExp(query, 'i') }, { description: new RegExp(query, 'i') }];
    if (category) filter.categories = category;
    if (year) filter.releaseYear = parseInt(year);
    if (minRating) filter.rating = { $gte: parseFloat(minRating) };
    
    let query_obj = Series.find(filter);
    
    if (sortBy === 'rating') query_obj = query_obj.sort({ rating: -1 });
    else if (sortBy === 'newest') query_obj = query_obj.sort({ createdAt: -1 });
    else if (sortBy === 'popular') query_obj = query_obj.sort({ _id: -1 });
    
    const results = await query_obj.limit(50);
    res.json(results);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ═══════════════════════════════════════════════════════════
// USER PROFILE & PREFERENCES
// ═══════════════════════════════════════════════════════════

// Update user preferences (darkMode, preferredQuality)
app.put('/api/user/preferences', async (req, res) => {
  try {
    const userId = getUserIdFromReq(req);
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });
    const { darkMode, preferredQuality } = req.body;
    const user = await User.findByIdAndUpdate(userId, { darkMode, preferredQuality }, { new: true }).select('-passwordHash');
    res.json(user);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Update profile (name, profilePicture)
app.put('/api/user/profile', async (req, res) => {
  try {
    const userId = getUserIdFromReq(req);
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });
    const { name, profilePicture } = req.body;
    const user = await User.findByIdAndUpdate(userId, { name, profilePicture }, { new: true }).select('-passwordHash');
    res.json(user);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Create child profile (Parental Controls)
app.post('/api/user/profiles', async (req, res) => {
  try {
    const userId = getUserIdFromReq(req);
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });
    const { name, ageRestriction, pinCode } = req.body;
    const user = await User.findById(userId);
    user.profiles.push({ name, ageRestriction, pinCode });
    await user.save();
    res.json(user.profiles);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ═══════════════════════════════════════════════════════════
// ANALYTICS (Admin only)
// ═══════════════════════════════════════════════════════════

// Get analytics dashboard data
app.get('/api/admin/analytics', async (req, res) => {
  try {
    const userId = getUserIdFromReq(req);
    // Add admin check if needed
    
    const totalUsers = await User.countDocuments();
    const totalWatches = await WatchProgress.countDocuments();
    const totalSeries = await Series.countDocuments();
    
    const last30Days = await Analytics.find({
      date: { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) }
    }).sort({ date: -1 });
    
    const topSeries = await Series.find().sort({ rating: -1 }).limit(10);
    
    res.json({
      totalUsers,
      totalWatches,
      totalSeries,
      analytics: last30Days,
      topSeries
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Record watch event for analytics
app.post('/api/admin/analytics/watch', async (req, res) => {
  try {
    const { seriesId } = req.body;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    let analytics = await Analytics.findOne({ date: today });
    if (!analytics) analytics = new Analytics({ date: today });
    analytics.totalWatches += 1;
    await analytics.save();
    
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ═══════════════════════════════════════════════════════════
// EMAIL NOTIFICATIONS
// ═══════════════════════════════════════════════════════════

// Send notification email
app.post('/api/email/notify', async (req, res) => {
  try {
    const { userId, subject, message } = req.body;
    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ error: 'User not found' });
    
    if (process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS) {
      const transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: parseInt(process.env.SMTP_PORT || '587', 10),
        secure: process.env.SMTP_SECURE === 'true',
        auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
      });
      
      await transporter.sendMail({
        from: process.env.EMAIL_FROM || process.env.SMTP_USER,
        to: user.email,
        subject: subject,
        html: `<p>${message}</p>`
      });
      
      const log = new EmailLog({ to: user.email, subject, status: 'sent' });
      await log.save();
    }
    
    res.json({ ok: true, message: 'Email sent' });
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
  } catch (err) {
    console.warn('⚠ Başlangıçta MongoDB bağlantısı kurulamadı:', err && err.message ? err.message : err);
    console.warn('Sunucu başlatılıyor. DB bağlantı hatası olması durumunda bazı API endpointleri 503/500 dönebilir.');
  }

  app.listen(PORT, () => {
    console.log(`\n🎬 Streaming Platform Server Running on http://localhost:${PORT}`);
    console.log(`📝 Admin Panel: http://localhost:${PORT}/admin.html`);
    console.log(`🎭 Frontend: http://localhost:${PORT}/index.html\n`);
    if (typeof mongoose !== 'undefined' && mongoose.connection && mongoose.connection.readyState !== 1) {
      console.warn('⚠ MongoDB şu anda bağlı değil (readyState=' + (mongoose.connection.readyState) + ').');
    }
  });
})();

// Kategori ekle (Admin)
app.post('/kategori-ekle', async (req, res) => {
  try {
    const { name } = req.body;
    const c = new Category({ name });
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
