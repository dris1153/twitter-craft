---
title: "Language selects + display language (EN/VI)"
description: "Replace language code inputs with chips/select and add an instantly-applied UI language setting for side panel and X badge."
status: completed
priority: P2
effort: 4h
branch: main
tags: [frontend, i18n]
blockedBy: []
blocks: []
created: 2026-09-25
---

# Language selects + display language (EN/VI)

Source: [brainstorm report](../reports/260925-2142-brainstorm-language-settings-and-display-language.md)

## Phases

| Phase | Name | Status | Effort |
|-------|------|--------|--------|
| 1 | [Languages list + settings selects](./phase-01-language-list-and-settings-selects.md) | Completed | 1h |
| 2 | [i18n core + side panel strings](./phase-02-i18n-core-and-side-panel.md) | Completed | 2h |
| 3 | [Badge on X + tests + docs](./phase-03-badge-tests-docs.md) | Completed | 1h |

## Key rules
- No new dependencies. `vi.ts` typed `Record<keyof typeof en, string>` so missing keys fail compile.
- Translate UI chrome only; AI output, card PNG and zod details stay as-is.
- Display language saves instantly via `setUiLanguage()` (merge into stored settings), other fields keep Save.
- Default `uiLanguage` from `navigator.language` (`vi*` → vi, else en).

## Notes
- Review fixes applied: html/badge `lang`, unknown saved codes shown in chips/select, live language used on Save, first badges wait for prefs, `t()` fallback, VI copy.
- Accepted: `setUiLanguage` read-then-write can race a Save within ms (same pattern as `addVoiceSample`); translated strings already in state keep the old language.
- Skipped: `native-select.tsx` (two selects share one class constant instead).

## Success criteria
- Chips/select in Settings; stored `readableLanguages: string[]`, `ideaLanguage: string` shape unchanged.
- Language switch re-renders the side panel instantly; new badges on X follow it.
- `pnpm compile`, `pnpm test`, `pnpm build` green.
