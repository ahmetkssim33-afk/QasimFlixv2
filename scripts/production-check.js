const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const failures = [];
const warnings = [];

function read(rel) {
  return fs.readFileSync(path.join(root, rel), 'utf8');
}

function assert(condition, message) {
  if (!condition) failures.push(message);
}

function warn(condition, message) {
  if (!condition) warnings.push(message);
}

function exists(rel) {
  return fs.existsSync(path.join(root, rel));
}

['package.json', 'vercel.json', 'lib/db.js', 'lib/models.js', 'api/index.js', 'index.html', 'admin.html', 'auth.html', 'version.json'].forEach(file => {
  assert(exists(file), `${file} eksik`);
});

const api = read('api/index.js');
const server = read('server.js');
const security = read('lib/security.js');
const androidMain = read('APK_WEBVIEW_TEMPLATE/app/src/main/java/com/qasimflix/app/MainActivity.java');
const androidGradle = read('APK_WEBVIEW_TEMPLATE/app/build.gradle');
const version = JSON.parse(read('version.json'));

assert(!api.includes("dev_jwt_secret_change_me"), 'api/index.js içinde dev JWT fallback kalmış');
assert(!server.includes("dev_jwt_secret_change_me"), 'server.js içinde dev JWT fallback kalmış');
assert(!api.includes("'admin123'") && !api.includes('"admin123"'), 'api/index.js içinde admin123 fallback kalmış');
assert(!server.includes("'admin123'") && !server.includes('"admin123"'), 'server.js içinde admin123 fallback kalmış');
assert(security.includes('createRateLimiter'), 'lib/security.js rate limit helper içermiyor');
assert(security.includes('securityHeaders'), 'lib/security.js güvenlik header helper içermiyor');
assert(security.includes('isSafeExternalUrl'), 'lib/security.js güvenli URL kontrolü içermiyor');
assert(androidMain.includes('WebView.setWebContentsDebuggingEnabled(false);'), 'APK WebView debug kapalı değil');

const versionName = (androidGradle.match(/versionName\s+['"]([^'"]+)['"]/i) || [])[1];
assert(versionName === version.version, `APK versionName (${versionName}) ile version.json (${version.version}) eşleşmiyor`);

warn(!fs.existsSync(path.join(root, 'node_modules')), 'node_modules proje zip/push içinde olmamalı');
warn(!fs.existsSync(path.join(root, '.idea')), '.idea proje zip/push içinde olmamalı');
warn(!fs.existsSync(path.join(root, '.git')), '.git klasörü paylaşım zip içinde olmamalı');

if (warnings.length) {
  console.log('Uyarılar:');
  warnings.forEach(w => console.log(' - ' + w));
}

if (failures.length) {
  console.error('Production check başarısız:');
  failures.forEach(f => console.error(' - ' + f));
  process.exit(1);
}

console.log('Production check OK');
