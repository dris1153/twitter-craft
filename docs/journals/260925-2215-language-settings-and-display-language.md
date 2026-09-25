---
date: 2026-09-25
topic: Language selects and EN/VI display language
plan: plans/260925-2142-language-settings-and-display-language/
---

# Language selects and EN/VI display language

## Context
Settings asked for language codes as free text ("en, vi"). The user wanted selections, plus a way to switch the extension UI language.

## What happened
- `lib/languages.ts` holds 10 codes with English names (prompts) and native names (UI); it replaced two `LANGUAGE_NAMES` maps.
- Review languages became toggle chips, idea language a select, both in a new "Language" card.
- Custom i18n without dependencies: `en.ts` defines keys, `vi.ts` is `Record<MessageKey, string>`, `t()` reads a module-level language so non-React code (badge, error text, toasts) translates too.
- Display language saves instantly through `setUiLanguage()`; `I18nProvider` watches settings and re-renders the panel. The content script takes the language from display prefs.

## Reflection
- A module-level language plus a context subscription kept the diff small: lib code needed no language parameter.
- Review caught that a stable `t` identity would freeze memoized labels, that a stale Settings form in another window could write back the old language, and that badges drawn before prefs arrived used the browser language.

## Decisions
- Chosen over `chrome.i18n` (browser locale only) and i18next (too heavy for two languages).
- AI output, card PNG, markdown export and zod details stay untranslated.
- Accepted: strings already stored in state keep the old language; `setUiLanguage` read-then-write can race a Save within milliseconds.

## Next
- User checks both languages live; commit on request.
