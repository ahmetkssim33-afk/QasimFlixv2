# SineQ

SineQ; film, dizi, sezon ve bölüm yönetimi olan bir izleme platformudur. Proje Vercel serverless API, MongoDB, admin paneli, kullanıcı hesabı, izleme takibi, bildirim, rapor ve içerik istekleri altyapısı içerir.

## Öne çıkan özellikler

- Film / dizi / anime / yerli dizi katalog yönetimi
- Seri → sezon → bölüm yapısı
- Admin panelinden içerik, sezon, bölüm ve altyazı ekleme
- Kullanıcı kayıt / giriş / Google giriş desteği
- Favoriler, izlenecekler, izleme ilerlemesi ve devam etme kayıtları
- Kullanıcı sorun raporu ve admin bildirim rozeti
- İçerik istekleri ve oylama altyapısı
- Push bildirim aboneliği ve duyuru sistemi
- Admin dashboard canlı sayaçları:
  - Toplam içerik
  - Toplam sezon
  - Toplam bölüm
  - Film sayısı
  - Kayıtlı hesap sayısı
  - Aktif kullanıcı sayısı
  - Bugün kayıt olan kullanıcı sayısı
  - İzleme / favori / devam kayıtları
  - Açık rapor sayısı

## Canlı yayına çıkmadan önce gerekli Environment Variables

Vercel → Project Settings → Environment Variables içine en az şunları ekle:

```env
MONGODB_URI=...
JWT_SECRET=...
ADMIN_PASSWORD=...
ADMIN_JWT_SECRET=...
APP_URL=https://senin-site-adresin.vercel.app
```

Opsiyonel ama önerilenler:

```env
TMDB_TOKEN=...
FIREBASE_SERVER_KEY=...
SMTP_HOST=...
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=...
SMTP_PASS=...
EMAIL_FROM=SineQ <noreply@senin-domainin.com>
```

## Komutlar

```bash
npm install
npm run check
npm run vercel-check
npm run production-check
npm run full-check
npm start
```

## Yayın paketi notu

Bu zip içinden `.git`, `.idea` ve `node_modules` temizlendi. GitHub'a gönderirken veya Vercel'e yüklerken bunlar projeye dahil edilmemelidir. Bağımlılıklar Vercel tarafında `package.json` üzerinden yeniden kurulur.

## APK notu

`APK_WEBVIEW_TEMPLATE/app/src/main/java/com/sineq/app/MainActivity.java` içindeki `HOME_URL` canlı Vercel domaininle aynı olmalıdır. Site domaini değişirse APK içindeki URL de güncellenmelidir.
