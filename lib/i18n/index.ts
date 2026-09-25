import type { UiLanguage } from '../languages';
import { en, type MessageKey } from './en';
import { vi } from './vi';

export type { MessageKey };

const DICTIONARIES: Record<UiLanguage, Record<MessageKey, string>> = { en, vi };

// Module-level so plain lib code (badge, error text, toasts) can translate without React.
// Side panel: I18nProvider keeps it in sync with settings. Content script: set from display prefs.
let current: UiLanguage = 'en';

export function setLang(lang: UiLanguage): void {
  current = lang;
}

export const getLang = (): UiLanguage => current;

// Falls back to English, then the key, for keys that only exist at runtime (casts, unexpected outcomes).
export function t(key: MessageKey, vars?: Record<string, string | number>): string {
  const text = DICTIONARIES[current][key] ?? en[key] ?? key;
  return vars ? text.replace(/\{(\w+)\}/g, (m, name: string) => (name in vars ? String(vars[name]) : m)) : text;
}
