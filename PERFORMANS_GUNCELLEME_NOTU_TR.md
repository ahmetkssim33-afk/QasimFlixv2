# SineQ Performans Güncellemesi

Bu paket mobil/APK ve web tarafında akıcılığı artırmak için hazırlanmıştır.

## Değişenler

- `app.js`
  - Kart render işlemi `innerHTML +=` yerine tek seferde `map(...).join('')` ile yapılır.
  - Arama sonuçları da tek seferde basılır.
  - Poster görsellerine `decoding="async"`, `fetchpriority="low"` ve `draggable="false"` eklendi.
  - Görsel hata durumunda `nextElementSibling` kullanıldı.

- `qf-performance.css`
  - Yeni performans CSS dosyası eklendi.
  - Mobilde ağır hover, blur, backdrop-filter ve büyük gölge maliyeti azaltıldı.
  - Kartlar için `content-visibility: auto` eklendi.
  - APK/WebView kaydırma performansı için bazı efektler hafifletildi.

- `index.html`
  - `qf-performance.css` sayfaya bağlandı.

- `sw.js`
  - Cache sürümü `sineq-v1.0.8-performance` yapıldı.
  - JS/CSS/JSON/görsel dosyaları için cache-first + arka planda güncelleme mantığı eklendi.
  - İkinci açılışlar ve APK içinde geri dönüşler daha hızlı olur.

- `api/index.js`
  - Liste/arama/kategori sorgularına `.lean()` eklendi.
  - Mongoose doküman yükü azalır, API cevapları daha hafif ve hızlı döner.

- `APK_WEBVIEW_TEMPLATE/app/src/main/java/com/sineq/app/MainActivity.java`
  - WebView cache modu ve hardware layer eklendi.

- `APK_WEBVIEW_TEMPLATE/app/src/main/AndroidManifest.xml`
  - `android:hardwareAccelerated="true"` eklendi.

## Not

Google Drive iframe videoları hâlâ en büyük yavaşlık kaynağıdır. Bu güncelleme arayüz, kaydırma, listeleme ve APK hissini iyileştirir; Drive'ın kendi player yüklenme süresini tamamen çözmez.
