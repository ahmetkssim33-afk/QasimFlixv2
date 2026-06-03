# SineQ Hata Düzeltme Notu

Bu paket şu sorunlar için güncellendi:

## Düzeltilenler

1. **/api/content-requests/public 401 Unauthorized**
   - Public içerik istekleri endpoint'i admin token istemeyecek şekilde güçlendirildi.
   - Vercel/Express path farkları için `/api/...` ve `/...` yolları birlikte desteklendi.

2. **Firebase/gstatic bağlantısı kesilince site takılması**
   - Firebase modülleri artık sayfa açılışında zorunlu yüklenmiyor.
   - Bildirimler kapalıysa Firebase CDN çağrısı yapılmaz.
   - Firebase yüklenemezse site/player/admin çalışmaya devam eder.

3. **Service Worker Firebase CDN hataları**
   - `sw.js` içindeki Firebase `importScripts` kaldırıldı.
   - Native `push` event desteği eklendi.
   - Cache sürümü `sineq-v1.0.8-error-fixes` olarak yükseltildi.

4. **PWA beforeinstallprompt console uyarısı**
   - Kullanıcı kurulum önerisini kapattıysa `preventDefault()` çağrısı yapılmaz.
   - Böylece gereksiz banner uyarısı azalır.

5. **APK eski domain / 404**
   - APK WebView adresi yeni domain ile güncellendi:
     `https://qasim-flix2-swnn.vercel.app/index.html?source=apk`
   - APK versionName `1.0.8`, versionCode `8` yapıldı.

## Deploy sonrası yapılacaklar

1. Dosyaları projene at.
2. Komutları çalıştır:

```bat
git add .
git commit -m "Public API Firebase cache ve APK domain hatalari duzeltildi"
git push
```

3. Vercel deploy bitince sitede `Ctrl + F5` yap.
4. Gerekirse eski service worker/cache temizle:

```js
navigator.serviceWorker.getRegistrations().then(rs => rs.forEach(r => r.unregister()));
caches.keys().then(keys => keys.forEach(k => caches.delete(k)));
localStorage.removeItem('sineq-cache');
location.reload();
```

## APK için

Domain değiştiği için eski APK güncellenmez. Android Studio'da yeniden APK build al:

```bat
gradlew assembleDebug
```

Çıkan APK:

```txt
APK_WEBVIEW_TEMPLATE/app/build/outputs/apk/debug/app-debug.apk
```
