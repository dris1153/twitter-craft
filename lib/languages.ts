// Codes match the `lang` X puts on tweets. `name` goes into prompts, `native` labels the UI.
export const LANGUAGES = [
  { code: 'en', name: 'English', native: 'English' },
  { code: 'vi', name: 'Vietnamese', native: 'Tiếng Việt' },
  { code: 'ja', name: 'Japanese', native: '日本語' },
  { code: 'zh', name: 'Chinese', native: '中文' },
  { code: 'ko', name: 'Korean', native: '한국어' },
  { code: 'es', name: 'Spanish', native: 'Español' },
  { code: 'fr', name: 'French', native: 'Français' },
  { code: 'de', name: 'German', native: 'Deutsch' },
  { code: 'pt', name: 'Portuguese', native: 'Português' },
  { code: 'ru', name: 'Russian', native: 'Русский' },
] as const;

export const languageName = (code: string): string => LANGUAGES.find((l) => l.code === code)?.name ?? code;

export const UI_LANGUAGES = ['en', 'vi'] as const;
export type UiLanguage = (typeof UI_LANGUAGES)[number];

export const browserUiLanguage = (): UiLanguage =>
  globalThis.navigator?.language?.toLowerCase().startsWith('vi') ? 'vi' : 'en';
