# SineQ Akıllı Özellik Güncellemesi

Bu güncellemede alternatif/fallback video link sistemi özellikle eklenmedi. Onun dışında istenen geliştirmeler hem PC/web hem de APK/PWA tarafında çalışacak şekilde projeye bağlandı.

## Kullanıcı / PC / APK tarafı
- Ana sayfaya **Senin İçin Öneriler** alanı eklendi.
- İçerik detayına daha profesyonel bilgi kutusu eklendi: yıl, tür, puan, kategori ve oyuncular.
- Detay modalına kullanıcıların puan ve yorum gönderebileceği form eklendi.
- İçerik istekleri alanına **En çok istenenler** listesi ve oy verme sistemi eklendi.
- APK/PWA önbelleği için yeni dosyalar servis worker listesine eklendi.

## Admin paneli
- Dashboard içine gelişmiş istatistik alanı eklendi: kullanıcı, açık rapor, açık istek, sorunlu link, en çok izlenenler ve en çok istenenler.
- Bölüm ekleme ekranına **Toplu Bölüm Ekle** aracı eklendi.
- Bölüm ekleme/düzenleme ekranına manuel **kalite linkleri** alanı eklendi. Bu alan alternatif link değildir; kullanıcı player içinde kalite seçer.
- Yeni **Link Tarama** menüsü eklendi. Video linkleri kontrol edilip `ok`, `broken`, `access_denied`, `empty` gibi durumlar kaydedilir.
- Yeni **Güvenlik** menüsü eklendi. Admin giriş denemeleri loglanır.
- 5 hatalı admin şifresinden sonra tarayıcı bazlı 60 saniyelik kilit eklendi.
- İçerik isteği “eklendi” durumuna alınırsa duyuru oluşturacak şekilde bağlandı.

## Backend / API
- `POST /api/episodes/bulk`
- `GET /api/admin/link-scan`
- `POST /api/admin/link-scan`
- `GET /api/admin/stats`
- `POST /api/admin/security-log`
- `GET /api/admin/security-log`
- `GET /api/recommendations/:userId`
- `GET /api/content-requests/public`
- `POST /api/content-requests/:id/vote`
- `DELETE /api/ratings/:id`

## Değişen / eklenen ana dosyalar
- `api/index.js`
- `lib/models.js`
- `app.js`
- `index.html`
- `admin.html`
- `sw.js`
- `version.json`
- `qf-smart-features.css`
- `qf-smart-public.js`
- `qf-smart-admin.js`
