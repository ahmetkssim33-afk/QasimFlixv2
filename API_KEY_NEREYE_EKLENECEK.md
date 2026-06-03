# TMDB API Key / Token Nereye Eklenecek?

Bu projede TMDB bilgileri **admin panelinden otomatik film/dizi bilgisi çekmek** için eklendi.

## En güvenli yöntem: Vercel Environment Variables

1. Vercel hesabına gir.
2. SineQ projesini aç.
3. **Settings** sekmesine gir.
4. **Environment Variables** bölümüne gir.
5. Yeni değişken ekle:

```text
Name: TMDB_TOKEN
Value: TMDB panelindeki API Okuma Erişim Jetonu
Environment: Production, Preview, Development
```

6. **Save** de.
7. Sonra projeyi tekrar deploy et.

> Önemli: `TMDB_TOKEN` uzun olan jetondur ve genelde `eyJ...` ile başlar. Bunu GitHub'a, app.js içine veya admin.html içine yazma.

## Kısa API key kullanacaksan

TMDB'nin kısa v3 API key'i için alternatif değişken adı:

```text
Name: TMDB_API_KEY
Value: kısa API key
```

Ama önerilen yöntem **TMDB_TOKEN** kullanmaktır.

## Local bilgisayarda test

Projede `.env.example` dosyasını `.env` olarak kopyala ve içine şunu yaz:

```text
TMDB_TOKEN=buraya_uzun_okuma_erisimi_jetonu
```

Sonra server'ı tekrar başlat.

## Admin panelde nasıl kullanılır?

1. `/admin.html` sayfasını aç.
2. **Seri Yönetimi** bölümüne gir.
3. Film/dizi adını yaz.
4. **TMDB otomatik bilgi çekme** alanındaki **Bilgileri Çek** butonuna bas.
5. Sonuçlardan doğru filmi/diziyi seç.
6. Poster, açıklama, yıl, puan, kategori, fragman ve oyuncular forma otomatik dolar.
7. Normal şekilde **İçerik Ekle** butonuna bas.

## Test endpointleri

Deploy sonrası tarayıcıdan şunu açabilirsin:

```text
/api/tmdb/status
```

`configured: true` görürsen token doğru eklenmiştir.

```text
/api/tmdb/search?q=Breaking%20Bad&type=tv
```

Sonuç geliyorsa TMDB bağlantısı çalışıyordur.

## Eklenen yeni özellikler

- TMDB otomatik bilgi çekme sistemi
- Admin panelde TMDB sonuç seçme ve form doldurma
- TMDB poster/banner/trailer/cast kaydetme
- Video link kontrol endpointi ve admin panel butonu
- Admin duyuru sistemi
- Ana sayfada aktif duyuru gösterimi
- Player içinden “Bu bölüm açılmıyor” raporu
- Admin canlı özet alanı
- TMDB_TOKEN `.env.example` alanı
