---
phase: 2
title: "i18n core + side panel strings"
status: completed
priority: P2
effort: "2h"
dependencies: [1]
---

# Phase 2: i18n core + side panel strings

## Overview
Tiny dictionary i18n and wrap every side panel string.

## Architecture
- `lib/i18n/en.ts` (source of keys, `as const` object), `lib/i18n/vi.ts` (`Record<MessageKey, string>`), `lib/i18n/index.ts`: `setLang`, `getLang`, `t(key, vars?)` with `{name}` interpolation.
- `hooks/use-i18n.tsx`: `I18nProvider` loads settings, watches `settingsItem`, calls `setLang`, exposes lang via context; `useT()` returns `t` and re-renders on change.
- Lib strings built at call time with `t()`: `INSERT_MESSAGES`, `GIF_MESSAGES` (panel-to-tab), `WARNING_TEXT` (draft-safety-checks), draft/idea error text (draft-generator), long-post note (use-draft-session).

## Related Code Files
- Create: `lib/i18n/en.ts`, `lib/i18n/vi.ts`, `lib/i18n/index.ts`, `hooks/use-i18n.tsx`
- Modify: `entrypoints/sidepanel/app.tsx`, `components/*.tsx` with visible text, `lib/panel-to-tab.ts`, `lib/draft-safety-checks.ts`, `lib/draft-generator.ts`, `hooks/use-draft-session.ts`

## Implementation Steps
1. Build dictionaries (split files by area if one exceeds 200 lines).
2. Provider at App root; replace literals with `t('…')`.
3. Grep JSX for remaining English literals.

## Success Criteria
- [x] Switching display language re-renders every side panel string instantly.
- [x] `vi.ts` missing a key fails `pnpm compile`.
