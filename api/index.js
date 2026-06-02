// ═══════════════════════════════════════════════════════════
// api/index.js — Vercel Serverless Function
// ═══════════════════════════════════════════════════════════

const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const multer = require("multer");
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const nodemailer = require('nodemailer');
const {
  createCorsOptions,
  securityHeaders,
  createRateLimiter,
  getJwtSecret,
  getAdminJwtSecret,
  hasAdminPasswordConfigured,
  verifyConfiguredAdminPassword,
  isSafeExternalUrl
} = require('../lib/security');
const { isConfigured: isTMDBConfigured, searchTMDB, getTMDBDetails } = require('../lib/tmdb');

const app = express();

// ───────────────────────────────────────────────────────────
// MIDDLEWARE
// ───────────────────────────────────────────────────────────
app.use(securityHeaders);
app.use(cors(createCorsOptions()));
app.use(express.json({ limit: "20mb" }));
app.use(express.urlencoded({ extended: true, limit: "20mb" }));

const strictLimiter = createRateLimiter({ windowMs: 15 * 60 * 1000, max: 40 });
const authLimiter = createRateLimiter({ windowMs: 15 * 60 * 1000, max: 12, message: 'Çok fazla giriş denemesi. Biraz sonra tekrar deneyin.' });
const reportLimiter = createRateLimiter({ windowMs: 10 * 60 * 1000, max: 10 });

app.use('/api/admin/login', authLimiter);
app.use('/api/auth/login', authLimiter);
app.use('/api/auth/register', authLimiter);
app.use('/api/auth/forgot-password', authLimiter);
app.use('/api/auth/reset-password', authLimiter);
app.use('/api/reports', reportLimiter);
app.use('/api/content-requests', reportLimiter);
app.use('/api/link-check', strictLimiter);
app.use('/api/video-proxy', createRateLimiter({ windowMs: 60 * 1000, max: 120 }));

// Use shared DB connector & centralized models
const { connectDB } = require('../lib/db');
const { Series, Season, Episode, WatchProgress, Category, Film, User, Rating, Analytics, EmailLog, ContentRequest, IssueReport, PushSubscription, Announcement, AdminLog } = require('../lib/models');


// ───────────────────────────────────────────────────────────
// AI ALTYAZI OLUŞTURUCU — OpenAI Whisper + çeviri
// Not: Büyük dizi/film dosyalarını Vercel üzerinde işlemek önerilmez.
// En iyi kullanım: küçük video klibi veya videodan çıkarılmış ses dosyası yüklemek.
// Env: OPENAI_API_KEY, OPENAI_TRANSCRIBE_MODEL=whisper-1, OPENAI_TRANSLATE_MODEL=gpt-4o-mini
// ───────────────────────────────────────────────────────────
const subtitleUploadMaxMb = Math.max(1, Number(process.env.SUBTITLE_UPLOAD_MAX_MB || 50));
const subtitleUploadMemory = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: subtitleUploadMaxMb * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const ok = String(file.mimetype || '').startsWith('audio/') || String(file.mimetype || '').startsWith('video/') || /\.(mp3|mp4|m4a|wav|webm|aac|ogg|flac)$/i.test(file.originalname || '');
    if (ok) cb(null, true);
    else cb(new Error('Sadece video veya ses dosyası yükleyin.'));
  }
});

