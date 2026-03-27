# Browser Extension Mimarisi — PDFcensor Content Filter

## Genel Bakış

PDFcensor Browser Extension, kullanıcıların AI chatbot'larına (ChatGPT, Claude, Gemini, Copilot vb.) mesaj göndermeden önce kişisel verileri (PII) otomatik olarak tespit edip maskelenmesini sağlayan bir tarayıcı eklentisidir.

## Teknoloji Seçimleri

| Karar | Seçim | Neden |
|-------|-------|-------|
| Framework | WXT (Vite tabanlı) | Tek codebase → Chrome MV3, Firefox, Edge, Safari otomatik build |
| UI | React + Tailwind CSS | Ana projeyle tutarlı, popup/options UI |
| PII Motoru | PDFcensor'dan port | Kanıtlanmış regex + validator altyapısı |
| Manifest | MV3 | Chrome gereksinimi, WXT otomatik üretir |
| i18n | Chrome i18n API + `_locales/` | Extension-native çeviri desteği |

---

## Dizin Yapısı

```
extension/
├── entrypoints/
│   ├── background.ts              # MV3 Service worker
│   ├── content/index.ts           # Content script (intercept send)
│   └── popup/                     # React popup UI
│       ├── App.tsx                 # Ana popup (tabs: Genel/Ayarlar/İstatistik)
│       ├── index.html
│       ├── main.tsx
│       └── components/
│           ├── Toggle.tsx          # Extension açık/kapalı toggle
│           ├── Stats.tsx           # Bugün kaç PII yakalandı
│           ├── Settings.tsx        # Regülasyon, PII tipi seçimi
│           └── ProGate.tsx         # Pro upgrade CTA
├── src/
│   ├── adapters/                  # Site-specific adaptörler
│   │   ├── types.ts               # Adapter interface
│   │   ├── chatgpt.ts             # ChatGPT DOM selectors + hooks
│   │   ├── claude.ts              # Claude.ai DOM selectors + hooks
│   │   ├── gemini.ts              # Gemini DOM selectors + hooks
│   │   ├── copilot.ts             # Microsoft Copilot DOM selectors + hooks
│   │   ├── generic.ts             # Genel form/textarea fallback
│   │   └── index.ts               # Adapter registry + auto-detect
│   ├── lib/
│   │   ├── pii/                   # PII detection (PDFcensor'dan port)
│   │   │   ├── detector.ts
│   │   │   ├── types.ts
│   │   │   ├── regulations.ts
│   │   │   ├── patterns/
│   │   │   │   ├── global.ts
│   │   │   │   ├── turkish.ts
│   │   │   │   ├── us.ts
│   │   │   │   └── names.ts
│   │   │   └── validators/
│   │   │       ├── luhn.ts
│   │   │       ├── iban.ts
│   │   │       └── tc-kimlik.ts
│   │   ├── scanner.ts             # Scan orchestrator (text → PII results)
│   │   ├── masker.ts              # Text masking ([İSİM], [TC KİMLİK], ****)
│   │   ├── storage.ts             # Chrome storage wrapper (settings, stats)
│   │   └── file-scanner.ts        # File scanning — PDF, DOCX, TXT (Pro)
│   ├── ui/
│   │   └── toast.ts               # Toast notification + review panel (Shadow DOM)
│   └── utils/
│       └── messaging.ts           # Chrome runtime message types & helpers
├── public/
│   ├── dictionaries/              # 25 locale name dictionaries (JSON)
│   └── icons/                     # Extension icons (16, 48, 128)
├── _locales/                      # Chrome i18n (en, tr, de, fr, ...)
├── wxt.config.ts                  # WXT framework config
├── tailwind.config.ts
├── postcss.config.cjs
├── tsconfig.json
└── package.json
```

---

## Çalışma Akışı

### Metin Tarama Akışı

