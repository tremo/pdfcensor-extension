# Extension Mağaza Yayınlama Rehberi

OfflineRedact — AI Privacy Guard extension'ının Chrome Web Store, Firefox Add-ons (AMO) ve Microsoft Edge Add-ons mağazalarına yayınlanması için adım adım rehber.

---

## 1. Ön Koşullar

### Geliştirici Hesapları

| Mağaza | Kayıt URL | Ücret |
|--------|-----------|-------|
| Chrome Web Store | https://chrome.google.com/webstore/devconsole | Tek seferlik **$5** |
| Firefox Add-ons (AMO) | https://addons.mozilla.org/developers/ | **Ücretsiz** (Firefox hesabı gerekli) |
| Microsoft Edge Add-ons | https://partner.microsoft.com/dashboard/microsoftedge | **Ücretsiz** (Microsoft hesabı gerekli) |

### Diğer Gereksinimler

- **Gizlilik Politikası URL'i** — Herkese açık bir URL'de barındırılmalı (ör. `offlineredact.com/privacy`). Her üç mağaza tarafından zorunlu tutulur.
- **Destek e-postası** — Kullanıcıların iletişim kurabileceği bir e-posta adresi.
- **Web sitesi** — `offlineredact.com` (Chrome Web Store için gerekli).
- **Node.js 22+** — Lokal build için.

### Gizlilik Politikasında Belirtilmesi Gerekenler

- Extension'ın yalnızca **yerel/offline** işlem yaptığı (veri sunucuya gönderilmediği)
- Hangi verilere erişildiği (AI chatbot giriş alanlarındaki metin)
- Supabase auth ile tutulan oturum verileri
- `storage` API ile saklanan kullanıcı tercihleri

---

## 2. Build (Derleme)

### Lokal Build

```bash
# Bağımlılıkları kur
npm ci

# Chrome (.output/ dizininde *chrome*.zip)
npm run zip

# Firefox (.output/ dizininde *firefox*.zip)
npm run zip:firefox

# Edge (Chrome build ile aynı)
npm run zip:edge
```

### CI/CD ile Otomatik Build

Git tag push'u ile GitHub Actions otomatik olarak release artifact'leri oluşturur:

```bash
git tag v1.0.0
git push origin v1.0.0
```

Workflow (`.github/workflows/build.yml`) şunları üretir:
- `offlineredact-chrome-v1.0.0.zip`
- `offlineredact-edge-v1.0.0.zip`
- `offlineredact-firefox-v1.0.0.zip`

Tag push'unda otomatik GitHub Release oluşturulur ve zip'ler release asset olarak eklenir.

---

## 3. Gerekli Görseller ve Metinler

### Görseller

| Görsel | Chrome | Firefox | Edge | Boyut |
|--------|--------|---------|------|-------|
| Uygulama ikonu | ✅ Zorunlu | ✅ Zorunlu | ✅ Zorunlu | 128×128 px (mevcut: `public/icons/icon-128.png`) |
| Tanıtım görseli | ✅ Zorunlu | ❌ | İsteğe bağlı | 440×280 px |
| Büyük tanıtım görseli | İsteğe bağlı | ❌ | İsteğe bağlı | 920×680 px |
| Ekran görüntüleri | Min 1, max 5 | Min 1 | Min 1, max 10 | 1280×800 veya 640×400 px |