function cleanSubtitleText(text = '') {
  return String(text || '').replace(/\r/g, '').replace(/\s+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
}

function subtitleStamp(seconds = 0, mode = 'vtt') {
  const n = Math.max(0, Number(seconds) || 0);
  const h = Math.floor(n / 3600);
  const m = Math.floor((n % 3600) / 60);
  const s = Math.floor(n % 60);
  const ms = Math.round((n - Math.floor(n)) * 1000);
  const sep = mode === 'srt' ? ',' : '.';
  return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}${sep}${String(ms).padStart(3,'0')}`;
}

function segmentsToVtt(segments = []) {
  const lines = ['WEBVTT', ''];
  segments.forEach((seg, idx) => {
    const text = cleanSubtitleText(seg.text);
    if (!text) return;
    const start = subtitleStamp(seg.start, 'vtt');
    const end = subtitleStamp(seg.end && seg.end > seg.start ? seg.end : (Number(seg.start || 0) + 3), 'vtt');
    lines.push(`${idx + 1}`, `${start} --> ${end}`, text, '');
  });
  return lines.join('\n').trim() + '\n';
}

function segmentsToSrt(segments = []) {
  const lines = [];
  segments.forEach((seg, idx) => {
    const text = cleanSubtitleText(seg.text);
    if (!text) return;
    const start = subtitleStamp(seg.start, 'srt');
    const end = subtitleStamp(seg.end && seg.end > seg.start ? seg.end : (Number(seg.start || 0) + 3), 'srt');
    lines.push(`${idx + 1}`, `${start} --> ${end}`, text, '');
  });
  return lines.join('\n').trim() + '\n';
}

function normalizeOpenAISegments(data = {}) {
  if (Array.isArray(data.segments) && data.segments.length) {
    return data.segments.map((x, i) => ({
      start: Number(x.start) || 0,
      end: Number(x.end) || (Number(x.start) || 0) + 3,
      text: cleanSubtitleText(x.text || '')
    })).filter(x => x.text);
  }
  const text = cleanSubtitleText(data.text || '');
  return text ? [{ start: 0, end: Math.max(4, Math.min(12, text.length / 12)), text }] : [];
}

function subtitleLanguageName(code = 'ar') {
  const map = { ar: 'Arabic', tr: 'Turkish', en: 'English', ja: 'Japanese', es: 'Spanish', fr: 'French', de: 'German', ru: 'Russian', zh: 'Chinese' };
  return map[String(code || '').toLowerCase()] || 'Arabic';
}

async function transcribeWithOpenAI(file, sourceLang) {
  const apiKey = String(process.env.OPENAI_API_KEY || '').trim();
  if (!apiKey) {
    const err = new Error('OPENAI_API_KEY ayarlı değil. Vercel Environment Variables içine ekleyin.');
    err.statusCode = 500;
    throw err;
  }
  const fd = new FormData();
  const safeName = String(file.originalname || 'audio.mp3').replace(/[^a-zA-Z0-9._-]/g, '_').slice(-120) || 'audio.mp3';
  fd.append('file', new Blob([file.buffer], { type: file.mimetype || 'application/octet-stream' }), safeName);
  fd.append('model', process.env.OPENAI_TRANSCRIBE_MODEL || 'whisper-1');
  fd.append('response_format', 'verbose_json');
  const lang = String(sourceLang || '').toLowerCase();
  if (lang && lang !== 'auto') fd.append('language', lang);

  const r = await fetch('https://api.openai.com/v1/audio/transcriptions', {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + apiKey },
    body: fd
  });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(data.error?.message || data.message || 'Konuşma algılama başarısız oldu.');
  return normalizeOpenAISegments(data);
}

async function translateSegmentsWithOpenAI(segments, targetLang) {
  const apiKey = String(process.env.OPENAI_API_KEY || '').trim();
  const target = subtitleLanguageName(targetLang || 'ar');
  if (!apiKey || !segments.length) return segments;
  const model = process.env.OPENAI_TRANSLATE_MODEL || 'gpt-4o-mini';
  const output = [];
  for (let i = 0; i < segments.length; i += 35) {
    const batch = segments.slice(i, i + 35);
    const payload = batch.map((seg, idx) => ({ id: idx + 1, text: seg.text }));
    const r = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + apiKey },
      body: JSON.stringify({
        model,
        temperature: 0,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: `You translate subtitle lines to ${target}. Keep names, numbers, punctuation, and line count. Return only valid JSON: {"translations":["..."]}.` },
          { role: 'user', content: JSON.stringify({ targetLanguage: target, items: payload }) }
        ]
      })
    });
    const data = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(data.error?.message || data.message || 'Altyazı çevirisi başarısız oldu.');
    let translated = [];
    try { translated = JSON.parse(data.choices?.[0]?.message?.content || '{}').translations || []; } catch (_) { translated = []; }
    batch.forEach((seg, idx) => output.push({ ...seg, text: cleanSubtitleText(translated[idx] || seg.text) }));
  }
  return output;
}

async function saveGeneratedSubtitleToEpisode(episodeId, lang, vttContent) {
  if (!episodeId) return null;
  if (!mongoose.Types.ObjectId.isValid(episodeId)) throw new Error('Geçersiz bölüm ID.');
  await connectDB();
  const episode = await Episode.findById(episodeId);
  if (!episode) throw new Error('Bölüm bulunamadı.');
  const code = String(lang || 'AR').toUpperCase();
  episode.subtitles = (episode.subtitles || []).filter(s => String(s.language).toUpperCase() !== code);
  episode.subtitles.push({ language: code, vttContent });
  await episode.save();
  return episode;
}


// ───────────────────────────────────────────────────────────
// ADMIN SECURITY — panel ve kritik API işlemleri artık token ister
// Vercel Environment Variables içine ADMIN_PASSWORD, JWT_SECRET ve ADMIN_JWT_SECRET eklenmelidir.
// Canlı ortamda varsayılan admin/JWT fallback yoktur; eksik ayar varsa işlem güvenli şekilde durur.
// ───────────────────────────────────────────────────────────
const ADMIN_API_KEY = String(process.env.ADMIN_API_KEY || '');
const ADMIN_SESSION_TTL = process.env.ADMIN_SESSION_TTL || '12h';
const adminLoginAttempts = new Map();

function getRequestIp(req) {
  return String(req.headers['x-forwarded-for'] || req.socket?.remoteAddress || 'unknown').split(',')[0].trim();
}

function getBearerToken(req) {
  const auth = String(req.headers.authorization || '');
  const match = auth.match(/^Bearer\s+(.+)$/i);
  return match ? match[1].trim() : '';
}

async function verifyAdminPassword(password) {
  return verifyConfiguredAdminPassword(password);
}

function getAdminFromRequest(req) {
  const token = getBearerToken(req);
  if (token) {
    try {
      const adminSecret = getAdminJwtSecret();
      if (!adminSecret) return null;
      const payload = jwt.verify(token, adminSecret);
      if (payload && payload.role === 'admin') return payload;
    } catch (_) {}
  }

  // Opsiyonel makine/otomasyon anahtarı. Sadece ADMIN_API_KEY ayarlanırsa çalışır.
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
  if (path === '/api/push/send') return true;

  // Yönetim içerik işlemleri
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
    const ip = getRequestIp(req);
    const now = Date.now();
    const current = adminLoginAttempts.get(ip) || { count: 0, resetAt: now + 15 * 60 * 1000 };
    if (current.resetAt < now) { current.count = 0; current.resetAt = now + 15 * 60 * 1000; }
    if (current.count >= 8) return res.status(429).json({ error: 'Çok fazla hatalı deneme. Biraz sonra tekrar deneyin.' });

    if (!hasAdminPasswordConfigured() || !getAdminJwtSecret()) {
      await writeAdminLog('admin_login_config_error', req, 'ADMIN_PASSWORD/ADMIN_JWT_SECRET eksik');
      return res.status(500).json({ error: 'Admin güvenlik ayarları eksik. Vercel Environment Variables içinde ADMIN_PASSWORD ve ADMIN_JWT_SECRET tanımlayın.' });
    }

    const ok = await verifyAdminPassword(req.body?.password);
    if (!ok) {
      current.count += 1;
      adminLoginAttempts.set(ip, current);
      await writeAdminLog('admin_login_failed', req, 'Hatalı admin şifresi');
      return res.status(401).json({ error: 'Hatalı admin şifresi.' });
    }

    adminLoginAttempts.delete(ip);
    const token = jwt.sign({ role: 'admin', mode: 'panel' }, getAdminJwtSecret(), { expiresIn: ADMIN_SESSION_TTL });
    await writeAdminLog('admin_login_success', req, 'Admin panel girişi');
    res.json({
      success: true,
      token,
      expiresIn: ADMIN_SESSION_TTL
    });
  } catch (err) {
    res.status(500).json({ error: 'Admin girişi yapılamadı.' });
  }
});

app.get('/api/admin/session', requireAdmin, async (req, res) => {
  res.json({ success: true, admin: true, mode: req.admin?.mode || 'panel' });
});

app.use((req, res, next) => {
  if (!shouldRequireAdmin(req)) return next();
  return requireAdmin(req, res, next);
});


app.post('/api/admin/subtitles/generate', subtitleUploadMemory.single('media'), async (req, res) => {
  try {
    const file = req.file;
    if (!file) return res.status(400).json({ error: 'Video veya ses dosyası seçin.' });
    const sourceLang = String(req.body.sourceLang || 'auto').toLowerCase();
    const targetLang = String(req.body.targetLang || 'ar').toLowerCase();
    const shouldTranslate = String(req.body.translate || 'true') !== 'false';
    let segments = await transcribeWithOpenAI(file, sourceLang);
    if (!segments.length) return res.status(400).json({ error: 'Konuşma algılanamadı.' });
    if (shouldTranslate) segments = await translateSegmentsWithOpenAI(segments, targetLang);
    const vttContent = segmentsToVtt(segments);
    const srtContent = segmentsToSrt(segments);
    const episodeId = String(req.body.episodeId || '').trim();
    let savedToEpisode = false;
    if (episodeId && String(req.body.saveToEpisode || 'false') === 'true') {
      await saveGeneratedSubtitleToEpisode(episodeId, targetLang, vttContent);
      savedToEpisode = true;
      await writeAdminLog('subtitle_generate_save', req, `Episode ${episodeId} için ${targetLang.toUpperCase()} altyazı oluşturuldu`);
    } else {
      await writeAdminLog('subtitle_generate', req, `${file.originalname || 'media'} için ${targetLang.toUpperCase()} altyazı oluşturuldu`);
    }
    res.json({
      success: true,
      configured: true,
      sourceLang,
      targetLang: targetLang.toUpperCase(),
      segmentCount: segments.length,
      duration: Math.max(...segments.map(s => Number(s.end) || 0)),
      savedToEpisode,
      vttContent,
      srtContent
    });
  } catch (err) {
    const status = err.statusCode || (err.message && err.message.includes('OPENAI_API_KEY') ? 500 : 400);
    res.status(status).json({ error: err.message || 'Altyazı oluşturulamadı.' });
  }
});

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

function cleanQualitySources(input) {
  if (!input) return [];
  const rows = Array.isArray(input) ? input : Object.entries(input).map(([label, url]) => ({ label, url }));
  return rows.map(q => ({
    label: String(q.label || q.quality || q.name || '').trim().slice(0, 24),
    url: String(q.url || q.src || q.videoUrl || '').trim().slice(0, 1500)
  })).filter(q => q.url && /^https?:\/\//i.test(q.url)).slice(0, 8);
}

app.post('/api/episodes/bulk', async (req, res) => {
  try {
    await connectDB();
    const { seasonId, seriesId } = req.body;
    const episodes = Array.isArray(req.body.episodes) ? req.body.episodes : [];
    if (!mongoose.Types.ObjectId.isValid(seasonId) || !mongoose.Types.ObjectId.isValid(seriesId)) return res.status(400).json({ error: 'Seri ve sezon zorunlu.' });
    if (!episodes.length) return res.status(400).json({ error: 'Eklenecek bölüm bulunamadı.' });
    const docs = episodes.map((ep, idx) => {
      const num = Number(ep.episodeNumber || ep.no || idx + 1);
      const title = String(ep.title || `Bölüm ${num}`).trim().slice(0, 180);
      const videoUrl = String(ep.videoUrl || ep.url || '').trim();
      if (!videoUrl) throw new Error(`${title} için video linki eksik.`);
      return {
        seasonId,
        seriesId,
        episodeNumber: num,
        title,
        description: String(ep.description || '').trim().slice(0, 2000),
        videoUrl: videoUrl.slice(0, 1500),
        duration: Number(ep.duration) || 0,
        thumbnail: String(ep.thumbnail || '').trim().slice(0, 1500),
        qualitySources: cleanQualitySources(ep.qualitySources || ep.qualities),
        subtitles: []
      };
    });
    const created = await Episode.insertMany(docs, { ordered: true });
    if (process.env.PUSH_ON_NEW_CONTENT !== 'false') {
      const series = await Series.findById(seriesId).select('title poster tmdbPoster').lean().catch(() => null);
      await safePush({
        title: 'Yeni bölüm eklendi',
        body: `${series?.title || 'QasimFlix'} için ${created.length} yeni bölüm yayında.`,
        url: `/?content=${seriesId}`,
        icon: series?.poster || series?.tmdbPoster || '/assets/icons/icon-192.png'
      });
    }
    res.status(201).json({ success: true, count: created.length, episodes: created });
  } catch (err) { res.status(500).json({ error: err.message || 'Toplu bölüm eklenemedi.' }); }
});

app.get('/api/admin/link-scan', async (req, res) => {
  try {
    await connectDB();
    const status = String(req.query.status || '').trim();
    const filter = status ? { linkStatus: status } : {};
    const [counts, items] = await Promise.all([
      Episode.aggregate([{ $group: { _id: '$linkStatus', count: { $sum: 1 } } }]).catch(() => []),
      Episode.find(filter).sort({ lastLinkCheckAt: 1, createdAt: -1 }).limit(Number(req.query.limit) || 150).select('title episodeNumber videoUrl linkStatus lastLinkCheckAt seriesId seasonId').lean()
    ]);
    res.json({ counts, items });
  } catch (err) { res.status(500).json({ error: 'Link raporu yüklenemedi.' }); }
});

app.post('/api/admin/link-scan', async (req, res) => {
  try {
    await connectDB();
    const limit = Math.max(1, Math.min(Number(req.body.limit || req.query.limit || 30), 80));
    const onlyUnknown = req.body.onlyUnknown === true || req.query.onlyUnknown === '1';
    const filter = onlyUnknown ? { $or: [{ linkStatus: 'unknown' }, { linkStatus: { $exists: false } }, { lastLinkCheckAt: { $exists: false } }] } : {};
    const episodes = await Episode.find(filter).sort({ lastLinkCheckAt: 1, createdAt: -1 }).limit(limit).lean();
    const results = [];
    for (const ep of episodes) {
      const check = await checkOneVideoLink(ep.videoUrl);
      await Episode.findByIdAndUpdate(ep._id, { linkStatus: check.status, lastLinkCheckAt: new Date() });
      results.push({ _id: ep._id, title: ep.title, episodeNumber: ep.episodeNumber, videoUrl: ep.videoUrl, ...check });
    }
    res.json({ success: true, scanned: results.length, results });
  } catch (err) { res.status(500).json({ error: err.message || 'Link taraması başarısız.' }); }
});

app.get('/api/admin/stats', async (req, res) => {
  try {
    await connectDB();
    const now = new Date();
    const activeCutoff = new Date(Date.now() - 15 * 60 * 1000);
    const dailyCutoff = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const [summary, topWatched, topRated, badLinks, latestReports, latestRequests] = await Promise.all([
      Promise.all([
        Series.countDocuments(),
        Series.countDocuments({type:'movie'}),
        Season.countDocuments(),
        Episode.countDocuments(),
        User.countDocuments().catch(()=>0),
        User.countDocuments({ $or: [{ lastActiveAt: { $gte: activeCutoff } }, { lastLoginAt: { $gte: activeCutoff } }] }).catch(()=>0),
        User.countDocuments({ createdAt: { $gte: dailyCutoff } }).catch(()=>0),
        User.countDocuments({ $or: [{ lastActiveAt: { $gte: dailyCutoff } }, { lastLoginAt: { $gte: dailyCutoff } }] }).catch(()=>0),
        WatchProgress.countDocuments().catch(()=>0),
        PushSubscription.countDocuments().catch(()=>0),
        PushSubscription.countDocuments({ lastSeenAt: { $gte: dailyCutoff } }).catch(()=>0),
        IssueReport.countDocuments({status:'open'}),
        ContentRequest.countDocuments({status:'open'})
      ]),
      WatchProgress.aggregate([{ $group: { _id: '$seriesId', watches: { $sum: 1 }, lastWatchedAt: { $max: '$lastWatchedAt' } } }, { $sort: { watches: -1 } }, { $limit: 8 }, { $lookup: { from: 'series', localField: '_id', foreignField: '_id', as: 'series' } }, { $unwind: '$series' }, { $project: { watches: 1, lastWatchedAt: 1, title: '$series.title', poster: '$series.poster', type: '$series.type' } }]).catch(()=>[]),
      Series.find().sort({ rating: -1, createdAt: -1 }).limit(8).select('title rating type poster releaseYear').lean(),
      Episode.countDocuments({ linkStatus: { $in: ['broken','access_denied','empty'] } }).catch(()=>0),
      IssueReport.find({ status: 'open' }).sort({ createdAt: -1 }).limit(5).lean(),
      ContentRequest.find({ status: 'open' }).sort({ voteCount: -1, createdAt: -1 }).limit(5).lean()
    ]);
    const [totalSeries, totalMovies, totalSeasons, totalEpisodes, totalUsers, activeUsers, newUsersToday, activeUsersToday, totalWatches, totalPushSubscribers, activePushSubscribers, openReports, openRequests] = summary;
    res.json({
      totalSeries, totalMovies, totalSeasons, totalEpisodes, totalUsers,
      activeUsers, newUsersToday, activeUsersToday, totalWatches, totalPushSubscribers, activePushSubscribers,
      openReports, openRequests, badLinks, topWatched, topRated, latestReports, latestRequests,
      generatedAt: now.toISOString()
    });
  } catch (err) { res.status(500).json({ error: 'İstatistikler yüklenemedi.' }); }
});

app.post('/api/admin/security-log', async (req, res) => {
  try {
    await connectDB();
    const doc = await AdminLog.create({
      action: String(req.body.action || 'admin_event').slice(0, 80),
      detail: String(req.body.detail || '').slice(0, 800),
      ip: String(req.headers['x-forwarded-for'] || req.socket?.remoteAddress || '').slice(0, 120),
      userAgent: String(req.headers['user-agent'] || '').slice(0, 400)
    });
    res.status(201).json({ success: true, log: doc });
  } catch (err) { res.json({ success: false }); }
});

app.get('/api/admin/security-log', async (req, res) => {
  try { await connectDB(); res.json(await AdminLog.find().sort({ createdAt: -1 }).limit(100).lean()); }
  catch (err) { res.status(500).json({ error: 'Güvenlik kayıtları yüklenemedi.' }); }
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
    if (doc.isActive && process.env.PUSH_ON_ANNOUNCEMENT !== 'false') {
      doc._pushResult = await safePush({ title: doc.title, body: doc.message, url: '/' });
    }
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


// ───────────────────────────────────────────────────────────
// GERÇEK PUSH BİLDİRİM GÖNDERİMİ — opsiyonel FCM server key ile çalışır
// Vercel Environment Variables içine FIREBASE_SERVER_KEY eklenirse
// admin panelinden/otomatik içerik eklemeden kayıtlı cihazlara bildirim gider.
// ───────────────────────────────────────────────────────────
async function sendQasimPush(payload = {}) {
  const serverKey = String(process.env.FIREBASE_SERVER_KEY || process.env.FCM_SERVER_KEY || '').trim();
  if (!serverKey) return { sent: false, configured: false, message: 'FIREBASE_SERVER_KEY ayarlı değil.' };

  const title = String(payload.title || 'QasimFlix').slice(0, 120);
  const body = String(payload.body || 'Yeni bir güncelleme var.').slice(0, 240);
  const url = String(payload.url || '/').slice(0, 500);
  const icon = String(payload.icon || '/assets/icons/icon-192.png').slice(0, 500);
  const tokens = await PushSubscription.find({ token: { $exists: true, $ne: '' } }).sort({ lastSeenAt: -1 }).limit(1000).select('token').lean();
  const allTokens = [...new Set(tokens.map(x => String(x.token || '').trim()).filter(Boolean))];
  if (!allTokens.length) return { sent: false, configured: true, total: 0, message: 'Kayıtlı bildirim cihazı yok.' };

  let success = 0;
  let failure = 0;
  const invalidTokens = [];
  for (let i = 0; i < allTokens.length; i += 500) {
    const registration_ids = allTokens.slice(i, i + 500);
    const resp = await fetch('https://fcm.googleapis.com/fcm/send', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'key=' + serverKey
      },
      body: JSON.stringify({
        registration_ids,
        priority: 'high',
        notification: { title, body, icon, click_action: url },
        data: { title, body, url, icon }
      })
    });
    const data = await resp.json().catch(() => ({}));
    if (!resp.ok) throw new Error(data.error || data.message || 'FCM gönderimi başarısız.');
    success += Number(data.success || 0);
    failure += Number(data.failure || 0);
    (data.results || []).forEach((item, idx) => {
      const err = item && item.error;
      if (err === 'NotRegistered' || err === 'InvalidRegistration') invalidTokens.push(registration_ids[idx]);
    });
  }
  if (invalidTokens.length) await PushSubscription.deleteMany({ token: { $in: invalidTokens } }).catch(() => null);
  return { sent: true, configured: true, total: allTokens.length, success, failure, invalidRemoved: invalidTokens.length };
}

async function safePush(payload) {
  try { return await sendQasimPush(payload); }
  catch (err) { console.warn('Push gönderimi başarısız:', err.message); return { sent: false, error: err.message }; }
}

// ───────────────────────────────────────────────────────────
// PUSH TOKEN KAYDI — bildirim izni açılınca FCM token saklar
// ───────────────────────────────────────────────────────────
app.post('/api/push/subscribe', async (req, res) => {
  try {
    await connectDB();
    const token = String(req.body.token || '').trim();
    if (!token) return res.status(400).json({ error: 'Token gerekli.' });
    const userId = getUserIdFromReq(req) || req.body.userId || '';
    const doc = await PushSubscription.findOneAndUpdate(
      { token },
      {
        token,
        platform: String(req.body.platform || 'web').slice(0, 40),
        userId: String(userId || '').slice(0, 120),
        userName: String(req.body.userName || '').slice(0, 120),
        userEmail: String(req.body.userEmail || '').slice(0, 180),
        userAgent: String(req.headers['user-agent'] || '').slice(0, 500),
        lastSeenAt: new Date()
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
    res.json({ success: true, id: doc._id });
  } catch (err) {
    res.status(500).json({ error: 'Bildirim token kaydedilemedi.' });
  }
});

app.post('/api/push/send', requireAdmin, async (req, res) => {
  try {
    await connectDB();
    const title = String(req.body?.title || 'QasimFlix').trim();
    const body = String(req.body?.body || req.body?.message || '').trim();
    if (!body) return res.status(400).json({ error: 'Bildirim mesajı gerekli.' });
    const result = await sendQasimPush({ title, body, url: req.body?.url || '/', icon: req.body?.icon || '/assets/icons/icon-192.png' });
    await writeAdminLog('push_send', req, `${title}: ${body}`);
    res.json({ success: true, result });
  } catch (err) {
    res.status(500).json({ error: err.message || 'Bildirim gönderilemedi.' });
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
    const safe = isSafeExternalUrl(targetUrl, { allowHttp: false });
    if (!safe.ok) {
      return res.status(400).send(safe.reason || 'Sadece güvenli HTTPS video linkleri desteklenir');
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
      Series.find(query).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
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


// En son eklenen içerik: APK/PWA yeni içerik bildirimi için kullanılır.
app.get('/api/content/latest', async (req, res) => {
  try {
    const [latestSeries, latestEpisode] = await Promise.all([
      Series.findOne({}).sort({ createdAt: -1 }).lean(),
      Episode.findOne({}).sort({ createdAt: -1 }).populate('seriesId', 'title type poster').lean()
    ]);

    if (!latestSeries && !latestEpisode) return res.json({ content: null });

    const seriesTime = latestSeries?.createdAt ? new Date(latestSeries.createdAt).getTime() : 0;
    const episodeTime = latestEpisode?.createdAt ? new Date(latestEpisode.createdAt).getTime() : 0;

    const latestEpisodeSeriesId = latestEpisode?.seriesId?._id ? String(latestEpisode.seriesId._id) : String(latestEpisode?.seriesId || '');
    const sameFreshSeries = latestSeries && latestEpisode && latestEpisodeSeriesId === String(latestSeries._id) && Math.abs(episodeTime - seriesTime) < 120000;

    if (latestEpisode && episodeTime >= seriesTime && !sameFreshSeries) {
      return res.json({
        content: {
          kind: 'episode',
          _id: String(latestEpisode._id),
          title: latestEpisode.title,
          episodeNumber: latestEpisode.episodeNumber,
          seriesId: latestEpisodeSeriesId,
          seriesTitle: latestEpisode.seriesId?.title || '',
          type: latestEpisode.seriesId?.type || 'series',
          poster: latestEpisode.seriesId?.poster || latestEpisode.thumbnail || '',
          createdAt: latestEpisode.createdAt
        }
      });
    }

    res.json({
      content: {
        kind: 'series',
        _id: String(latestSeries._id),
        title: latestSeries.title,
        type: latestSeries.type,
        poster: latestSeries.poster || '',
        createdAt: latestSeries.createdAt
      }
    });
  } catch (err) {
    res.status(500).json({ error: 'Son içerik bilgisi alınamadı.' });
  }
});

// ───────────────────────────────────────────────────────────
// ÖNEMLİ: search/category rotaları /api/series/:id rotasından önce durmalı.
// Aksi halde "search" ve "category" kelimeleri ObjectId sanılıp CastError verir.
// ───────────────────────────────────────────────────────────
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
        { description_tr: { $regex: query, $options: 'i' } },
        { description_ar: { $regex: query, $options: 'i' } },
        { categories: { $regex: query, $options: 'i' } },
        { type: { $regex: query, $options: 'i' } },
        ...(Number.isFinite(Number(query)) ? [{ releaseYear: Number(query) }] : [])
      ]
    }).limit(30).lean();
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
    }).limit(30).lean();
    res.json(series);
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
    const { title, description, description_tr, description_ar, poster, banner, categories = [], releaseYear, rating, type, videoUrl, duration, tmdbId, tmdbType, originalTitle, trailerUrl, cast, tmdbPoster, tmdbBackdrop, qualitySources } = req.body;

    // If content is marked as 'yerli' (local), ensure it belongs to the "Yerli Diziler" category
    const cats = Array.isArray(categories) ? categories.slice() : (typeof categories === 'string' ? categories.split(',').map(c=>c.trim()).filter(Boolean) : []);
    if (type === 'yerli' && !cats.some(c => c.toLowerCase() === 'yerli diziler')) {
      cats.push('Yerli Diziler');
    }

    const newSeries = new Series({ title, description, description_tr, description_ar, poster, banner, categories: cats, releaseYear, rating, type, tmdbId, tmdbType, originalTitle, trailerUrl, cast: Array.isArray(cast) ? cast : [], tmdbPoster, tmdbBackdrop });
    const saved = await newSeries.save();

    // Film ise otomatik Sezon 1 ve Bölüm 1 oluştur
    if ((type === 'movie') && videoUrl) {
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
        qualitySources: cleanQualitySources(qualitySources),
        subtitles: []
      });
      await episode.save();
    }

    if (process.env.PUSH_ON_NEW_CONTENT !== 'false') {
      saved._pushResult = await safePush({
        title: 'QasimFlix’e yeni içerik eklendi',
        body: `${saved.title} şimdi yayında.`,
        url: `/?content=${saved._id}`,
        icon: saved.poster || saved.tmdbPoster || '/assets/icons/icon-192.png'
      });
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
    const { seasonId, seriesId, episodeNumber, title, description, videoUrl, duration, thumbnail, qualitySources } = req.body;
    const newEpisode = new Episode({ seasonId, seriesId, episodeNumber, title, description, videoUrl, duration, thumbnail, qualitySources: cleanQualitySources(qualitySources), subtitles: [] });
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
    const body = { ...req.body };
    if (body.qualitySources !== undefined) body.qualitySources = cleanQualitySources(body.qualitySources);
    const updated = await Episode.findByIdAndUpdate(req.params.id, body, { new: true });
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

function isValidObjectId(id) {
  return !!id && mongoose.Types.ObjectId.isValid(String(id));
}

app.post("/api/progress", async (req, res) => {
  try {
    const userId = getUserIdFromReq(req) || req.body.userId;
    const { seriesId, episodeId, progress } = req.body;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });
    if (!isValidObjectId(seriesId) || !isValidObjectId(episodeId)) {
      return res.status(400).json({ error: 'Geçersiz içerik bilgisi.' });
    }
    const updated = await WatchProgress.findOneAndUpdate(
      { userId: String(userId), episodeId },
      { userId: String(userId), seriesId, episodeId, progress: Number(progress) || 0, lastWatchedAt: new Date() },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: 'İzleme geçmişi kaydedilemedi.' });
  }
});

// /continue/me ve /continue/:userId, /:userId/:episodeId rotasından ÖNCE durmalı.
app.get("/api/progress/continue/me", async (req, res) => {
  try {
    const userId = getUserIdFromReq(req);
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });
    const recentWatches = await WatchProgress.find({ userId: String(userId) })
      .sort({ lastWatchedAt: -1 }).limit(10)
      .populate("seriesId").populate("episodeId");
    res.json(recentWatches);
  } catch (err) {
    res.status(500).json({ error: 'İzleme geçmişi yüklenemedi.' });
  }
});

app.get("/api/progress/continue/:userId", async (req, res) => {
  try {
    const recentWatches = await WatchProgress.find({ userId: String(req.params.userId) })
      .sort({ lastWatchedAt: -1 }).limit(10)
      .populate("seriesId").populate("episodeId");
    res.json(recentWatches);
  } catch (err) {
    res.status(500).json({ error: 'İzleme geçmişi yüklenemedi.' });
  }
});

app.get("/api/progress/me/:episodeId", async (req, res) => {
  try {
    const userId = getUserIdFromReq(req);
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });
    if (!isValidObjectId(req.params.episodeId)) return res.json({ progress: 0 });
    const progress = await WatchProgress.findOne({ userId: String(userId), episodeId: req.params.episodeId });
    res.json(progress || { progress: 0 });
  } catch (err) {
    res.status(500).json({ error: 'İzleme geçmişi yüklenemedi.' });
  }
});

app.get("/api/progress/:userId/:episodeId", async (req, res) => {
  try {
    if (!isValidObjectId(req.params.episodeId)) return res.json({ progress: 0 });
    const progress = await WatchProgress.findOne({
      userId: String(req.params.userId),
      episodeId: req.params.episodeId
    });
    res.json(progress || { progress: 0 });
  } catch (err) {
    res.status(500).json({ error: 'İzleme geçmişi yüklenemedi.' });
  }
});



// ═══════════════════════════════════════════════════════════
// API ENDPOINTS — KİŞİSEL ÖNERİLER
// ═══════════════════════════════════════════════════════════
// Viewing stats tracker (frontend sends lightweight watch events here)
app.post('/api/viewing-stats', async (req, res) => {
  try {
    const userId = getUserIdFromReq(req);
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const hour = new Date().getHours();

    await Analytics.findOneAndUpdate(
      { date: today },
      {
        $inc: { totalWatches: 1, [`watchHeatmap.${hour}`]: (req.body && req.body.duration) ? Number(req.body.duration) || 1 : 1 },
        $setOnInsert: { totalUsers: 0, uniqueViewers: 0 }
      },
      { upsert: true, new: true }
    ).catch(() => null);

    const seriesId = req.body?.seriesId;
    const episodeId = req.body?.episodeId;
    if (seriesId && episodeId) {
      await WatchProgress.findOneAndUpdate(
        { userId, episodeId },
        {
          userId,
          seriesId,
          episodeId,
          lastWatchedAt: new Date(),
          progress: Number(req.body?.duration) || 0
        },
        { upsert: true, new: true, setDefaultsOnInsert: true }
      ).catch(() => null);
    }

    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message || 'İzleme istatistiği kaydedilemedi.' });
  }
});

app.get('/api/recommendations/:userId', async (req, res) => {
  try {
    await connectDB();
    const userId = String(req.params.userId || req.query.userId || 'guest');
    const progress = await WatchProgress.find({ userId, seriesId: { $ne: null } }).sort({ lastWatchedAt: -1 }).limit(40).populate('seriesId').lean().catch(() => []);
    const watchedIds = new Set(progress.map(p => String(p.seriesId?._id || p.seriesId)).filter(Boolean));
    const categories = [];
    progress.forEach(p => (p.seriesId?.categories || []).forEach(c => categories.push(c)));
    const categoryFilter = categories.length ? { categories: { $in: categories } } : {};
    let items = await Series.find({ _id: { $nin: Array.from(watchedIds) }, ...categoryFilter }).sort({ rating: -1, createdAt: -1 }).limit(12).lean();
    if (items.length < 8) {
      const more = await Series.find({ _id: { $nin: [...Array.from(watchedIds), ...items.map(x => String(x._id))] } }).sort({ rating: -1, createdAt: -1 }).limit(12 - items.length).lean();
      items = items.concat(more);
    }
    res.json(items);
  } catch (err) { res.json([]); }
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



// Gelişmiş genel arama — film, dizi, bölüm, tür, yıl, açıklama
app.get('/api/search/full', async (req, res) => {
  try {
    const q = String(req.query.q || '').trim();
    if (!q) return res.json([]);
    const rx = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
    const year = Number(q);
    const seriesMatches = await Series.find({
      $or: [
        { title: rx }, { description: rx }, { description_tr: rx }, { description_ar: rx },
        { categories: rx }, { type: rx },
        ...(Number.isFinite(year) ? [{ releaseYear: year }] : [])
      ]
    }).limit(40).lean();

    const episodeMatches = await Episode.find({
      $or: [{ title: rx }, { description: rx }, ...(Number.isFinite(year) ? [{ duration: year }] : [])]
    }).limit(40).populate('seriesId').lean();

    const map = new Map();
    for (const s of seriesMatches) map.set(String(s._id), { ...s, matchType: 'series' });
    for (const ep of episodeMatches) {
      const s = ep.seriesId;
      if (!s || !s._id) continue;
      const key = String(s._id);
      const item = map.get(key) || { ...s, matchType: 'episode', matchedEpisodes: [] };
      item.matchedEpisodes = item.matchedEpisodes || [];
      item.matchedEpisodes.push({ _id: ep._id, title: ep.title, episodeNumber: ep.episodeNumber, duration: ep.duration });
      item.matchType = item.matchType === 'series' ? 'series+episode' : 'episode';
      map.set(key, item);
    }
    res.json([...map.values()].slice(0, 60));
  } catch (err) {
    res.status(500).json({ error: 'Arama yapılamadı.' });
  }
});


// Advanced search with filters (Vercel canlı endpoint)
app.get('/api/search/advanced', async (req, res) => {
  try {
    const { query, category, year, minRating, sortBy, type } = req.query;
    const filter = {};

    if (query) {
      const safeQuery = String(query).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const rx = new RegExp(safeQuery, 'i');
      filter.$or = [{ title: rx }, { description: rx }, { originalTitle: rx }];
    }
    if (category) filter.categories = String(category);
    if (type) filter.type = String(type);
    if (year) filter.releaseYear = parseInt(year, 10);
    if (minRating) filter.rating = { $gte: parseFloat(minRating) };

    let q = Series.find(filter);
    if (sortBy === 'rating') q = q.sort({ rating: -1, createdAt: -1 });
    else if (sortBy === 'newest') q = q.sort({ createdAt: -1 });
    else if (sortBy === 'popular') q = q.sort({ rating: -1, createdAt: -1 });
    else q = q.sort({ createdAt: -1 });

    const results = await q.limit(60).lean();
    res.json(results);
  } catch (err) {
    res.status(500).json({ error: err.message || 'Gelişmiş arama başarısız.' });
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


// Email helper for password reset (works on Vercel serverless)
async function sendResetEmail(toEmail, token) {
  const appUrl = (process.env.APP_URL || process.env.PUBLIC_APP_URL || 'https://qasim-flixv2-swnm.vercel.app').replace(/\/$/, '');
  const resetLink = `${appUrl}/auth?resetToken=${encodeURIComponent(token)}`;

  // If SMTP is not configured, do not crash the password reset request.
  // On production you must add SMTP_HOST, SMTP_USER, SMTP_PASS in Vercel for real email delivery.
  if (!process.env.SMTP_HOST || !process.env.SMTP_USER || !process.env.SMTP_PASS) {
    console.warn('SMTP ayarlı değil. Reset link mail olarak gönderilemedi:', resetLink);
    return { sent: false, resetLink };
  }

  const smtpPort = parseInt(process.env.SMTP_PORT || '587', 10);
  const smtpUser = String(process.env.SMTP_USER || '').trim();
  const smtpPass = String(process.env.SMTP_PASS || '').replace(/\s+/g, '');

  const transporter = nodemailer.createTransport({
    host: String(process.env.SMTP_HOST || '').trim(),
    port: smtpPort,
    secure: process.env.SMTP_SECURE === 'true' || smtpPort === 465,
    auth: { user: smtpUser, pass: smtpPass }
  });

  await transporter.verify();

  await transporter.sendMail({
    from: process.env.EMAIL_FROM || smtpUser,
    to: toEmail,
    subject: 'QasimFlix şifre sıfırlama bağlantısı',
    html: `
      <div style="font-family:Arial,sans-serif;background:#111;color:#fff;padding:24px;border-radius:12px">
        <h2 style="margin-top:0">Şifre sıfırlama</h2>
        <p>Şifrenizi yenilemek için aşağıdaki bağlantıya tıklayın. Bağlantı 1 saat geçerlidir.</p>
        <p><a href="${resetLink}" style="display:inline-block;background:#e50914;color:#fff;padding:12px 18px;border-radius:8px;text-decoration:none">Şifremi yenile</a></p>
        <p style="color:#aaa;font-size:13px">Buton çalışmazsa bu bağlantıyı tarayıcıya yapıştırın:<br>${resetLink}</p>
      </div>
    `
  });

  return { sent: true, resetLink };
}

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

// Admin analytics compatibility endpoint
app.get('/api/admin/analytics', async (req, res) => {
  try {
    await connectDB();
    const [totalUsers, totalWatches, totalSeries, last30Days, topSeries] = await Promise.all([
      User.countDocuments().catch(() => 0),
      WatchProgress.countDocuments().catch(() => 0),
      Series.countDocuments().catch(() => 0),
      Analytics.find({ date: { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) } }).sort({ date: -1 }).lean().catch(() => []),
      Series.find().sort({ rating: -1, createdAt: -1 }).limit(10).lean().catch(() => [])
    ]);
    res.json({ totalUsers, totalWatches, totalSeries, analytics: last30Days, topSeries });
  } catch (err) {
    res.status(500).json({ error: err.message || 'Analytics yüklenemedi.' });
  }
});

app.post('/api/admin/analytics/watch', async (req, res) => {
  try {
    await connectDB();
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const update = { $inc: { totalWatches: 1 } };
    if (req.body?.seriesId) update.$set = { mostWatchedSeries: req.body.seriesId };
    await Analytics.findOneAndUpdate({ date: today }, update, { upsert: true, new: true });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message || 'Watch analytics kaydedilemedi.' });
  }
});

// Admin email notification endpoint (SMTP varsa gönderir, yoksa güvenli şekilde no-op döner)
app.post('/api/email/notify', async (req, res) => {
  try {
    await connectDB();
    const { userId, subject, message } = req.body || {};
    if (!userId || !subject || !message) return res.status(400).json({ error: 'userId, subject ve message gerekli.' });
    const user = await User.findById(userId).lean();
    if (!user) return res.status(404).json({ error: 'Kullanıcı bulunamadı.' });

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
        subject: String(subject).slice(0, 180),
        html: `<p>${String(message).replace(/[<>]/g, '')}</p>`
      });
      await EmailLog.create({ to: user.email, subject: String(subject).slice(0, 180), status: 'sent' }).catch(() => null);
      return res.json({ ok: true, sent: true });
    }

    await EmailLog.create({ to: user.email, subject: String(subject).slice(0, 180), status: 'failed' }).catch(() => null);
    res.json({ ok: true, sent: false, message: 'SMTP ayarlı değil; e-posta gönderilmedi ama işlem kaydedildi.' });
  } catch (err) {
    res.status(500).json({ error: err.message || 'E-posta gönderilemedi.' });
  }
});


function ensureJwtConfigured(res) {
  const secret = getJwtSecret();
  if (!secret) {
    res.status(500).json({ error: 'JWT_SECRET eksik. Vercel Environment Variables içinde tanımlayın.' });
    return '';
  }
  return secret;
}


function decodeJwtPart(token, partIndex) {
  const part = String(token || '').split('.')[partIndex];
  if (!part) return {};
  const normalized = part.replace(/-/g, '+').replace(/_/g, '/');
  return JSON.parse(Buffer.from(normalized, 'base64').toString('utf8'));
}

let firebaseCertCache = { expiresAt: 0, certs: null };
async function getFirebaseCert(kid) {
  const now = Date.now();
  if (!firebaseCertCache.certs || firebaseCertCache.expiresAt < now) {
    const resp = await fetch('https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com');
    if (!resp.ok) throw new Error('Firebase sertifikaları alınamadı.');
    const cacheControl = resp.headers.get('cache-control') || '';
    const maxAge = Number((cacheControl.match(/max-age=(\d+)/) || [])[1] || 3600);
    firebaseCertCache = { certs: await resp.json(), expiresAt: now + Math.max(300, maxAge - 60) * 1000 };
  }
  const cert = firebaseCertCache.certs && firebaseCertCache.certs[kid];
  if (!cert) throw new Error('Firebase token sertifikası bulunamadı.');
  return cert;
}

async function verifyFirebaseIdToken(idToken) {
  const projectId = String(process.env.FIREBASE_PROJECT_ID || 'qasimflix-8ba04').trim();
  if (!projectId) throw new Error('FIREBASE_PROJECT_ID eksik.');
  const header = decodeJwtPart(idToken, 0);
  const cert = await getFirebaseCert(header.kid);
  return jwt.verify(idToken, cert, {
    algorithms: ['RS256'],
    audience: projectId,
    issuer: `https://securetoken.google.com/${projectId}`
  });
}

