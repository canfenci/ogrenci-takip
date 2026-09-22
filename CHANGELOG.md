# Changelog

## [1.1.0] - 2026-09-22

### Added

- Öğrenci arşiv, mezuniyet ve yeniden aktifleştirme yaşam döngüsü.
- Rehberlik öğrenci detayları için erişilebilir breadcrumb navigasyonu.
- Tarihsel ders, ödev, deneme, rehberlik ve finans kayıtlarını koruyan lifecycle akışı.

### Improved

- Finans / Ödemeler ana navigasyona taşındı ve mobil erişim iyileştirildi.
- Ödev düzenleme, silme, sonuç güncelleme ve çalışma planı dağıtımı geliştirildi.
- Deneme modalları, öğrenci kokpiti ve mobil dokunma hedefleri modernleştirildi.
- Yeni kayıt işlemlerinde aktif öğrenci filtreleri uygulandı.
- Düşük riskli kullanıcı bildirimleri canonical toast sistemine taşındı.

### Fixed

- Bulut ortamında içe aktarılan ödev sonuçlarının doğru persistence akışıyla kaydedilmesi.
- Tarihsel ders ücretlerinin korunması.
- Öğrenci silme sırasında bağlı yerel kayıtların bütünlüğünün korunması.
- PWA offline shell ve başlangıç güvenilirliği.

### Technical

- Legacy öğrenci kayıtları migration gerektirmeden aktif kabul edilir.
- Öğrenci ID'leri ve tarihsel kayıtlar korunur; destructive schema migration yapılmaz.
- Release QA: 1403 / 1403 test başarılı.
