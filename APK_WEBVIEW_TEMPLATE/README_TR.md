# QasimFlix APK WebView Native Template

Bu klasör, mevcut siteni Android Studio WebView APK içine koyarken kullanman için hazır örnektir.

## Ne ekler?

- Google Drive/iframe dahil WebView tam ekran video desteği
- Video açılınca yatay moda geçme
- Geri tuşunda önce player/tam ekran kapatma
- Ekran açık tutma
- Dosya seçme desteği
- Native indirme desteği
- `window.QasimFlixAndroid` bridge desteği

## Kullanım

1. Android Studio projenin `MainActivity.java` dosyasını buradaki dosyayla karşılaştırıp değiştir.
2. `HOME_URL` değerini kendi Vercel site adresinle değiştir:

```java
private static final String HOME_URL = "https://SENIN-SITEN.vercel.app/index.html?source=apk";
```

3. Manifest içindeki izinleri kendi projenin `AndroidManifest.xml` dosyasına ekle.
4. `app/build.gradle` içindeki ayarları kendi Gradle dosyana uygula.

> Not: Bu klasör direkt site içinde çalışmaz; Android Studio projesine kopyalanacak hazır şablondur.