function signUserToken(user) {
  return jwt.sign({ id: user._id, email: user.email }, getJwtSecret(), { expiresIn: '30d' });
}


app.post('/api/auth/google', async (req, res) => {
  try {
    await connectDB();
    const idToken = String(req.body?.idToken || '').trim();
    if (!idToken) return res.status(400).json({ error: 'Firebase ID token gerekli.', message: 'Google giriş tokenı alınamadı.' });

    const payload = await verifyFirebaseIdToken(idToken);
    const firebaseUid = String(payload.user_id || payload.sub || '').trim();
    const email = String(payload.email || '').trim().toLowerCase();
    const name = String(payload.name || req.body?.name || 'Google Kullanıcısı').trim().slice(0, 120);
    const profilePicture = String(payload.picture || req.body?.profilePicture || '').trim().slice(0, 1000);
    if (!firebaseUid || !email) return res.status(400).json({ error: 'Firebase kullanıcı bilgisi eksik.', message: 'Google hesabından e-posta alınamadı.' });

    let user = await User.findOne({ $or: [{ firebaseUid }, { email }] });
    if (!user) {
      user = new User({ email, name, profilePicture, firebaseUid, authProvider: 'google', emailVerified: !!payload.email_verified, lastLoginAt: new Date(), lastActiveAt: new Date() });
    } else {
      user.firebaseUid = firebaseUid;
      user.authProvider = user.authProvider || 'google';
      user.emailVerified = user.emailVerified || !!payload.email_verified;
      user.lastLoginAt = new Date();
      user.lastActiveAt = new Date();
      if (name && (!user.name || user.name === user.email)) user.name = name;
      if (profilePicture && !user.profilePicture) user.profilePicture = profilePicture;
    }
    await user.save();

    const secret = ensureJwtConfigured(res);
    if (!secret) return;
    const token = signUserToken(user);
    res.json({ token, user: { _id: user._id, email: user.email, name: user.name, profilePicture: user.profilePicture, authProvider: user.authProvider } });
  } catch (err) {
    console.error('google auth error:', err);
    res.status(401).json({ error: 'Google giriş doğrulanamadı.', message: err.message || 'Google giriş doğrulanamadı.' });
  }
});

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


