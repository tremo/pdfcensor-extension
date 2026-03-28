/**
 * Simple i18n module — detects browser locale and returns translations.
 * Supports EN and TR. Falls back to EN for unknown locales.
 */

const translations = {
  en: {
    // General tab
    general: "General",
    settings: "Settings",
    stats: "Statistics",
    status: "Status",
    statusActive: "Active — messages are being scanned",
    statusDisabled: "Disabled",
    regulation: "Regulation",
    // Login
    login: "Log in",
    logout: "Log out",
    loginDesc: "Log in to activate Pro features",
    loggedInAs: "Logged in as",
    // Pro
    upgradePro: "Upgrade to Pro",
    proFeature1: "Automatic redaction & masking",
    proFeature2: "44 PII types (email, IBAN, national ID, name...)",
    proFeature3: "File scanning (PDF, DOCX, TXT)",
    proFeature4: "Custom keyword detection",
    proFeature5: "All AI sites + generic support",
    goToPro: "Go to Pro",
    // Settings
    regulationProfile: "Regulation Profile",
    activePlatforms: "Active Platforms",
    detectionTypes: "Detection Types",
    detectionTypesHint: "If empty, defaults to regulation profile.",
    customKeywords: "Custom Keywords",
    customKeywordsHint: "Add custom words to detect.",
    addKeywordPlaceholder: "Enter keyword...",
    add: "Add",
    customKeywordsProCta: "Upgrade to Pro for custom keywords →",
    autoMask: "Auto Masking",
    autoMaskDesc: "Automatically mask when PII detected",
    notifications: "Notifications",
    notificationsDesc: "Show warning when PII detected",
    otherSites: "Other sites",
    // Stats
    scans: "Scans",
    pii: "PII",
    masked: "Masked",
    byType: "By Type",
    bySite: "By Site",
    // Toast
    scanningText: "Scanning...",
    piiDetected: "$COUNT$ sensitive data detected",
    piiDetectedCheck: "$COUNT$ sensitive data detected — review before sending.",
    personalDataInMessage: "Personal data found in your message. Would you like to mask before sending?",
    mask: "Mask",
    ignore: "Ignore",
    review: "Review",
    detectedData: "Detected Data",
    more: "+$COUNT$ more...",
    // File warning
    fileUploadWarning: "File Upload Warning",
    piiFoundInFile: "$COUNT$ personal data found!",
    fileContainsPii: "This file contains sensitive personal data. Redacting before upload is recommended.",
    autoRedactPro: "Auto Redact — Go to Pro",
    dismissAndContinue: "Dismiss and continue",
    // Detection action
    detectionAction: "Detection Action",
    detectionActionDesc: "What to do when PII is detected",
    warnOnly: "Warn Only",
    warnOnlyDesc: "Show notification, don't block sending",
    autoCensor: "Auto Censor",
    autoCensorDesc: "Automatically mask PII before sending",
    blockAndConfirm: "Block & Confirm",
    blockAndConfirmDesc: "Block sending until you review",
    proRequired: "Pro Required",
  },
  tr: {
    // General tab
    general: "Genel",
    settings: "Ayarlar",
    stats: "İstatistik",
    status: "Durum",
    statusActive: "Aktif — mesajlar taranıyor",
    statusDisabled: "Devre dışı",
    regulation: "Regülasyon",
    // Login
    login: "Giriş Yap",
    logout: "Çıkış Yap",
    loginDesc: "Pro özellikleri aktifleştirmek için giriş yapın",
    loggedInAs: "Giriş yapıldı:",
    // Pro
    upgradePro: "Pro'ya Yükselt",
    proFeature1: "Otomatik sansürleme & maskeleme",
    proFeature2: "44 PII tipi (email, IBAN, TC kimlik, isim...)",
    proFeature3: "Dosya tarama (PDF, DOCX, TXT)",
    proFeature4: "Özel anahtar kelime tespiti",
    proFeature5: "Tüm AI siteleri + generic destek",
    goToPro: "Pro'ya Geç",
    // Settings
    regulationProfile: "Regülasyon Profili",
    activePlatforms: "Aktif Platformlar",
    detectionTypes: "Tespit Edilecek Veri Tipleri",
    detectionTypesHint: "Boş bırakılırsa regülasyon profiline göre otomatik seçilir.",
    customKeywords: "Özel Anahtar Kelimeler",
    customKeywordsHint: "Tespit edilmesini istediğiniz özel kelimeleri ekleyin.",
    addKeywordPlaceholder: "Kelime girin...",
    add: "Ekle",
    customKeywordsProCta: "Özel kelime eklemek için Pro'ya geçin →",
    autoMask: "Otomatik Maskeleme",
    autoMaskDesc: "PII tespit edildiğinde otomatik maskele",
    notifications: "Bildirimler",
    notificationsDesc: "PII tespit edildiğinde uyarı göster",
    otherSites: "Diğer siteler",
    // Stats
    scans: "Tarama",
    pii: "PII",
    masked: "Maskeli",
    byType: "Tipe Göre",
    bySite: "Siteye Göre",
    // Toast
    scanningText: "Taranıyor...",
    piiDetected: "$COUNT$ hassas veri tespit edildi",
    piiDetectedCheck: "$COUNT$ hassas veri tespit edildi — göndermeden önce kontrol edin.",
    personalDataInMessage: "Mesajınızda kişisel veriler bulundu. Göndermeden önce maskelemek ister misiniz?",
    mask: "Maskele",
    ignore: "Yoksay",
    review: "İncele",
    detectedData: "Tespit Edilen Veriler",
    more: "+$COUNT$ daha...",
    // File warning
    fileUploadWarning: "Dosya Yükleme Uyarısı",
    piiFoundInFile: "$COUNT$ kişisel veri tespit edildi!",
    fileContainsPii: "Bu dosyada hassas kişisel veriler bulunuyor. Yüklemeden önce sansürlenmesi önerilir.",
    autoRedactPro: "Otomatik Sansürle — Pro'ya Geç",
    dismissAndContinue: "Yoksay ve devam et",
    // Detection action
    detectionAction: "Tespit Aksiyonu",
    detectionActionDesc: "PII tespit edildiğinde ne yapılsın",
    warnOnly: "Sadece Uyar",
    warnOnlyDesc: "Bildirim göster, gönderimi engelleme",
    autoCensor: "Otomatik Sansürle",
    autoCensorDesc: "Göndermeden önce PII'yi otomatik maskele",
    blockAndConfirm: "Durdur ve Onay Al",
    blockAndConfirmDesc: "İnceleyene kadar gönderimi engelle",
    proRequired: "Pro Gerekli",
  },
} as const;

export type Locale = keyof typeof translations;
export type TranslationKey = keyof (typeof translations)["en"];

let currentLocale: Locale = "en";

/** Detect locale from browser. Call once at init. */
export function detectLocale(): Locale {
  const lang = (navigator.language || "en").toLowerCase();
  if (lang.startsWith("tr")) {
    currentLocale = "tr";
  } else {
    currentLocale = "en";
  }
  return currentLocale;
}

/** Get a translated string. Use $COUNT$ placeholder for numbers. */
export function t(key: TranslationKey, replacements?: Record<string, string | number>): string {
  let text: string = translations[currentLocale]?.[key] || translations.en[key] || key;
  if (replacements) {
    for (const [placeholder, value] of Object.entries(replacements)) {
      text = text.replace(`$${placeholder}$`, String(value));
    }
  }
  return text;
}

export function getLocale(): Locale {
  return currentLocale;
}
