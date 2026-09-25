---
type: brainstorm
date: 2026-09-25
status: approved
---

# Brainstorm: language selects + display language (EN/VI)

## Problem
- Settings "Languages you can review" and "Idea notes language" are free-text code inputs (`en, vi`), error-prone.
- User wants to pick the extension UI language.

## Decisions (user-approved)
- "Display language" = extension UI language, English / Tiếng Việt. Covers side panel + badge on X.
- AI output (drafts, triage topic, idea content), card PNG, zod validation details stay as-is.
- Language list: ~10 common codes (en, vi, ja, zh, ko, es, fr, de, pt, ru), shown by native name.
- "Languages you can review": toggle chips (multi-select, sky fill when on). "Idea notes language": styled native `<select>`.
- Display language applies instantly on change (saved on its own, no Save click); other fields still use Save.
- Default display language: browser language (`vi*` → vi, else en).

## Approaches
| Option | Verdict |
|---|---|
| Own tiny dictionary (`en.ts` source of keys, `vi.ts` typed `Record<Key,string>`), `t(key, vars)` | **Chosen**: zero deps, TS enforces parity |
| `chrome.i18n` + `_locales` | Rejected: follows browser locale only, not switchable at runtime |
| i18next / react-intl | Rejected: heavy for 2 languages |

## Design
- `lib/languages.ts`: `LANGUAGES` (code, English name for prompts, native name for UI). Replaces the two `LANGUAGE_NAMES` maps (draft-prompt, idea-expander).
- `lib/i18n/`: `en.ts`, `vi.ts`, `index.ts` with module-level current lang + `t()`. Lib code that builds user-facing strings (INSERT/GIF messages, WARNING_TEXT, draft error text, badge text) calls `t()` at call time.
- Side panel: `I18nProvider` reads settings, watches `settingsItem`, sets module lang, re-renders via context; components use `useT()`.
- Badge: `uiLanguage` added to `DisplayPrefs`; content script sets module lang from prefs. Existing badges switch on next render / tab reload.
- Settings: new `uiLanguage` field (`z.enum(['en','vi'])`, default from `navigator.language`). `setUiLanguage()` merges into stored settings so unsaved form edits aren't written.

## Risks
- Strings already stored in state (errors, toasts) keep old language until regenerated. Acceptable.
- ~170 strings across ~15 files; missing `t()` wrap = English leak. Mitigate with a grep pass for JSX text literals.
- Tests assert English text; default lang in tests is en (happy-dom `en-US`).

## Success
- Chips/select replace text inputs; saved arrays unchanged in shape.
- Switching language re-renders side panel instantly; new badges on X use it.
- `pnpm compile/test/build` green; vi.ts missing a key fails compile.