app.post('/api/auth/forgot-password', async (req, res) => {
  try {
    const email = String(req.body?.email || '').trim().toLowerCase();
    if (!email) return res.status(400).json({ error: 'Email required', message: 'E-posta gerekli' });

    const user = await User.findOne({ email });

    // Güvenlik için e-posta kayıtlı değilse bile aynı mesajı döndür.
    if (user) {
      const secret = ensureJwtConfigured(res);
      if (!secret) return;
      const token = jwt.sign({ id: user._id, action: 'reset-password' }, secret, { expiresIn: '1h' });
      user.resetToken = token;
      user.resetTokenExpiry = new Date(Date.now() + 60 * 60 * 1000);
      await user.save();
      await sendResetEmail(email, token);
    }

    res.json({ success: true, message: 'Eğer e-posta kayıtlıysa şifre sıfırlama bağlantısı gönderildi.' });
  } catch (err) {
    console.error('forgot-password error:', err);
    res.status(500).json({ error: 'Password reset failed', message: 'Şifre sıfırlama bağlantısı gönderilemedi.' });
  }
});

app.post('/api/auth/reset-password', async (req, res) => {
  try {
    const token = String(req.body?.token || '').trim();
    const password = String(req.body?.password || '');
    const passwordConfirm = String(req.body?.passwordConfirm || '');

    if (!token || !password) return res.status(400).json({ error: 'Token and password required', message: 'Token ve yeni şifre gerekli' });
    if (password.length < 6) return res.status(400).json({ error: 'Password too short', message: 'Şifre en az 6 karakter olmalıdır' });
    if (passwordConfirm && password !== passwordConfirm) return res.status(400).json({ error: 'Passwords do not match', message: 'Şifreler eşleşmiyor' });

    let payload;
    try {
      const secret = ensureJwtConfigured(res);
      if (!secret) return;
      payload = jwt.verify(token, secret);
    } catch (e) {
      return res.status(400).json({ error: 'Invalid or expired token', message: 'Bağlantı geçersiz veya süresi dolmuş.' });
    }

    const user = await User.findOne({
      _id: payload.id,
      resetToken: token,
      resetTokenExpiry: { $gt: new Date() }
    });

    if (!user) return res.status(400).json({ error: 'Invalid or expired token', message: 'Bağlantı geçersiz veya süresi dolmuş.' });

    user.passwordHash = await bcrypt.hash(password, 10);
    user.resetToken = undefined;
    user.resetTokenExpiry = undefined;
    await user.save();

    res.json({ success: true, message: 'Şifre başarıyla yenilendi. Şimdi giriş yapabilirsiniz.' });
  } catch (err) {
    console.error('reset-password error:', err);
    res.status(500).json({ error: 'Reset failed', message: 'Şifre yenilenemedi.' });
  }
});

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

