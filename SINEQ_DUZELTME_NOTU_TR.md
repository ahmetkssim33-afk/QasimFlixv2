# SineQ Düzeltme Notu

Bu pakette yapılan ana düzeltmeler:

1. Zip temizlendi
   - `.git/`, `.idea/`, `node_modules/` çıkarıldı.
   - `npm run production-check` artık temiz geçiyor.

2. Bildirim ikonu düzeltildi
   - `index.html` içindeki yanlış `/icons/icon-192.png` yolu `/assets/icons/icon-192.png` olarak güncellendi.

3. Admin dashboard sayaçları eklendi
   - Kayıtlı hesap sayısı
   - Aktif kullanıcı sayısı
   - Bugün kayıt olan kullanıcı sayısı
   - İzleme / favori / devam kayıtları
   - Toplam sezon, bölüm, film ve açık rapor sayıları API'den canlı geliyor.

4. Kullanıcı aktiflik takibi eklendi
   - Kullanıcı kayıt olduğunda `lastLoginAt` ve `lastActiveAt` yazılır.
   - Kullanıcı giriş yaptığında güncellenir.
   - Kullanıcı siteye token ile geldiğinde `/api/auth/me` üzerinden `lastActiveAt` güncellenir.
   - Aktif kullanıcı sayısı son 15 dakikaya göre hesaplanır.

5. API özetleri genişletildi
   - `/api/admin/summary`
   - `/api/admin/stats`
   artık kullanıcı ve aktiflik sayaçlarını da döndürür.

6. README güncellendi
   - Eski StreamFlix adı temizlendi.
   - SineQ yayın ve ENV notları eklendi.

Kontrol sonucu:

```bash
npm run check
npm run vercel-check
npm run production-check
```

Kod syntax kontrolleri geçti. Production check temiz geçti.
