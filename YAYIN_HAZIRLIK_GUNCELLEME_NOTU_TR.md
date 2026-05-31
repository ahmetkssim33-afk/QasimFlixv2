# QasimFlix Yayın Hazırlık Güncelleme Notu

Bu paket, canlı yayına daha temiz ve güvenli çıkmak için düzenlendi.

## Yapılan ana değişiklikler

1. Temiz paket oluşturuldu
   - `.git` kaldırıldı.
   - `.idea` kaldırıldı.
   - `node_modules` kaldırıldı.
   - Yerel/yanlış DB klasörleri kaldırıldı.

2. Google giriş backend JWT ile birleştirildi
   - Yeni endpoint: `POST /api/auth/google`
   - Firebase ID token sunucuda doğrulanır.
   - Kullanıcı MongoDB içinde oluşturulur veya mevcut hesapla eşleştirilir.
   - Sonra normal QasimFlix JWT token üretilir.
   - Böylece favoriler, izlenecekler, yorumlar ve profil işlemleri Google girişte de düzgün çalışır.

3. Gerçek push bildirim altyapısı eklendi
   - Yeni endpoint: `POST /api/push/send`
   - Admin token ister.
   - `FIREBASE_SERVER_KEY` eklenirse kayıtlı cihazlara FCM bildirimi gönderir.
   - Yeni içerik ve aktif duyuru eklenince otomatik bildirim göndermeyi dener.

4. Bildirim token kaydı iyileştirildi
   - Kullanıcı giriş yaptıysa token kaydına userId, kullanıcı adı ve e-posta da eklenir.
   - APK WebView ile web ayrımı için platform bilgisi iyileştirildi.

5. SEO ve yasal sayfalar eklendi
   - `privacy.html`
   - `terms.html`
   - `contact.html`
   - `dmca.html`
   - `robots.txt`
   - `sitemap.xml`

6. Ana sayfaya footer linkleri ve temel SEO meta açıklaması eklendi.

7. Service Worker güncellendi
   - Cache sürümü yükseltildi.
   - Yeni yasal sayfalar cache listesine eklendi.

8. Vercel static ayarı güncellendi
   - `.txt` ve `.xml` dosyaları için static build desteği eklendi.

## Vercel Environment Variables içine eklemen gerekenler

Zorunlu olanlar:

```env
MONGODB_URI=...
JWT_SECRET=çok_uzun_gizli_bir_yazi
ADMIN_PASSWORD=admin_sifren
ADMIN_JWT_SECRET=jwt_secretten_farkli_cok_uzun_bir_yazi
APP_URL=https://senin-site-adresin.vercel.app
```

Google giriş için:

```env
FIREBASE_PROJECT_ID=qasimflix-8ba04
```

Gerçek push bildirim için:

```env
FIREBASE_SERVER_KEY=Firebase_Cloud_Messaging_Server_Key
PUSH_ON_NEW_CONTENT=true
PUSH_ON_ANNOUNCEMENT=true
```

Şifre sıfırlama maili için:

```env
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=mail_adresin
SMTP_PASS=gmail_app_password
EMAIL_FROM=mail_adresin
```

## Test sonucu

Aşağıdaki kontroller başarılı geçti:

```bash
npm run full-check
```

Son temiz paket içinde `node_modules`, `.git` ve `.idea` yoktur.

## Kalan not

Google Drive video altyapısı hâlâ Drive preview/iframe mantığına bağlıdır. Bu paket onu daha güvenli ve temiz hale getirir, ancak gerçek Netflix tarzı en stabil video deneyimi için ileride Bunny Stream, Cloudflare Stream veya CDN/MP4 tabanlı sisteme geçmek gerekir.