// ═══════════════════════════════════════════════════════════
// API ENDPOINTS — KULLANICI KAYIT / FAVORİ / İZLENECEKLER
// ═══════════════════════════════════════════════════════════

app.post('/api/user/saved', async (req, res) => {
  try {
    const userId = getUserIdFromReq(req);
    if (!userId) return res.status(401).json({ error: 'Lütfen önce giriş yapın.' });
    const { type, itemId } = req.body;
    if (!isValidObjectId(itemId)) return res.status(400).json({ error: 'Geçersiz içerik bilgisi.' });
    const field = type === 'film' ? 'savedFilms' : 'savedSeries';
    await User.findByIdAndUpdate(userId, { $addToSet: { [field]: itemId } }, { new: true });
    res.json({ success: true, message: 'Kaydedildi' });
  } catch (err) {
    res.status(500).json({ error: 'Kaydetme işlemi başarısız.' });
  }
});

app.post('/api/favorites/add', async (req, res) => {
  try {
    const userId = getUserIdFromReq(req);
    if (!userId) return res.status(401).json({ error: 'Lütfen önce giriş yapın.' });
    const { seriesId } = req.body;
    if (!isValidObjectId(seriesId)) return res.status(400).json({ error: 'Geçersiz içerik bilgisi.' });
    await User.findByIdAndUpdate(userId, { $addToSet: { favorites: seriesId } });
    await WatchProgress.findOneAndUpdate(
      { userId: String(userId), seriesId },
      { userId: String(userId), seriesId, isFavorite: true, lastWatchedAt: new Date() },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
    res.json({ success: true, message: 'Favorilere eklendi' });
  } catch (err) {
    res.status(500).json({ error: 'Favori eklenemedi.' });
  }
});

app.post('/api/favorites/remove', async (req, res) => {
  try {
    const userId = getUserIdFromReq(req);
    if (!userId) return res.status(401).json({ error: 'Lütfen önce giriş yapın.' });
    const { seriesId } = req.body;
    if (!isValidObjectId(seriesId)) return res.status(400).json({ error: 'Geçersiz içerik bilgisi.' });
    await User.findByIdAndUpdate(userId, { $pull: { favorites: seriesId } });
    await WatchProgress.updateMany({ userId: String(userId), seriesId }, { $set: { isFavorite: false } });
    res.json({ success: true, message: 'Favorilerden çıkartıldı' });
  } catch (err) {
    res.status(500).json({ error: 'Favori kaldırılamadı.' });
  }
});

app.post('/api/watchlist/add', async (req, res) => {
  try {
    const userId = getUserIdFromReq(req);
    if (!userId) return res.status(401).json({ error: 'Lütfen önce giriş yapın.' });
    const { seriesId } = req.body;
    if (!isValidObjectId(seriesId)) return res.status(400).json({ error: 'Geçersiz içerik bilgisi.' });
    await User.findByIdAndUpdate(userId, { $addToSet: { watchlist: seriesId } });
    res.json({ success: true, message: 'İzlenecekler listesine eklendi' });
  } catch (err) {
    res.status(500).json({ error: 'İzlenecekler listesine eklenemedi.' });
  }
});

app.get('/api/watchlist', async (req, res) => {
  try {
    const userId = getUserIdFromReq(req);
    if (!userId) return res.status(401).json({ error: 'Lütfen önce giriş yapın.' });
    const user = await User.findById(userId).populate('watchlist').lean();
    res.json((user && user.watchlist) || []);
  } catch (err) {
    res.status(500).json({ error: 'İzlenecekler listesi yüklenemedi.' });
  }
});

// ═══════════════════════════════════════════════════════════
// API ENDPOINTS — FAVORİLER (WISHLIST)
// ═══════════════════════════════════════════════════════════

app.get('/api/favorites', async (req, res) => {
  try {
    const userId = getUserIdFromReq(req);
    if (!userId) return res.status(401).json({ error: 'Lütfen önce giriş yapın.' });
    const user = await User.findById(userId).select('favorites').lean();
    const favFromUser = (user && user.favorites ? user.favorites : []).map(String);
    const progress = await WatchProgress.find({ userId: String(userId), isFavorite: true }).select('seriesId').lean();
    const favFromProgress = progress.map(p => String(p.seriesId)).filter(Boolean);
    const seriesIds = [...new Set([...favFromUser, ...favFromProgress])].filter(isValidObjectId);
    const favorites = await Series.find({ _id: { $in: seriesIds } });
    res.json(favorites);
  } catch (err) {
    res.status(500).json({ error: 'Favoriler yüklenemedi.' });
  }
});

app.post('/api/favorites/:seriesId', async (req, res) => {
  try {
    const userId = getUserIdFromReq(req);
    if (!userId) return res.status(401).json({ error: 'Lütfen önce giriş yapın.' });
    const seriesId = req.params.seriesId;
    if (!isValidObjectId(seriesId)) return res.status(400).json({ error: 'Geçersiz içerik bilgisi.' });
    const existing = await WatchProgress.findOne({ userId: String(userId), seriesId });
    const nextValue = !(existing && existing.isFavorite);
    await WatchProgress.findOneAndUpdate(
      { userId: String(userId), seriesId },
      { userId: String(userId), seriesId, isFavorite: nextValue, lastWatchedAt: new Date() },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
    await User.findByIdAndUpdate(userId, nextValue ? { $addToSet: { favorites: seriesId } } : { $pull: { favorites: seriesId } });
    res.json({ success: true, isFavorite: nextValue, message: nextValue ? 'Favorilere eklendi' : 'Favorilerden çıkartıldı' });
  } catch (err) {
    res.status(500).json({ error: 'Favori işlemi başarısız.' });
  }
});

// ═══════════════════════════════════════════════════════════


// ═══════════════════════════════════════════════════════════
// API ENDPOINTS — KULLANICI İÇERİK İSTEKLERİ
// ═══════════════════════════════════════════════════════════
app.post('/api/content-requests', async (req, res) => {
  try {
    const userId = getUserIdFromReq(req) || req.body.userId || '';
    const { title, releaseYear, note, userName, userEmail, requestType } = req.body;
    const cleanTitle = String(title || '').trim();
    if (!cleanTitle) return res.status(400).json({ error: 'Film/dizi adı zorunlu.' });
    const safeTitle = cleanTitle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const existing = await ContentRequest.findOne({ title: { $regex: '^' + safeTitle + '$', $options: 'i' }, status: 'open' });
    if (existing) {
      existing.voteCount = Number(existing.voteCount || 1) + 1;
      if (note) existing.note = String(note).trim().slice(0, 1200);
      await existing.save();
      return res.status(200).json({ success: true, request: existing, message: 'İstek sayacı artırıldı' });
    }
    const doc = await ContentRequest.create({
      title: cleanTitle.slice(0, 180),
      requestType: ['movie','series','anime'].includes(requestType) ? requestType : 'unknown',
      releaseYear: Number(releaseYear) || undefined,
      note: String(note || '').trim().slice(0, 1200),
      userId: String(userId || ''),
      userName: String(userName || '').slice(0, 120),
      userEmail: String(userEmail || '').slice(0, 180),
      voteCount: 1,
      voterIds: [String(userId || userEmail || cleanTitle).slice(0, 120)]
    });
    res.status(201).json({ success: true, request: doc, message: 'İstek gönderildi' });
  } catch (err) {
    res.status(500).json({ error: 'İstek gönderilemedi.' });
  }
});



app.get('/api/content-requests/public', async (req, res) => {
  try {
    await connectDB();
    const docs = await ContentRequest.find({ status: 'open' }).sort({ voteCount: -1, createdAt: -1 }).limit(20).select('title requestType releaseYear note voteCount status createdAt').lean();
    res.json(docs);
  } catch (err) { res.json([]); }
});

app.post('/api/content-requests/:id/vote', async (req, res) => {
  try {
    await connectDB();
    if (!isValidObjectId(req.params.id)) return res.status(400).json({ error: 'Geçersiz istek.' });
    const voter = String(getUserIdFromReq(req) || req.body.userId || req.headers['x-forwarded-for'] || 'guest').slice(0, 120);
    const doc = await ContentRequest.findById(req.params.id);
    if (!doc) return res.status(404).json({ error: 'İstek bulunamadı.' });
    doc.voterIds = Array.isArray(doc.voterIds) ? doc.voterIds : [];
    if (!doc.voterIds.includes(voter)) {
      doc.voterIds.push(voter);
      doc.voteCount = Number(doc.voteCount || 0) + 1;
      await doc.save();
    }
    res.json({ success: true, voteCount: doc.voteCount, request: doc });
  } catch (err) { res.status(500).json({ error: 'Oy verilemedi.' }); }
});

app.get('/api/content-requests', async (req, res) => {
  try {
    const status = req.query.status;
    const filter = status ? { status } : {};
    const docs = await ContentRequest.find(filter).sort({ createdAt: -1 }).limit(200).lean();
    res.json(docs);
  } catch (err) {
    res.status(500).json({ error: 'İstekler yüklenemedi.' });
  }
});

app.patch('/api/content-requests/:id', async (req, res) => {
  try {
    if (!isValidObjectId(req.params.id)) return res.status(400).json({ error: 'Geçersiz istek.' });
    const status = ['open','done','rejected'].includes(req.body.status) ? req.body.status : 'open';
    const update = { status };
    if (status === 'done') update.completedAt = new Date();
    const doc = await ContentRequest.findByIdAndUpdate(req.params.id, update, { new: true });
    if (doc && status === 'done') {
      await Announcement.create({ title: 'İstek eklendi', message: `${doc.title} artık QasimFlix'te.`, level: 'success', isActive: true }).catch(() => {});
    }
    res.json(doc);
  } catch (err) {
    res.status(500).json({ error: 'İstek güncellenemedi.' });
  }
});

app.delete('/api/content-requests/:id', async (req, res) => {
  try {
    if (!isValidObjectId(req.params.id)) return res.status(400).json({ error: 'Geçersiz istek.' });
    await ContentRequest.findByIdAndDelete(req.params.id);
    res.json({ success: true, message: 'İstek silindi' });
  } catch (err) {
    res.status(500).json({ error: 'İstek silinemedi.' });
  }
});


// ═══════════════════════════════════════════════════════════
// API ENDPOINTS — SORUN RAPORLARI
// ═══════════════════════════════════════════════════════════
app.post('/api/reports', async (req, res) => {
  try {
    const userId = getUserIdFromReq(req) || req.body.userId || '';
    const type = ['bug', 'player', 'account', 'other'].includes(req.body.type) ? req.body.type : 'bug';
    const message = String(req.body.message || '').trim();
    if (!message) return res.status(400).json({ error: 'Rapor mesajı zorunlu.' });

    const doc = await IssueReport.create({
      type,
      message: message.slice(0, 2000),
      pageUrl: String(req.body.pageUrl || '').slice(0, 500),
      userAgent: String(req.body.userAgent || '').slice(0, 500),
      userId: String(userId || '').slice(0, 120),
      userName: String(req.body.userName || '').slice(0, 120),
      userEmail: String(req.body.userEmail || '').slice(0, 180),
      contact: String(req.body.contact || '').slice(0, 180),
      contentTitle: String(req.body.contentTitle || '').slice(0, 180),
      seriesId: String(req.body.seriesId || '').slice(0, 120),
      seasonNumber: Number(req.body.seasonNumber) || undefined,
      episodeNumber: Number(req.body.episodeNumber) || undefined,
      episodeId: String(req.body.episodeId || '').slice(0, 120),
      videoUrl: String(req.body.videoUrl || '').slice(0, 1200),
      errorType: String(req.body.errorType || '').slice(0, 80),
      status: 'open'
    });
    res.status(201).json({ success: true, report: doc, message: 'Rapor gönderildi' });
  } catch (err) {
    res.status(500).json({ error: 'Rapor gönderilemedi.' });
  }
});

app.get('/api/reports', async (req, res) => {
  try {
    const status = String(req.query.status || '').trim();
    const filter = status ? { status } : {};
    const docs = await IssueReport.find(filter).sort({ createdAt: -1 }).limit(300).lean();
    res.json(docs);
  } catch (err) {
    res.status(500).json({ error: 'Raporlar yüklenemedi.' });
  }
});

app.patch('/api/reports/:id', async (req, res) => {
  try {
    if (!isValidObjectId(req.params.id)) return res.status(400).json({ error: 'Geçersiz rapor.' });
    const status = ['open', 'read', 'resolved'].includes(req.body.status) ? req.body.status : 'read';
    const update = { status, updatedAt: new Date() };
    if (status === 'resolved') update.resolvedAt = new Date();
    if (status === 'open') update.resolvedAt = undefined;
    const doc = await IssueReport.findByIdAndUpdate(req.params.id, update, { new: true });
    res.json(doc);
  } catch (err) {
    res.status(500).json({ error: 'Rapor güncellenemedi.' });
  }
});

app.delete('/api/reports/:id', async (req, res) => {
  try {
    if (!isValidObjectId(req.params.id)) return res.status(400).json({ error: 'Geçersiz rapor.' });
    await IssueReport.findByIdAndDelete(req.params.id);
    res.json({ success: true, message: 'Rapor silindi' });
  } catch (err) {
    res.status(500).json({ error: 'Rapor silinemedi.' });
  }
});

// ═══════════════════════════════════════════════════════════
// API ENDPOINTS — GELİŞMİŞ İZLEME LİSTESİ
// ═══════════════════════════════════════════════════════════
app.post('/api/user/list-action', async (req, res) => {
  try {
    const userId = getUserIdFromReq(req) || req.body.userId;
    const { seriesId, action } = req.body;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });
    if (!isValidObjectId(seriesId)) return res.status(400).json({ error: 'Geçersiz içerik bilgisi.' });
    const allowed = ['watchLater','liked','disliked','watched','remove'];
    if (!allowed.includes(action)) return res.status(400).json({ error: 'Geçersiz liste işlemi.' });
    const update = { userId: String(userId), seriesId, lastWatchedAt: new Date() };
    if (action === 'remove') { update.listStatus = 'none'; update.isWatched = false; update.isFavorite = false; }
    if (action === 'watchLater') update.listStatus = 'watchLater';
    if (action === 'liked') { update.listStatus = 'liked'; update.isFavorite = true; }
    if (action === 'disliked') update.listStatus = 'disliked';
    if (action === 'watched') { update.listStatus = 'watched'; update.isWatched = true; }
    await WatchProgress.findOneAndUpdate({ userId: String(userId), seriesId }, update, { upsert: true, new: true, setDefaultsOnInsert: true });
    if (action === 'liked') await User.findByIdAndUpdate(userId, { $addToSet: { favorites: seriesId } });
    if (action === 'remove' || action === 'disliked') await User.findByIdAndUpdate(userId, { $pull: { favorites: seriesId, watchlist: seriesId } });
    if (action === 'watchLater') await User.findByIdAndUpdate(userId, { $addToSet: { watchlist: seriesId } });
    res.json({ success: true, message: 'Liste güncellendi', action });
  } catch (err) {
    res.status(500).json({ error: 'Liste işlemi başarısız.' });
  }
});

