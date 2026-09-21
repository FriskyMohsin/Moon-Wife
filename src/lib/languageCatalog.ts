export interface LanguageItem {
  code: string;
  name: string;
  nativeName: string;
  isRtl?: boolean;
  isPopular?: boolean;
  voiceSupported?: boolean;
}

export const ALL_LANGUAGES: LanguageItem[] = [
  { code: 'en', name: 'English', nativeName: 'English', isPopular: true, voiceSupported: true },
  { code: 'ur', name: 'Urdu', nativeName: 'اردو', isRtl: true, isPopular: true, voiceSupported: true },
  { code: 'ur-roman', name: 'Roman Urdu', nativeName: 'Roman Urdu', isPopular: true, voiceSupported: true },
  { code: 'hi', name: 'Hindi', nativeName: 'हिन्दी', isPopular: true, voiceSupported: true },
  { code: 'bn', name: 'Bengali / Bangla', nativeName: 'বাংলা', isPopular: true, voiceSupported: true },
  { code: 'ar', name: 'Arabic', nativeName: 'العربية', isRtl: true, isPopular: true, voiceSupported: true },
  { code: 'pa', name: 'Punjabi', nativeName: 'ਪੰਜਾਬੀ', isPopular: false, voiceSupported: false },
  { code: 'ps', name: 'Pashto', nativeName: 'پښتو', isRtl: true, isPopular: false, voiceSupported: false },
  { code: 'fa', name: 'Persian / Farsi', nativeName: 'فارسی', isRtl: true, isPopular: false, voiceSupported: false },
  { code: 'tr', name: 'Turkish', nativeName: 'Türkçe', isPopular: true, voiceSupported: true },
  { code: 'id', name: 'Indonesian', nativeName: 'Bahasa Indonesia', isPopular: false, voiceSupported: true },
  { code: 'ms', name: 'Malay', nativeName: 'Bahasa Melayu', isPopular: false, voiceSupported: false },
  { code: 'es', name: 'Spanish', nativeName: 'Español', isPopular: true, voiceSupported: true },
  { code: 'fr', name: 'French', nativeName: 'Français', isPopular: true, voiceSupported: true },
  { code: 'de', name: 'German', nativeName: 'Deutsch', isPopular: true, voiceSupported: true },
  { code: 'it', name: 'Italian', nativeName: 'Italiano', isPopular: false, voiceSupported: true },
  { code: 'pt', name: 'Portuguese', nativeName: 'Português', isPopular: false, voiceSupported: true },
  { code: 'ru', name: 'Russian', nativeName: 'Русский', isPopular: false, voiceSupported: true },
  { code: 'zh', name: 'Chinese', nativeName: '中文', isPopular: true, voiceSupported: true },
  { code: 'ja', name: 'Japanese', nativeName: '日本語', isPopular: true, voiceSupported: true },
  { code: 'ko', name: 'Korean', nativeName: '한국어', isPopular: false, voiceSupported: true },
  { code: 'ta', name: 'Tamil', nativeName: 'தமிழ்', isPopular: false, voiceSupported: false },
  { code: 'te', name: 'Telugu', nativeName: 'తెలుగు', isPopular: false, voiceSupported: false },
  { code: 'mr', name: 'Marathi', nativeName: 'मराठी', isPopular: false, voiceSupported: false },
  { code: 'gu', name: 'Gujarati', nativeName: 'ગુજરાતી', isPopular: false, voiceSupported: false },
  { code: 'ne', name: 'Nepali', nativeName: 'नेपाली', isPopular: false, voiceSupported: false },
];

export const POPULAR_LANGUAGES = ALL_LANGUAGES.filter((l) => l.isPopular);

export function isRtlLanguage(langStr: string): boolean {
  if (!langStr) return false;
  const clean = langStr.toLowerCase().trim();
  if (clean.includes('roman')) return false; // Roman Urdu is written in Latin/LTR
  return ALL_LANGUAGES.some((l) => l.isRtl && (
    clean === l.code ||
    clean.includes(l.name.toLowerCase()) ||
    clean.includes(l.nativeName.toLowerCase())
  ));
}

export function searchLanguages(query: string, category: 'all' | 'popular' = 'all'): LanguageItem[] {
  const source = category === 'popular' ? POPULAR_LANGUAGES : ALL_LANGUAGES;
  const q = query.toLowerCase().trim();
  if (!q) return source;

  return source.filter((l) =>
    l.name.toLowerCase().includes(q) ||
    l.nativeName.toLowerCase().includes(q) ||
    l.code.toLowerCase().includes(q)
  );
}

export function getLanguageByCodeOrName(val: string): LanguageItem {
  if (!val) return ALL_LANGUAGES[0];
  const q = val.toLowerCase().trim();
  const found = ALL_LANGUAGES.find(
    (l) => l.name.toLowerCase() === q || l.nativeName.toLowerCase() === q || l.code.toLowerCase() === q
  );
  if (found) return found;

  // Fallback for custom extensible languages
  return {
    code: val.toLowerCase().replace(/[^a-z0-9]/g, '-'),
    name: val,
    nativeName: val,
    isRtl: isRtlLanguage(val),
    voiceSupported: true,
  };
}

export function getLanguageDirective(langStr: string, autoMatch: boolean = false): string {
  const langObj = getLanguageByCodeOrName(langStr);
  const rtlNote = langObj.isRtl ? ' (Note: Written in Right-To-Left script)' : '';

  let directive = `\n\nPRIMARY LANGUAGE INSTRUCTION:
Your default primary conversation language is ${langObj.name} (${langObj.nativeName})${rtlNote}. You MUST normally converse, explain concepts, and respond in ${langObj.name} (${langObj.nativeName}).`;

  if (langObj.name === 'Roman Urdu' || langObj.code === 'ur-roman' || langStr.toLowerCase().includes('roman urdu')) {
    directive = `\n\nPRIMARY LANGUAGE INSTRUCTION (ROMAN URDU):
You MUST normally converse and respond in natural Roman Urdu (e.g., "Ji bilkul, main aap ki mukammal madad karoon ga/gi. Aap batayein kya samajhna chahte hain?"). Speak in clear, warm, conversational Roman Urdu phrasing unless explicitly requested to speak in another language.`;
  }

  if (autoMatch) {
    directive += `\n\nAUTOMATIC LANGUAGE MATCHING (ENABLED):
You must dynamically inspect the user's incoming message. If the user writes in English, Urdu, Hindi, Arabic, Bengali, French, Spanish, Roman Urdu, or any other language, respond in that EXACT same language/script. If the user's language is ambiguous or short, fall back to your Primary Language: ${langObj.name} (${langObj.nativeName}).`;
  } else {
    directive += `\n\nLANGUAGE ADAPTABILITY:
If the user explicitly asks you to translate or converse in a different language during the conversation, fulfill their request naturally.`;
  }

  return directive;
}
