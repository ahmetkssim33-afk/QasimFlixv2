# SineQ Vercel 500 Acil Düzeltme

Bu paket root sayfasının Serverless Function gibi çalışıp 500 vermesi ihtimaline karşı hazırlanmıştır.

Değişen dosyalar:
- vercel.json
- package.json
- lib/db.js
- index.js

Kopyaladıktan sonra:

```bash
git add vercel.json package.json lib/db.js index.js
git commit -m "Fix Vercel root 500 crash"
git push origin main
```

Vercel'de Environment Variables kontrolü:
- MONGODB_URI
- ADMIN_PASSWORD
- JWT_SECRET
- ADMIN_JWT_SECRET
- TMDB_TOKEN
- APP_URL

Sonra Vercel > Deployments > Redeploy yapın. Build cache kapalı olursa daha iyi olur.
