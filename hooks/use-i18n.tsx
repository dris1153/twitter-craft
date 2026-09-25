import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { setLang, t } from '@/lib/i18n';
import { browserUiLanguage, UI_LANGUAGES, type UiLanguage } from '@/lib/languages';
import { getSettings, settingsItem } from '@/lib/settings-store';

const LangContext = createContext<UiLanguage>('en');

const asUiLanguage = (v: unknown): UiLanguage => (UI_LANGUAGES.includes(v as UiLanguage) ? (v as UiLanguage) : browserUiLanguage());

// Follows settings.uiLanguage live, so a change in Settings re-renders the whole panel at once.
export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<UiLanguage | null>(null);
  useEffect(() => {
    const apply = (l: UiLanguage) => {
      setLang(l); // before the re-render, so t() already answers in the new language
      document.documentElement.lang = l;
      setLangState(l);
    };
    getSettings().then((s) => apply(s.uiLanguage), () => apply(browserUiLanguage()));
    return settingsItem.watch((s) => apply(asUiLanguage(s?.uiLanguage)));
  }, []);
  if (!lang) return null; // settings load in a few ms; avoids a flash of the wrong language
  return <LangContext value={lang}>{children}</LangContext>;
}

export const useLang = (): UiLanguage => useContext(LangContext);

// A new function per language, so memoized values that depend on it refresh on a switch.
export function useT(): typeof t {
  const lang = useLang();
  return useMemo(() => (...args: Parameters<typeof t>) => t(...args), [lang]);
}
