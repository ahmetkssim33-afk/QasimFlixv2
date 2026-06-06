# SineQ Düzeltilmiş Paket Notu

Bu pakette yapılan ana düzeltmeler:

1. Gerçek `.env` dosyası paketten kaldırıldı. Sadece güvenli `.env.example` bırakıldı.
2. Script içindeki açık MongoDB bağlantısı kaldırıldı; artık `process.env.MONGODB_URI` kullanıyor.
3. Eski marka kalıntıları SineQ olarak temizlendi.
4. Admin panelde hata çıkarabilen `insertBefore` kullanımı güvenli hale getirildi.
5. Eski Vercel domain kalıntıları temizlendi.
6. ZIP içine girmemesi gereken `.git`, `node_modules`, `.idea`, `.gradle`, `build`, `local.properties`, `db` gibi dosyalar temizlendi.

## Vercel için zorunlu Environment Variables

```env
MONGODB_URI=mongodb+srv://...
APP_URL=https://senin-sineq-siten.vercel.app
PUBLIC_APP_URL=https://senin-sineq-siten.vercel.app
ALLOWED_ORIGINS=https://senin-sineq-siten.vercel.app
ADMIN_PASSWORD=guclu_admin_sifren
ADMIN_JWT_SECRET=32_karakterden_uzun_admin_secret
JWT_SECRET=32_karakterden_uzun_user_secret
```

## APK için önemli

`APK_WEBVIEW_TEMPLATE/app/src/main/java/com/sineq/app/MainActivity.java` içinde `HOME_URL` şimdilik `https://sineq.vercel.app/index.html?source=apk` olarak temizlendi. APK almadan önce bunu kendi gerçek Vercel linkinle değiştir.

## Güvenlik

Eski ZIP içinde MongoDB şifresi açık göründüğü için MongoDB Atlas kullanıcı şifreni yenilemen önerilir.
