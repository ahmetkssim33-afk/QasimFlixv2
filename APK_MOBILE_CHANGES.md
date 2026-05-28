# QasimFlix APK / Mobil Deneyim Değişiklikleri

Bu güncelleme sadece APK/PWA/mobil uygulama hissini güçlendirmek için yapıldı. Masaüstü site ve admin panel genel yapısı korunmuştur.

## Eklenenler

- `qf-apk.css`: Mobil APK alt menüsü, güncelleme banner'ı, indirilenler paneli, toast bildirimleri ve mobil dokunmatik UI katmanı.
- `qf-apk.js`: APK/PWA algılama, alt menü aksiyonları, indirilenler kaydı, MP4 indirme kontrolü, online/offline toast, wake lock ve güncelleme kontrolü.
- `qf-player-apk.js`: Mobil player için geri tuşu/tam ekran davranışı, ekran kapanmasını azaltan wake lock denemesi ve yatay ekran desteği.
- `version.json`: APK güncelleme kontrolü için sürüm dosyası.
- `assets/icons/*`: APK/PWA için PNG ikonlar ve maskable icon.

## Güncellenenler

- `manifest.json`: Gerçek APK/PWA ikonları, shortcut'lar, standalone görünüm ve mobil uygulama ayarları iyileştirildi.
- `sw.js`: Cache adı yenilendi, offline ekran ve APK dosyaları cache listesine eklendi, offline yönlendirme güçlendirildi.
- `offline.html`: Uygulama tarzı profesyonel çevrimdışı ekran yapıldı.
- `index.html`: Manifest/meta etiketleri ve APK CSS/JS katmanı bağlandı.
- `player.html`: APK CSS ve player mobil yardımcı JS bağlandı.

## Önemli Notlar

- Çevrimdışı video indirme sadece direkt `.mp4` linklerde düzgün çalışır.
- Google Drive, YouTube, iframe/embed videolar çevrimdışı indirme için uygun değildir.
- Push bildirim için Firebase Cloud Messaging veya benzeri ek servis gerekir.
- `version.json` içindeki `apkRequired`, `message` ve `apkUrl` alanları güncelleme banner'ını kontrol eder.

## APK güncelleme örneği

Yeni APK linkini yayınladığında `version.json` şöyle olabilir:

```json
{
  "version": "1.0.1",
  "build": 20260530,
  "apkRequired": true,
  "message": "Yeni APK sürümü hazır. Güncellemen önerilir.",
  "apkUrl": "https://senin-siten.com/QasimFlix-1.0.1.apk"
}
```
