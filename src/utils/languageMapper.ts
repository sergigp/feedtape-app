// Language Mapper Utility
// Maps ISO 639-3 language codes (franc output) to BCP-47 codes (expo-speech input)

/**
 * Map of ISO 639-3 language codes to BCP-47 language tags
 * franc returns ISO 639-3 codes (3-letter codes like 'eng', 'spa')
 * expo-speech expects BCP-47 tags (like 'en-US', 'es-ES')
 */
const ISO_639_3_TO_BCP_47: Record<string, string> = {
  // Major European languages
  'eng': 'en-US',    // English
  'spa': 'es-ES',    // Spanish
  'fra': 'fr-FR',    // French
  'deu': 'de-DE',    // German
  'ita': 'it-IT',    // Italian
  'por': 'pt-PT',    // Portuguese
  'nld': 'nl-NL',    // Dutch
  'pol': 'pl-PL',    // Polish
  'swe': 'sv-SE',    // Swedish
  'nor': 'nb-NO',    // Norwegian (Bokmål)
  'dan': 'da-DK',    // Danish
  'fin': 'fi-FI',    // Finnish
  'ell': 'el-GR',    // Greek
  'ces': 'cs-CZ',    // Czech
  'hun': 'hu-HU',    // Hungarian
  'ron': 'ro-RO',    // Romanian
  'cat': 'ca-ES',    // Catalan
  'hrv': 'hr-HR',    // Croatian
  'slk': 'sk-SK',    // Slovak
  'bul': 'bg-BG',    // Bulgarian
  'srp': 'sr-RS',    // Serbian
  'slv': 'sl-SI',    // Slovenian
  'est': 'et-EE',    // Estonian
  'lav': 'lv-LV',    // Latvian
  'lit': 'lt-LT',    // Lithuanian
  'ukr': 'uk-UA',    // Ukrainian
  'isl': 'is-IS',    // Icelandic

  // Asian languages
  'rus': 'ru-RU',    // Russian
  'jpn': 'ja-JP',    // Japanese
  'kor': 'ko-KR',    // Korean
  'cmn': 'zh-CN',    // Mandarin Chinese (Simplified)
  'zho': 'zh-CN',    // Chinese (generic, map to Simplified)
  'yue': 'zh-HK',    // Cantonese
  'ara': 'ar-SA',    // Arabic
  'hin': 'hi-IN',    // Hindi
  'ben': 'bn-IN',    // Bengali
  'tur': 'tr-TR',    // Turkish
  'tha': 'th-TH',    // Thai
  'vie': 'vi-VN',    // Vietnamese
  'ind': 'id-ID',    // Indonesian
  'msa': 'ms-MY',    // Malay
  'tgl': 'fil-PH',   // Tagalog (Filipino)
  'heb': 'he-IL',    // Hebrew
  'urd': 'ur-PK',    // Urdu
  'fas': 'fa-IR',    // Persian (Farsi)

  // Additional common languages
  'afr': 'af-ZA',    // Afrikaans
  'swa': 'sw-KE',    // Swahili
  'tam': 'ta-IN',    // Tamil
  'tel': 'te-IN',    // Telugu
  'mar': 'mr-IN',    // Marathi
  'guj': 'gu-IN',    // Gujarati
  'kan': 'kn-IN',    // Kannada
  'mal': 'ml-IN',    // Malayalam
  'pan': 'pa-IN',    // Punjabi
};

/**
 * Converts an ISO 639-3 language code to a BCP-47 language tag
 *
 * @param iso639_3Code - The 3-letter ISO 639-3 code (e.g., 'eng', 'spa', 'fra')
 * @returns BCP-47 language tag (e.g., 'en-US', 'es-ES', 'fr-FR') or null if unmapped
 *
 * @example
 * iso6393ToBCP47('eng') // Returns 'en-US'
 * iso6393ToBCP47('spa') // Returns 'es-ES'
 * iso6393ToBCP47('xyz') // Returns null (unknown language)
 */
export function iso6393ToBCP47(iso639_3Code: string): string | null {
  const bcp47 = ISO_639_3_TO_BCP_47[iso639_3Code];

  if (!bcp47) {
    console.warn(`[LanguageMapper] No BCP-47 mapping found for ISO 639-3 code: ${iso639_3Code}`);
    return null;
  }

  return bcp47;
}