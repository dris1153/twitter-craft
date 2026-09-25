---
phase: 3
title: "Badge on X + tests + docs"
status: completed
priority: P2
effort: "1h"
dependencies: [2]
---

# Phase 3: Badge on X + tests + docs

## Overview
Badge text follows the display language; tests and docs updated.

## Requirements
- `DisplayPrefs` gains `uiLanguage`; `toDisplayPrefs` passes it; content script calls `setLang(prefs.uiLanguage)` whenever prefs arrive.
- Badge strings (Draft, Idea, not scored, scoring, tooltips, error texts, triage action labels) via `t()`. Triage topic stays model output.
- Tests: i18n `t()` interpolation + fallback, vi badge render, settings form arrays, `setUiLanguage` merge.
- Docs: changelog, codebase summary.

## Related Code Files
- Modify: `lib/types.ts`, `lib/settings-store.ts`, `entrypoints/x-timeline.content/index.ts`, `lib/tweet-badge.ts`, tests, docs

## Success Criteria
- [x] New badges render in the chosen language after the next triage response.
- [x] `pnpm compile`, `pnpm test`, `pnpm build` green.