> **İpucu**: Ekran görüntülerini temiz bir tarayıcı profilinde, gerçek kullanım senaryolarıyla (ör. ChatGPT'de PII tespiti, maskeleme toast bildirimi) alın.

### Kısa Açıklama (132 karakter)

**EN:** Automatically detects and redacts sensitive personal data (PII) before you send it to AI chatbots.

**TR:** AI chatbot'larına göndermeden önce hassas kişisel verileri (PII) otomatik olarak tespit eder ve maskeler.

### Uzun Açıklama

**EN:**
```
OfflineRedact — AI Privacy Guard automatically scans your messages for sensitive
personal data (PII) before you send them to AI chatbots. All processing happens
locally in your browser — your data never leaves your device.

✦ Supported Sites: ChatGPT, Claude, Gemini, Copilot, Gmail, Outlook, Notion,
  Slack, Discord
✦ Detects: Names, emails, phone numbers, credit cards, IBAN, TC ID, SSN,
  passport numbers, addresses, dates of birth, and more
✦ Regulations: GDPR, KVKK, HIPAA, CCPA compliant detection profiles
✦ File Scanning: PDF, DOCX, and TXT file upload scanning (Pro)
✦ 100% Offline: Zero data collection — everything runs in your browser
✦ Multi-language: English and Turkish interface

Free tier: 5 scans/day with core PII types.
Pro tier: Unlimited scans, all 14+ PII types, file scanning, custom keywords.
```

**TR:**
```
OfflineRedact — AI Privacy Guard, AI chatbot'larına göndermeden önce
mesajlarınızdaki hassas kişisel verileri (PII) otomatik olarak tarar.
Tüm işlemler tarayıcınızda yerel olarak gerçekleşir — verileriniz cihazınızdan
asla ayrılmaz.

✦ Desteklenen Siteler: ChatGPT, Claude, Gemini, Copilot, Gmail, Outlook,
  Notion, Slack, Discord
✦ Tespit: İsimler, e-postalar, telefon numaraları, kredi kartları, IBAN,
  TC Kimlik No, pasaport numaraları, adresler, doğum tarihleri ve daha fazlası
✦ Regülasyonlar: GDPR, KVKK, HIPAA, CCPA uyumlu tespit profilleri
✦ Dosya Tarama: PDF, DOCX ve TXT dosya yükleme taraması (Pro)
✦ %100 Çevrimdışı: Sıfır veri toplama — her şey tarayıcınızda çalışır
✦ Çoklu Dil: İngilizce ve Türkçe arayüz

Ücretsiz plan: Günde 5 tarama, temel PII türleri.
Pro plan: Sınırsız tarama, 14+ PII türü, dosya tarama, özel anahtar kelimeler.
```

### Kategori

| Mağaza | Önerilen Kategori |
|--------|-------------------|
| Chrome Web Store | Productivity |
| Firefox AMO | Privacy & Security |
| Edge Add-ons | Productivity |

---

## 4. Chrome Web Store Yayın Süreci

### Adım 1: Developer Dashboard'a Giriş
https://chrome.google.com/webstore/devconsole adresine gidin.

### Adım 2: Yeni Öğe Oluştur
"New Item" / "Yeni Öğe" butonuna tıklayın.

### Adım 3: ZIP Yükle
`npm run zip` ile oluşturulan `.output/` dizinindeki `*chrome*.zip` dosyasını yükleyin.

### Adım 4: Store Listing (Mağaza Bilgileri)
- **Dil**: English (varsayılan), Turkish ekleyin
- **Açıklama**: Yukarıdaki hazır metinleri kullanın
- **Kategori**: Productivity
- **Ekran görüntüleri**: Minimum 1 adet (1280×800 px)
- **Tanıtım görseli**: 440×280 px (zorunlu)

### Adım 5: Privacy Practices (Gizlilik Uygulamaları)

Her izin için gerekçe yazmanız gerekir:

| İzin | Gerekçe |
|------|---------|
| `storage` | Saving user preferences (regulation profile, theme), usage counters, and cached Pro subscription status |
| `activeTab` | Reading text content from the active AI chatbot tab to scan for PII before the user sends a message |
| `identity` | OAuth authentication flow via Supabase for Pro subscription verification |
| `alarms` | Resetting daily free-tier usage counter at midnight |
| `tabs` | Detecting which supported AI site the user is currently on to activate the correct site adapter |

**Host permissions gerekçesi**: Each host permission corresponds to a supported AI/productivity site where the extension scans user input for PII. `offlineredact.com` is used for authentication and Pro subscription management.

**Single purpose açıklaması**: "Detects and masks personally identifiable information (PII) in user input on AI chatbot and productivity sites."

**Data use disclosures**:
- ❌ Does not collect user data
- ❌ Does not sell user data
- ✅ All PII processing happens locally in the browser
- ✅ Authentication tokens sent to offlineredact.com for subscription verification only

### Adım 6: Distribution (Dağıtım)
- **Visibility**: Public (Herkese açık)
- **Countries**: All regions

### Adım 7: Gönder
"Submit for review" butonuna tıklayın.

---

## 5. Firefox Add-ons (AMO) Yayın Süreci

### Adım 1: Developer Hub'a Giriş
https://addons.mozilla.org/developers/ adresine gidin.

### Adım 2: Yeni Add-on Gönder
"Submit a New Add-on" butonuna tıklayın.

### Adım 3: ZIP Yükle
`npm run zip:firefox` ile oluşturulan `.output/` dizinindeki `*firefox*.zip` dosyasını yükleyin. Bu **MV2** (Manifest V2) build'dir — WXT framework Firefox için otomatik olarak MV2 üretir.

### Adım 4: Dağıtım Türü
"On this site" (AMO'da listelenmek için) seçeneğini seçin.

### Adım 5: Kaynak Kod Gönderimi

> **ÖNEMLİ**: Extension WXT/Vite ile bundle edildiğinden, Firefox inceleme ekibi kaynak kodunuzu isteyecektir.

Kaynak kod arşivi hazırlamak için:

```bash
# Proje kök dizininde
git archive --format=zip --output=source-code.zip HEAD
```

Arşivle birlikte build talimatlarını da ekleyin:
```
Build Instructions:
1. Node.js 22+ required
2. Run: npm ci
3. Run: npm run zip:firefox
4. Output: .output/ directory contains the Firefox zip
```

### Adım 6: Listing Bilgileri
- **Ad**: OfflineRedact — AI Privacy Guard
- **Açıklama**: Hazır metinleri kullanın
- **Kategoriler**: Privacy & Security
- **Ekran görüntüleri**: Minimum 1 adet
- **Ana sayfa**: offlineredact.com
- **Destek e-postası**: İletişim e-postanız
- **Gizlilik politikası URL'i**: offlineredact.com/privacy

### Adım 7: Türkçe Çeviri
Listing sayfasında "Add translation" ile Türkçe çevirileri de ekleyin.

### Adım 8: Gönder
Gönderimi tamamlayın.

---

## 6. Microsoft Edge Add-ons Yayın Süreci

### Adım 1: Partner Center'a Giriş
https://partner.microsoft.com/dashboard/microsoftedge/overview adresine gidin.

### Adım 2: Yeni Extension Oluştur
"Create new extension" butonuna tıklayın.

### Adım 3: ZIP Yükle
Chrome build ile **aynı** zip'i kullanabilirsiniz:
- `npm run zip` veya `npm run zip:edge` ile oluşturulan zip
- Veya CI'dan indirilen `offlineredact-edge-v*.zip`

Edge, Chromium tabanlı olduğu için Chrome MV3 build'i doğrudan kabul eder.

### Adım 4: Özellikler
- **Görünen ad**: OfflineRedact — AI Privacy Guard
- **Açıklama**: Hazır metinleri kullanın
- **Kategori**: Productivity
- **Gizlilik politikası URL'i**: offlineredact.com/privacy
- **Web sitesi URL'i**: offlineredact.com
- **Destek iletişim URL'i**: Destek e-postanız

### Adım 5: Mağaza Listeleme
- Ekran görüntülerini yükleyin (min 1, max 10)
- Kısa ve uzun açıklamaları girin
- Dil olarak English ve Turkish ekleyin

### Adım 6: Gönder
"Publish" butonuyla gönderimi tamamlayın.

---

## 7. İnceleme Süreleri

| Mağaza | İlk İnceleme | Güncelleme İncelemesi | Notlar |
|--------|-------------|----------------------|--------|
| **Chrome Web Store** | 1–3 iş günü (bazen 1-2 hafta) | 1–3 gün | `identity` izni ve geniş host permissions ek incelemeye neden olabilir |
| **Firefox AMO** | 1–5 gün (manuel inceleme yaygın) | 1–3 gün | Bundle edilmiş kod kaynak incelemesini uzatabilir |
| **Edge Add-ons** | 3–7 iş günü (bazen daha uzun) | 2–5 gün | Genellikle en yavaş inceleme süreci |

### Sık Karşılaşılan Reddedilme Nedenleri

| Neden | Çözüm |
|-------|-------|
| **Geniş host permissions** | Her domain için neden erişim gerektiğini açıklayın (her biri desteklenen bir AI/üretkenlik sitesi) |
| **`identity` izni** | OAuth akışını detaylı açıklayın: "Used for Supabase OAuth to verify Pro subscription" |
| **"Single purpose" ihlali** | Tüm özellikleri "PII koruması" çatısı altında çerçeveleyin |
| **Gizlilik politikası eksik/yetersiz** | Politikanın herkese açık, güncel ve tüm veri uygulamalarını kapsadığından emin olun |
| **Kaynak kod eksik (Firefox)** | Build talimatlarıyla birlikte kaynak kod arşivi gönderin |

---

## 8. Güncelleme ve Versiyon Yönetimi

### Versiyon Güncelleme Adımları

1. `wxt.config.ts` dosyasındaki `version` alanını güncelleyin:
   ```ts
   version: "1.1.0",
   ```

2. `package.json` dosyasındaki `version` alanını da güncelleyin:
   ```json
   "version": "1.1.0",
   ```

3. Değişiklikleri commit'leyin ve tag oluşturun:
   ```bash
   git add -A
   git commit -m "chore: bump version to 1.1.0"
   git tag v1.1.0
   git push origin main --tags
   ```

4. GitHub Actions otomatik olarak yeni zip'leri oluşturacak ve Release'e ekleyecek.

5. Her mağazanın geliştirici panelinde "Update" / "Güncelle" seçeneğiyle yeni zip'i yükleyin.

### Güncelleme Kontrol Listesi

- [ ] `wxt.config.ts` → `version` güncellendi
- [ ] `package.json` → `version` güncellendi
- [ ] Changelog güncellendi (varsa)
- [ ] Git tag oluşturuldu ve push edildi
- [ ] CI build başarılı
- [ ] Chrome Web Store'a yeni zip yüklendi
- [ ] Firefox AMO'ya yeni zip yüklendi
- [ ] Edge Add-ons'a yeni zip yüklendi
- [ ] Her mağazada release notes eklendi

### Otomatik Güncelleme

- **Chrome & Edge**: Kullanıcılara 24–48 saat içinde otomatik güncelleme dağıtılır
- **Firefox**: Otomatik güncelleme biraz daha uzun sürebilir

---

## 9. İpuçları

- **Tutarlılık**: Üç mağazadaki açıklamalar, görseller ve gizlilik politikası tutarlı olsun.
- **Test**: Her tarayıcıda (Chrome, Firefox, Edge) gönderimden önce extension'ı test edin.
- **Gizlilik politikası**: Yeni özellik eklendiğinde politikayı güncelleyin.
- **Kullanıcı yorumları**: Mağaza yorumlarını düzenli takip edin ve yanıtlayın.
- **Yerelleştirme**: `_locales/` dizininde mevcut EN ve TR çevirileri mağaza listelerinde de kullanın.
- **Ekran görüntüleri**: Her desteklenen site için (ChatGPT, Claude, Gemini) ayrı ekran görüntüsü almak, dönüşüm oranını artırır.