// ═══════════════════════════════════════════════════════════
// API ENDPOINTS — PUAN & YORUMLAR
// ═══════════════════════════════════════════════════════════
app.post('/api/ratings/add', async (req, res) => {
  try {
    const userId = getUserIdFromReq(req);
    if (!userId) return res.status(401).json({ error: 'Yorum yapmak için giriş yapmalısın.' });

    const { seriesId, rating, review } = req.body;
    const numericRating = Number(rating);
    if (!isValidObjectId(seriesId)) return res.status(400).json({ error: 'Geçersiz içerik bilgisi.' });
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
    if (!isValidObjectId(req.params.seriesId)) return res.json([]);
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
// Update user preferences (darkMode, preferredQuality)
app.put('/api/user/preferences', async (req, res) => {
  try {
    const userId = getUserIdFromReq(req);
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });
    const updates = {};
    if (typeof req.body?.darkMode === 'boolean') updates.darkMode = req.body.darkMode;
    if (req.body?.preferredQuality) updates.preferredQuality = String(req.body.preferredQuality);
    if (!Object.keys(updates).length) return res.status(400).json({ error: 'Güncellenecek tercih yok.' });
    const user = await User.findByIdAndUpdate(userId, updates, { new: true }).select('-passwordHash');
    res.json(user);
  } catch (err) {
    res.status(500).json({ error: err.message || 'Tercihler güncellenemedi.' });
  }
});

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
