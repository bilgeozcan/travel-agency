# Postman API Test Suite - Travel Agency Backend

Bu klasör, backend API'sini test etmek için hazırlanmış bir Postman collection'ı ve
sandbox ortamının API Gateway URL'ini otomatik bulan bir yardımcı script içerir.

## İçindekiler

| Dosya | Ne işe yarar |
|---|---|
| `travel-agency-api-tests.postman_collection.json` | Ana test suite'i - Auth, Tours, Bookings, Profile uçlarını ve bilinen edge case'leri kapsar |
| `generate-postman-env.ps1` | Sandbox'ının API Gateway URL'ini AWS CLI ile bulup, Postman'e import edilebilir bir environment dosyası üretir |

---

## Kurulum (ilk kullanımda)

### 1) Backend'in ayakta ve seed edilmiş olduğundan emin ol

```powershell
cd ../deployment
python tour_detail_seed.py
```

Tour/review verisi olmadan `2) Tours` klasöründeki testler boş veri döner. Script,
kendi `syndicate_aliases.yml`'inden tablo adlarını otomatik çözer - parametre vermene
gerek yok (bkz. script'in kendi başındaki docstring, `--dry-run` ile önizleme yapabilirsin).

### 2) Collection'ı Postman'e import et

Postman → **File → Import** → `travel-agency-api-tests.postman_collection.json` seç.

### 3) API URL'ini otomatik bul ve environment oluştur

```powershell
cd ../postman
.\generate-postman-env.ps1
```

Bu, `sandbox.postman_environment.json` adında bir dosya üretir ve API URL'ini panoya
kopyalar. Script'in kendi parametreleri (API Gateway isim deseni, region) için
başındaki docstring'e bak - varsayılanlar `ahmet-sandbox` deseni ve `eu-west-3` region'ı
içindir, kendi ortamına göre `-NamePattern`/`-Region` ile değiştirebilirsin.

### 4) Environment'ı Postman'e import et ve aktif et

Üretilen `sandbox.postman_environment.json` dosyasına çift tıkla (ya da File → Import),
sonra Postman'in **sağ üst köşesindeki** environment seçiciden bu environment'i seç
(aktif hale getir). Bu adım olmadan istekler `base_url` çözemez.

---

## Kullanım

Klasörleri bu sırayla çalıştır:

1. **`1) Auth`** - Sign Up → Sign In (bu ikisi `accessToken`/`idToken`/`userId` değişkenlerini
   otomatik doldurur, sonraki isteklerin çoğu buna bağlı). Duplicate sign-up ve wrong
   password testleri kontrat davranışını doğrular.
2. **`2) Tours`** - Filtreler (mealPlan/destination/tourType/sortBy) ve edge case'ler
   (dolu tur listede görünmemeli ama detaydan erişilebilir olmalı, review'siz tur boş
   liste dönmeli).
3. **`3) Bookings`** - Validate/Create/Get/Update/Cancel akışı.
4. **`4) Profile`** - Güncelleme + email değiştirme engeli + validasyon edge case'leri.

Tek tek çalıştırabilir ya da collection'ın üstüne sağ tık → **Run Collection** ile
topluca koşturabilirsin (aşağıdaki uyarıyı okuduktan sonra).

Her isteğin **Tests** sekmesinde neyin doğrulandığı yazıyor; ayrıntılı response body'leri
görmek için Postman **Console**'unu aç (`View → Show Postman Console` ya da `Ctrl+Alt+C`).

---

## ⚠️ Dikkat edilmesi gerekenler

### Yıkıcı istek: `Cancel Booking`
`3) Bookings` klasöründeki **`Cancel Booking [DIKKAT: YIKICI ISTEK]`** isteği, `bookingId`
değişkenindeki gerçek booking'i **kalıcı olarak iptal eder**. Collection'ı "Run Collection"
ile toplu çalıştırırsan bu istek de otomatik tetiklenir. İlk denemelerinde bu isteği
runner dışında, tek başına ve bilerek çalıştır.

### Bilinen blokaj: `Create Booking`
`Create Booking [BILINEN BLOKAJ - bookingToken eksik]` isteği **şu an başarısız olması
beklenen** bir test - backend, OAS sözleşmesinde (`CreateBookingRequestDetailsDTO`)
tanımlı olmayan bir `bookingToken` alanı istiyor. Test bu durumu doğruluyor (400 +
`bookingToken` hatası beklendiği için **PASS** görünür). Eğer bu test bir gün **FAIL**
verirse (yani 201 dönerse), bu iyi haberdir - blokaj çözülmüş demektir, testin
assertion'ını ve açıklamasını güncelle.

Aynı şekilde `Validate Booking` isteği de OAS'ta tanımlı olmayan bir `components`
(flight/accommodation/activities) gereksinimi yüzünden normal koşulda 409 dönüyor -
bu da bilinen, backend tarafında netleştirilmesi gereken bir kontrat farkı.

### Ortam değişti mi?
Sandbox'ı `syn clean` + yeniden `syn deploy` ettiysen, API Gateway ID'si **değişir**.
`generate-postman-env.ps1`'i tekrar çalıştırıp environment'ı yeniden import etmen gerekir -
eski environment artık geçersiz bir URL'e işaret eder.

---

## Sorun giderme

- **İstekler 401/403 dönüyor:** Environment aktif mi kontrol et (sağ üst köşe), `1) Auth`
  klasöründeki Sign In isteğini önce çalıştırdın mı kontrol et.
- **Tours boş dönüyor:** `tour_detail_seed.py` çalıştırılmamış olabilir.
- **`generate-postman-env.ps1` API Gateway bulamıyor:** `syn deploy --replace-output`
  çalıştırılmış mı, ve `-NamePattern` senin gerçek API Gateway isminle eşleşiyor mu kontrol et
  (`aws apigateway get-rest-apis --output table` ile tüm API'leri listeleyebilirsin).