```
Kullanıcı ChatGPT'ye mesaj yazar
        ↓
Content script textarea'yı izler (MutationObserver + input event)
        ↓
Gönder butonuna basılmadan ÖNCE → PII taraması
        ↓
  ┌─ PII bulundu ────────────────────────────────┐
  │  1. Textarea'da PII'ler renkli highlight      │
  │  2. Toast popup: "3 hassas veri tespit edildi" │
  │  3. Seçenekler:                                │
  │     [Otomatik Maskele]  [Yoksay]  [İncele]    │
  └────────────────────────────────────────────────┘
        ↓
Maskele seçilirse:
  "Ahmet Yılmaz'ın TC: 12345678901"
  → "[İSİM]'ın TC: [TC KİMLİK]"
        ↓
Maskelenmiş metin gönderilir
```

### Dosya Yükleme Akışı (Pro)

```
Kullanıcı dosya sürükler / seçer
        ↓
File input change event yakalanır
        ↓
Dosya tipine göre parse:
  - PDF → pdf.js ile metin çıkar
  - DOCX → JSZip ile XML parse
  - TXT/CSV → direkt oku
  - Resim → Tesseract.js OCR (Pro only)
        ↓
PII taraması → Rapor göster
        ↓
[Temiz versiyonu yükle] veya [Yine de gönder]
```

---

## Adapter Mimarisi

Her desteklenen site için bir adapter, site-specific DOM manipülasyonunu soyutlar:

```typescript
interface SiteAdapter {
  /** Bu adapter'ın çalışacağı URL pattern'leri */
  matches: string[];

  /** Mesaj giriş alanını bul */
  getInputElement(): HTMLElement | null;

  /** Gönder butonunu bul */
  getSendButton(): HTMLElement | null;

  /** Mesaj metnini oku */
  getMessageText(): string;

  /** Mesaj metnini değiştir (maskeleme sonrası) */
  setMessageText(text: string): void;

  /** Dosya upload input'unu bul (Pro) */
  getFileInput(): HTMLInputElement | null;

  /** Gönderimi durdur (send butonuna intercept) */
  interceptSend(callback: () => boolean): () => void;

  /** Site-specific MutationObserver setup */
  observe(callback: () => void): () => void;
}
```

### Desteklenen Siteler

| Adapter | URL Pattern | Özellikler |
|---------|-------------|------------|
| ChatGPT | `chatgpt.com/*`, `chat.openai.com/*` | Textarea + ProseMirror, file upload |
| Claude | `claude.ai/*` | ContentEditable div, file upload |
| Gemini | `gemini.google.com/*` | Rich text editor, image upload |
| Copilot | `copilot.microsoft.com/*` | Textarea, file upload |
| Generic | `*` (fallback) | Tüm textarea/input[type=text] |

---

## Mesajlaşma Protokolü (Content ↔ Background)

```typescript
// Content → Background
type ScanRequest = {
  type: "SCAN_TEXT";
  text: string;
  siteId: string;
};

type ScanFileRequest = {
  type: "SCAN_FILE";
  fileName: string;
  fileData: ArrayBuffer;
  mimeType: string;
};

type UsageCheckRequest = {
  type: "CHECK_USAGE";
};

type GetSettingsRequest = {
  type: "GET_SETTINGS";
};

// Background → Content
type ScanResponse = {
  type: "SCAN_RESULT";
  matches: PIIMatch[];
  totalCount: number;
  masked?: string; // Pro: otomatik maskelenmiş metin
};

type UsageResponse = {
  type: "USAGE_STATUS";
  remaining: number;
  isPro: boolean;
};
```

---

## Pro / Free Model

| Özellik | Free | Pro |
|---------|------|-----|
| Metin tarama | 5 mesaj/gün | Sınırsız |
| PII tipleri | Email, telefon, TC kimlik (3 tip) | Tüm 14 tip |
| Regülasyon profili | Sadece COMPREHENSIVE | GDPR, KVKK, HIPAA... hepsi |
| Dosya tarama | Yok | PDF, DOCX, TXT |
| OCR (resimden metin) | Yok | Tesseract.js |
| İsim sözlükleri | Sadece TR + EN | 25 locale |
| Desteklenen siteler | ChatGPT, Claude | Tüm AI siteleri + generic |
| İstatistik dashboard | Basit sayaç | Detaylı log + export |
| Otomatik maskeleme | Yok (sadece uyarı) | Oto-maskele + özelleştir |

