# QasimFlix Güvenlik + APK Güncelleme Notları

Bu paket içinde eksik görülen en kritik noktalar tamamlandı.

## Yapılan ana değişiklikler

### 1. Admin panel artık backend token ile korunuyor

Eklenen endpointler:

- `POST /api/admin/login`
- `GET /api/admin/session`

Korunan işlemler:

- Seri/film ekleme, güncelleme, silme
- Sezon ekleme, güncelleme, silme
- Bölüm ekleme, toplu bölüm ekleme, güncelleme, silme
- Altyazı ekleme
- Kategori ekleme
- Admin istatistikleri
- Raporları listeleme/güncelleme/silme
- İçerik isteklerini listeleme/güncelleme/silme
- Duyuru yönetimi
- TMDB admin aramaları
- Link tarama paneli
- Admin güvenlik kayıtları

> Önemli: `ADMIN_PASSWORD` ayarlanmazsa eski kullanım bozulmasın diye varsayılan `admin123` çalışır. Canlı sitede mutlaka değiştir.

Vercel > Settings > Environment Variables içine ekle:

```env
JWT_SECRET=çok_güçlü_bir_secret
ADMIN_PASSWORD=çok_güçlü_admin_şifren
ADMIN_JWT_SECRET=çok_güçlü_admin_session_secret
```

İstersen şifreyi hash olarak da kullanabilirsin:

```env
ADMIN_PASSWORD_HASH=bcrypt_hash_değeri
```

### 2. Admin frontend güncellendi

`admin.html` artık sadece frontend içinde `admin123` kontrolü yapmıyor. Şifre backend'e gider, backend token döndürür, sonraki admin API istekleri `Authorization: Bearer ...` ile yapılır.

### 3. APK/WebView bridge eklendi

Yeni dosya:

- `qf-apk-bridge.js`

Bu dosya Android WebView içinde `window.QasimFlixAndroid` varsa şunları native tarafa iletir:

- Video açıldı/kapatıldı
- Fullscreen aç/kapat
- Yatay moda geç/çık
- Ekranı açık tut
- Native indirme başlat
- Harici link aç
- Paylaş

### 4. Android Studio hazır şablon eklendi

Yeni klasör:

- `APK_WEBVIEW_TEMPLATE/`

İçinde hazır örnekler var:

- `MainActivity.java`
- `AndroidManifest.xml`
- `app/build.gradle`
- `README_TR.md`

Bu klasörü direkt siteye koymak için değil, Android Studio projesine kopyalamak için kullan.

### 5. Player hata paneli eklendi

Yeni dosya:

- `qf-player-failsafe.js`

Video geç açılırsa veya hata verirse kullanıcıya panel gösterir:

- Tekrar dene
- Alternatif kalite/kaynak seç
- Admin'e otomatik rapor gönder
- Google Drive izni hatası için açıklama göster

### 6. Bildirim ikon yolu düzeltildi

`firebase-messaging-sw.js` içinde yanlış `/icons/...` yolu düzeltildi:

- `/assets/icons/icon-192.png`
- `/assets/icons/icon-96.png`

### 7. PWA/APK cache güncellendi

`sw.js` cache versiyonu artırıldı ve yeni dosyalar cache listesine eklendi.

### 8. `.gitignore` düzeltildi

Önceden satır hatası vardı. Artık şunları dışarıda bırakır:

- `node_modules/`
- `.env`
- `.idea/`
- `.git/`
- `*.zip`
- log/build/dist dosyaları

## Değişen / eklenen dosyalar

- `api/index.js`
- `server.js`
- `admin.html`
- `qf-admin-enhancements.js`
- `qf-admin-pro-tools.js`
- `qf-smart-admin.js`
- `index.html`
- `sw.js`
- `firebase-messaging-sw.js`
- `manifest.json`
- `.env.example`
- `.gitignore`
- `version.json`
- `qf-apk-bridge.js` yeni
- `qf-player-failsafe.js` yeni
- `APK_WEBVIEW_TEMPLATE/` yeni

## Canlıya atmadan önce yapman gerekenler

1. Vercel Environment Variables içine `ADMIN_PASSWORD`, `ADMIN_JWT_SECRET`, `JWT_SECRET` ekle.
2. Deploy et.
3. Admin paneline yeni şifreyle gir.
4. Eğer APK projen ayrı klasördeyse `APK_WEBVIEW_TEMPLATE` içindeki `MainActivity.java` mantığını kendi Android projenle birleştir.
5. APK içindeki site URL'sini kendi Vercel domainin yap.

