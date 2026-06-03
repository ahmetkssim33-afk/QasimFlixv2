const bcrypt = require('bcryptjs');

const DEFAULT_ALLOWED_ORIGIN = 'https://qasim-flixv2-swnm.vercel.app';

function cleanOrigin(value = '') {
  return String(value || '').trim().replace(/\/$/, '');
}

function splitEnvList(value = '') {
  return String(value || '')
    .split(',')
    .map(v => cleanOrigin(v))
    .filter(Boolean);
}

function getEnv(name) {
  return String(process.env[name] || '').trim();
}

function getJwtSecret() {
  return getEnv('JWT_SECRET');
}

function getAdminJwtSecret() {
  return getEnv('ADMIN_JWT_SECRET') || getEnv('JWT_SECRET');
}

function hasAdminPasswordConfigured() {
  return Boolean(getEnv('ADMIN_PASSWORD_HASH') || getEnv('ADMIN_PASSWORD') || getEnv('ADMIN_PASS'));
}

async function verifyConfiguredAdminPassword(password) {
  const value = String(password || '');
  if (!value || !hasAdminPasswordConfigured()) return false;

  const hash = getEnv('ADMIN_PASSWORD_HASH');
  if (hash) return bcrypt.compare(value, hash);

  const plain = getEnv('ADMIN_PASSWORD') || getEnv('ADMIN_PASS');
  return value === plain;
}

function getAllowedOrigins() {
  const origins = new Set([
    DEFAULT_ALLOWED_ORIGIN,
    'http://localhost:3000',
    'http://localhost:5173',
    'http://127.0.0.1:3000',
    'http://127.0.0.1:5173'
  ]);

  splitEnvList(process.env.ALLOWED_ORIGINS).forEach(o => origins.add(o));

  const appUrl = cleanOrigin(process.env.APP_URL);
  if (appUrl) origins.add(appUrl);

  const vercelUrl = cleanOrigin(process.env.VERCEL_URL);
  if (vercelUrl) origins.add(vercelUrl.startsWith('http') ? vercelUrl : `https://${vercelUrl}`);

  return origins;
}

function isAllowedOrigin(origin) {
  if (!origin) return true; // mobile WebView, curl, server-to-server
  const cleaned = cleanOrigin(origin);
  const allowed = getAllowedOrigins();
  if (allowed.has(cleaned)) return true;

  // Vercel preview deployları için izin. Kendi domainini sıkılaştırmak istersen ALLOWED_ORIGINS kullan.
  try {
    const host = new URL(cleaned).hostname;
    if (host === 'localhost' || host === '127.0.0.1') return true;
    if (host.endsWith('.vercel.app')) return true;
  } catch (_) {}

  return false;
}

function createCorsOptions() {
  return {
    origin(origin, callback) {
      if (isAllowedOrigin(origin)) return callback(null, true);
      return callback(null, false);
    },
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'x-admin-key'],
    credentials: true,
    maxAge: 86400
  };
}

function securityHeaders(req, res, next) {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');

  if (String(process.env.ENABLE_CSP || 'true') !== 'false') {
    res.setHeader('Content-Security-Policy', [
      "default-src 'self' https: data: blob:",
      "base-uri 'self'",
      "object-src 'none'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://www.gstatic.com https://www.googletagmanager.com https://*.googleapis.com",
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      "font-src 'self' data: https://fonts.gstatic.com",
      "img-src 'self' data: blob: https:",
      "media-src 'self' data: blob: https:",
      "frame-src 'self' https://drive.google.com https://www.youtube.com https://www.youtube-nocookie.com https://player.vimeo.com",
      "connect-src 'self' https: wss:",
      "form-action 'self'"
    ].join('; '));
  }

  next();
}

function getRequestIp(req) {
  return String(req.headers['x-forwarded-for'] || req.socket?.remoteAddress || 'unknown').split(',')[0].trim();
}

function createRateLimiter(options = {}) {
  const windowMs = Number(options.windowMs || 15 * 60 * 1000);
  const max = Number(options.max || 60);
  const message = options.message || 'Çok fazla istek. Biraz sonra tekrar deneyin.';
  const bucket = new Map();

  return function rateLimit(req, res, next) {
    const now = Date.now();
    const key = `${getRequestIp(req)}:${req.method}:${req.baseUrl || req.path || req.originalUrl}`;
    const current = bucket.get(key) || { count: 0, resetAt: now + windowMs };

    if (current.resetAt <= now) {
      current.count = 0;
      current.resetAt = now + windowMs;
    }

    current.count += 1;
    bucket.set(key, current);

    // Basit bellek temizliği
    if (bucket.size > 5000) {
      for (const [k, v] of bucket.entries()) {
        if (v.resetAt <= now) bucket.delete(k);
      }
    }

    res.setHeader('X-RateLimit-Limit', String(max));
    res.setHeader('X-RateLimit-Remaining', String(Math.max(0, max - current.count)));
    res.setHeader('X-RateLimit-Reset', String(Math.ceil(current.resetAt / 1000)));

    if (current.count > max) return res.status(429).json({ error: message });
    next();
  };
}

function isPrivateHostname(hostname = '') {
  const host = String(hostname || '').toLowerCase().replace(/^\[|\]$/g, '');
  if (!host) return true;
  if (host === 'localhost' || host === '0.0.0.0' || host === '::1') return true;
  if (/^127\./.test(host) || /^10\./.test(host) || /^192\.168\./.test(host)) return true;
  if (/^172\.(1[6-9]|2\d|3[0-1])\./.test(host)) return true;
  if (/^169\.254\./.test(host)) return true;
  if (/^(fc|fd)[0-9a-f]{2}:/i.test(host) || /^fe80:/i.test(host)) return true;
  return false;
}

function isSafeExternalUrl(rawUrl = '', options = {}) {
  try {
    const url = new URL(String(rawUrl || '').trim());
    const allowedProtocols = options.allowHttp ? ['https:', 'http:'] : ['https:'];
    if (!allowedProtocols.includes(url.protocol)) return { ok: false, reason: 'Sadece HTTPS linkleri desteklenir.' };
    if (isPrivateHostname(url.hostname)) return { ok: false, reason: 'Yerel/özel ağ adresleri desteklenmez.' };

    const strictHosts = String(process.env.SINEQ_STRICT_PROXY_HOSTS || 'false') === 'true';
    const allowedHosts = splitEnvList(process.env.ALLOWED_PROXY_HOSTS).map(v => {
      try { return new URL(v.startsWith('http') ? v : `https://${v}`).hostname; } catch (_) { return v; }
    });

    if (strictHosts && allowedHosts.length && !allowedHosts.some(h => url.hostname === h || url.hostname.endsWith(`.${h}`))) {
      return { ok: false, reason: 'Bu video kaynağı izinli host listesinde değil.' };
    }

    return { ok: true, url: url.toString() };
  } catch (_) {
    return { ok: false, reason: 'Geçersiz URL.' };
  }
}

module.exports = {
  createCorsOptions,
  securityHeaders,
  createRateLimiter,
  getJwtSecret,
  getAdminJwtSecret,
  hasAdminPasswordConfigured,
  verifyConfiguredAdminPassword,
  getRequestIp,
  isSafeExternalUrl
};