---

## Pro Doğrulama

```typescript
// background/auth.ts
async function checkProStatus(): Promise<boolean> {
  // 1. Extension storage'da cached pro status kontrol
  const cached = await chrome.storage.local.get("proStatus");
  if (cached.proStatus && Date.now() - cached.proStatus.timestamp < 3600000) {
    return cached.proStatus.isPro;
  }

  // 2. pdfcensor.com'a API call (Supabase auth token ile)
  const response = await fetch("https://pdfcensor.com/api/extension/verify", {
    headers: { Authorization: `Bearer ${token}` },
  });

  // 3. Cache'le (1 saat)
  const data = await response.json();
  await chrome.storage.local.set({
    proStatus: { isPro: data.isPro, timestamp: Date.now() },
  });
  return data.isPro;
}
```

### Web App Tarafında Gerekli Endpoint

```
POST /api/extension/verify
  Headers: Authorization: Bearer <supabase_token>
  Response: { isPro: boolean, expiresAt: string | null }
```

---

## Storage Şeması

```typescript
interface ExtensionStorage {
  // Ayarlar
  settings: {
    enabled: boolean;            // Extension açık/kapalı
    regulation: RegulationType;  // Seçili regülasyon profili
    customPiiTypes: PIIType[];   // CUSTOM modda seçili tipler
    autoMask: boolean;           // Pro: otomatik maskeleme
    showNotifications: boolean;  // Toast bildirimleri
  };

  // Kullanım sayacı (Free tier)
  usage: {
    date: string;    // YYYY-MM-DD
    count: number;   // Bugünkü tarama sayısı
  };

  // İstatistikler
  stats: {
    totalScans: number;
    totalPiiFound: number;
    totalMasked: number;
    byType: Record<PIIType, number>;
    bySite: Record<string, number>;
  };

  // Pro durumu (cached)
  proStatus: {
    isPro: boolean;
    timestamp: number;
  } | null;
}
```

---

## Shadow DOM UI

Toast ve review panel, Shadow DOM içinde render edilir. Bu sayede:
- Site'nin CSS'i toast'ı bozmaz
- Toast'ın CSS'i site'yi bozmaz
- Content Security Policy sorunları minimize edilir

```typescript
// ui/toast.ts
function createToastContainer(): ShadowRoot {
  const host = document.createElement("pdfcensor-toast");
  const shadow = host.attachShadow({ mode: "closed" });
  // Tailwind CSS inline olarak enjekte edilir
  document.body.appendChild(host);
  return shadow;
}
```

---

## Geliştirme Planı

### Faz 1 — MVP (2 hafta)
- [x] WXT setup, Chrome MV3
- [x] PII modülü entegrasyonu (port from web app)
- [ ] ChatGPT + Claude content script (metin tarama)
- [ ] Background service worker (scan orchestration)
- [ ] Basit popup UI (toggle + highlight + uyarı)
- [ ] Free tier limitleri (5 mesaj/gün)

### Faz 2 — Pro + Dosya (2 hafta)
- [ ] Supabase auth entegrasyonu (OAuth popup)
- [ ] Pro doğrulama endpoint (web app tarafı)
- [ ] Dosya upload yakalama (PDF, DOCX)
- [ ] Gemini, Copilot, generic site desteği
- [ ] Otomatik maskeleme (Pro)

### Faz 3 — Cross-browser + Polish (1 hafta)
- [ ] Firefox, Edge, Safari build (WXT otomatik)
- [ ] İstatistik dashboard (popup)
- [ ] Chrome Web Store yayını
- [ ] Extension landing page (web app)

---

## Web App'e Eklenmesi Gerekenler

| Değişiklik | Dosya | Açıklama |
|-----------|-------|----------|
| Extension verify endpoint | `/api/extension/verify/route.ts` | Supabase token ile Pro doğrulama |
| Extension login callback | `/api/extension/auth/route.ts` | OAuth popup callback |
| Extension landing page | `/[locale]/extension/page.tsx` | Kurulum rehberi + CTA |
| Pricing badge | `/[locale]/pricing/page.tsx` | Extension Pro badge'i |
