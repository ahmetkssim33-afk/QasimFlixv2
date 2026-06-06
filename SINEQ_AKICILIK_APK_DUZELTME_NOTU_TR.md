# SineQ Akıcılık ve APK Düzeltme Notu

Bu pakette normal site, admin/API ve APK WebView için performans/temizlik düzeltmeleri yapıldı.

## Ana düzeltmeler
- APK artık eski `qasim-flix` URL'sine sabit bağlı değil; `gradle.properties` içindeki `SINEQ_WEB_URL` değerini kullanıyor.
- Eski `com/qasimflix` Android kaynak klasörü kaldırıldı.
- APK WebView user-agent `SineQAPK/1.0.11` olarak güncellendi.
- Ana siteye `qf-runtime-optimizer.js` ve `qf-performance.css` bağlandı.
- Görseller lazy/async yükleniyor; mobil/APK kaydırma yükü azaltıldı.
- Ana liste/detay/arama API isteklerine kısa süreli cache eklendi.
- Aramada debounce 420ms oldu ve eski arama isteği iptal ediliyor.
- MongoDB indexleri eklendi: arama, kategori, sezon/bölüm sıralama, izleme geçmişi.
- Local server static dosyalar için cache header eklendi.

## APK için yapman gereken tek şey
`APK_WEBVIEW_TEMPLATE/gradle.properties` dosyasında şu satırı kendi gerçek Vercel linkinle değiştir:

```properties
SINEQ_WEB_URL=https://your-sineq-domain.vercel.app/index.html?source=apk
```

## Vercel için gereken env
```env
MONGODB_URI=mongodb+srv://...
APP_URL=https://senin-sineq-siten.vercel.app
PUBLIC_APP_URL=https://senin-sineq-siten.vercel.app
ALLOWED_ORIGINS=https://senin-sineq-siten.vercel.app
ADMIN_PASSWORD=...
ADMIN_JWT_SECRET=...
JWT_SECRET=...
```
