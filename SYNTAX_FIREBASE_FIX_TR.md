# Syntax/Firebase düzeltmesi

- `Unexpected token .` hatası için `index.html` içindeki Firebase module/dynamic import bloğu compat script yükleyiciye çevrildi.
- Yeni blokta optional chaining (`?.`) ve object spread (`...`) kullanılmadı.
- `sw.js` içinde optional chaining kaldırıldı ve cache sürümü `1.0.9` yapıldı.
- Firebase CDN kapanırsa site açılmaya devam eder; sadece bildirim özelliği pasif kalır.
