# SineQ — AI Altyazı Oluşturucu Güncellemesi

Bu güncellemede admin paneline otomatik altyazı üretme sistemi eklendi.

## Ne yapar?

Admin panelinde **Altyazılar** bölümünden:

1. Seri ve bölüm seçilir.
2. Video veya ses dosyası yüklenir.
3. Kaynak dil seçilir veya otomatik algılama kullanılır.
4. Hedef dil varsayılan olarak Arapça seçilir.
5. Sistem konuşmayı algılar.
6. Metni Arapçaya çevirir.
7. Hem **VTT** hem **SRT** dosyası üretir.
8. İstersen seçili bölüme otomatik kaydeder.

## Gerekli Vercel Environment Variables

```txt
OPENAI_API_KEY=...
OPENAI_TRANSCRIBE_MODEL=whisper-1
OPENAI_TRANSLATE_MODEL=gpt-4o-mini
SUBTITLE_UPLOAD_MAX_MB=50
```

## Önemli not

Vercel üzerinde 400 MB / 1.6 GB gibi büyük video dosyalarını işlemek uygun değildir. En iyi kullanım:

- videodan sesi MP3/M4A olarak çıkar,
- admin paneline ses dosyasını yükle,
- altyazıyı üret,
- çıkan SRT/VTT dosyasını indir veya bölüme kaydet.

Google Drive videosuna altyazı eklemek için Drive panelinden ilgili videoya SRT dosyasını manuel ekleyebilirsin.

Bu aracı sadece kendi hakkın olan veya lisanslı videolar için kullan.

## Anime güncellemesi

Public site ve admin panelinde **Belgeseller** alanı **Anime** olarak değiştirildi. Admin panelinde içerik türü olarak `Anime` seçilebilir. Anime içerikleri public tarafta Anime satırında görünür.
