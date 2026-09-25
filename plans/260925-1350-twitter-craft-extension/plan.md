---
title: "twitter-craft Chrome extension"
description: "Personal MV3 extension for x.com: Jev triages visible tweets, GPT drafts replies/quotes/cards, ideas captured to a TODO list; human always clicks Post."
status: in-progress
priority: P2
effort: 6d
branch: main
tags: [feature, frontend, experimental]
blockedBy: []
blocks: []
created: 2026-09-25
---

# twitter-craft Chrome extension

## Overview

Greenfield WXT + React + TS extension. Content script parses tweets as the user scrolls, background SW asks Jev (TypeSafe System One model) to triage each one, badge shows score + suggested action. Side panel drafts replies/quotes with GPT via Vercel AI SDK, inserts text (+ card PNG) into X's composer. User reviews and clicks Post. Ideas saved to a TODO list with Markdown export. No backend.

Source design: [brainstorm report](../reports/260925-1344-brainstorm-twitter-craft-extension-design.md)
Research: [WXT + AI SDK in MV3](./research/researcher-01-wxt-ai-sdk-mv3-report.md) · [X DOM + composer](./research/researcher-02-x-dom-composer-report.md)

## Phases

| Phase | Name | Status | Effort |
|-------|------|--------|--------|
| 1 | [Scaffold, settings, parser, Jev triage badges](./phase-01-scaffold-settings-parser-jev-triage.md) | Done (live verified) | 2.5d |
| 2 | [GPT draft + composer insert](./phase-02-gpt-draft-and-composer-insert.md) | In progress (code done, live test pending) | 2d |
| 3 | [Ideas/TODO + Markdown export](./phase-03-ideas-todo-and-markdown-export.md) | Pending | 0.5d |
| 4 | [Card PNG + GIF suggestion](./phase-04-card-png-and-gif-suggestion.md) | Pending | 1d |

Sequential: each phase depends on the previous one.

## Key decisions

- Human-in-the-loop only. Extension never clicks Post, Retweet confirm, or Like.
- Passive triage of tweets already on screen. No auto-scroll, no crawling.
- Jev triage runs in background SW (content scripts can't call cross-origin APIs). GPT calls run in side panel (normal page, no SW lifetime limits).
- All X selectors live in one file: `lib/x-dom-selectors.ts`.
- Model ids are settings, not constants. Verify ids against `GET /v1/models` in phase 1.
- Keys in `chrome.storage.local` with `TRUSTED_CONTEXTS` access (never `sync`, never readable by content script). Personal use, never published with keys.
- Composer insert is dialog-scoped and target-verified; clipboard fallback is written by the side panel before every Insert.
- Drafts only in languages the user reads (`readableLanguages`, default en/vi); other languages → English.
- Protected accounts and ads never triaged.

## Dependencies

- Jev API key (user has one), OpenAI API key.
- Node 20+, pnpm, Chrome 116+ (Chrome only).
- X UI language Vietnamese: locale-agnostic selectors first, `vi` + `en` keyword table for the rest.
- Side panel: Tailwind v4 + shadcn/ui.

## Success criteria

- Badges on visible tweets within ~1s, one Jev call per status id per browser session.
- Draft → edit → Insert → Post in ≤ 3 clicks; Post button enabled after insert.
- Ideas persist, export valid Markdown.
- Triage cost ≤ $0.10/day at normal usage.
- `pnpm compile` + `pnpm test` pass.

## Red Team Review

### Session — 2026-09-25
**Findings:** 15 (15 accepted, 0 rejected; one sub-suggestion dropped: voice-sample overlap detection)
**Severity breakdown:** 1 Critical, 10 High, 4 Medium

| # | Finding | Severity | Applied To |
|---|---------|----------|------------|
| 1 | Unscoped composer lookup inserts into wrong box; multi-line collapse | Critical | P1 spike, P2 |
| 2 | sidePanel.open loses gesture; pendingAction missed/stale | High | P1, P2 |
| 3 | Clipboard fallbacks fail in unfocused content script | High | P1 spike, P2, P4 |
| 4 | Stale GPT result paired with wrong tweet | High | P2 |
| 5 | Card tuples → OpenAI strict rejects every draft | High | P4 |
| 6 | Triage queue starvation, 429 storms, cached errors, frozen freshness | High | P1 |
| 7 | API keys readable by content script; unvalidated messages | High | P1 |
| 8 | Weak prompt-injection defense | High | P1, P2 |
| 9 | Drafts in languages user can't review | High | P1, P2 |
| 10 | Badge clicks bubble → X opens tweet | High | P1 |
| 11 | Wrong quote-tweet DOM assumption, Show-more, Ad label | High | P1 |
| 12 | Orphaned content script, recycled-node race | Medium | P1 |
| 13 | Ideas store lost updates; unsafe Markdown export | Medium | P3 |
| 14 | Protected accounts sent to vendors | Medium | P1 |
| 15 | Jev answer mapping/normalization, SDK vs raw shape | Medium | P1 |

## Validation Log

### Session 1 — 2026-09-25
**Trigger:** post red-team validation (hard mode). Verification pass skipped (Red Team Review has evidence; greenfield).
**Questions asked:** 6

1. **[Assumptions]** X UI language? Options: English | Tiếng Việt | Switches. **Answer:** Tiếng Việt — parser/menu/labels need vi keywords; +0.5d P1.
2. **[Assumptions]** X Premium? Options: No (280) | Yes. **Answer:** Yes — `maxReplyChars` default 280, raisable to 25000.
3. **[Tradeoffs]** Default draft model? Options: gpt-5.6-terra | sol | luna. **Answer:** gpt-5.6-terra.
4. **[Architecture]** Browser? Options: Chrome | Edge/Brave | Arc/other. **Answer:** Chrome — side panel architecture stands.
5. **[Architecture]** Side panel styling? Options: Tailwind v4 | Tailwind + shadcn/ui | plain CSS. **Answer:** Tailwind + shadcn/ui.
6. **[Assumptions]** Own voice samples available? Options: Yes, paste | Not many. **Answer:** Not many — add "Save as voice sample" to grow samples from real use.

#### Impact on Phases
- Phase 1: `x-locale-keywords.ts`, vi fixtures, per-button metrics, Tailwind + shadcn scaffold, settings defaults.
- Phase 2: locale-agnostic dialog verification + vi quote fallback, Save-as-voice-sample, `maxReplyChars` from settings.

## Next steps after plan

Run `/ck:docs init` after phase 1 to create `./docs` (none exist yet).
