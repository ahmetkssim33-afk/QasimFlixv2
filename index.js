// Vercel acil güvenlik dosyası.
// Bazı deploy ayarlarında kökteki index.js yanlışlıkla Serverless Function gibi çalışabilir.
// Bu dosya root çağrılarında index.html döndürür; API çağrıları yine /api/index.js üzerinden çalışır.

const fs = require('fs');
const path = require('path');

module.exports = function handler(req, res) {
  if (req.url && req.url.startsWith('/api/')) {
    res.statusCode = 404;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    return res.end(JSON.stringify({ error: 'API route must be handled by /api/index.js' }));
  }

  const htmlPath = path.join(__dirname, 'index.html');
  fs.readFile(htmlPath, 'utf8', (err, html) => {
    if (err) {
      res.statusCode = 500;
      res.setHeader('Content-Type', 'text/plain; charset=utf-8');
      return res.end('index.html bulunamadı');
    }
    res.statusCode = 200;
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.end(html);
  });
};
