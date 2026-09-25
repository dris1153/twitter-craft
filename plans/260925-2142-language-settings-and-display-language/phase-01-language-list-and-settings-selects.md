---
phase: 1
title: "Languages list + settings selects"
status: completed
priority: P2
effort: "1h"
dependencies: []
---

# Phase 1: Languages list + settings selects

## Overview
Replace the free-text language code inputs with toggle chips (review languages) and a select (idea notes language); add the `uiLanguage` setting.

## Requirements
- `lib/languages.ts`: `LANGUAGES = [{ code, name (English, for prompts), native (UI label) }]` for en, vi, ja, zh, ko, es, fr, de, pt, ru; `languageName(code)` helper.
- `draft-prompt.ts` and `idea-expander.ts` use `languageName` instead of their own `LANGUAGE_NAMES` maps.
- `SettingsSchema.uiLanguage: z.enum(['en','vi']).default(() => browser default)`.
- `SettingsForm.readableLanguages` becomes `string[]`; `toForm`/`fromForm` pass arrays through.
- Settings view: chip group (`role="group"`, each chip a `button` with `aria-pressed`), styled native select for idea language and display language.
- `setUiLanguage(lang)` in settings-store merges into stored settings.

## Related Code Files
- Create: `lib/languages.ts`, `components/language-chips.tsx`, `components/ui/native-select.tsx` (only if reused by 2+ selects: yes, idea + display)
- Modify: `lib/types.ts`, `lib/settings-form.ts`, `lib/settings-store.ts`, `lib/draft-prompt.ts`, `lib/idea-expander.ts`, `components/settings-view.tsx`, `tests/settings-form.test.ts`

## Success Criteria
- [x] Chips toggle, keyboard accessible, sky fill when pressed.
- [x] Saving keeps `readableLanguages` as lowercase code array.
