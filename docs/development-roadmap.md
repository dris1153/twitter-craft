# Development Roadmap

**Project:** twitter-craft Chrome MV3 extension  
**Status:** Phase 1 in progress (code complete, live spikes pending)  
**Last updated:** 2026-09-25

## Overview

Personal extension for x.com: Jev triages visible tweets → badge with priority/action; side panel (React + Tailwind) for settings. GPT drafts replies/quotes (phase 2). Ideas→TODO+export (phase 3). Card PNG + GIF suggestion (phase 4). Human always clicks Post. No backend.

## Phases

### Phase 1: Scaffold, Settings, Parser, Jev Triage Badges

**Status:** In Progress (code done, live spikes pending)  
**Effort:** 2.5d completed  
**Start:** 2026-09-25  
**Target completion:** 2026-09-26

**Completed deliverables:**
- ✅ WXT + React + TS scaffold, build pipeline
- ✅ Settings form UI + storage (local + session)
- ✅ Tweet parser: text, metrics, author, media, quoted posts
- ✅ Content script: parse tweets, render badges, monitor mutations
- ✅ Jev triage queue: concurrency, caching, rate-limit pause
- ✅ Background SW: message validation, API calls
- ✅ Visibility gate: IntersectionObserver with dwell
- ✅ 122 tests, TypeScript strict

**Open items (live spike):**
- [ ] Spike 3: Fixture validation on live x.com (Vietnamese selectors, ad/protected detection, Show-more handling)
- [ ] Spike d: Dialog scope + clipboard on live x.com (phase 2 blocker)
- [ ] Spike e: `setAccessLevel(TRUSTED_CONTEXTS)` persistence check
- [ ] Jev response fixture + calibration (~100 tweets)

**Success criteria:**
- ✅ Badges on visible tweets within ~1s
- ✅ One Jev call per status ID per session (cached)
- ✅ `npm run compile` + `npm test` pass
- ⏳ Live x.com spikes (needed for phase 2 start)

**Red Team Review:** 15 findings applied to the plan; phase-1 items implemented, the rest scheduled in phases 2–4

**Dependencies:** Node 20+, npm, Chrome 116+

**Technical notes:**
- X UI language: Vietnamese (with English fallback keywords)
- Triage cost: ~$0.10/day at typical usage
- Queue: 4 concurrent, 20 LIFO, 30s rate-limit pause

---

### Phase 2: GPT Draft + Composer Insert

**Status:** Pending (starts after phase 1 spikes)  
**Effort:** 2d estimated  
**Target start:** After phase 1 live validation  
**Target completion:** TBD

**Planned deliverables:**
- Side panel: draft button (kind=draft or idea)
- GPT calls: context includes tweet + triage + user persona
- Composer dialog scope: verify target, multi-line collapse
- Text insert: clipboard fallback if scoped insert fails
- Localization: translate non-readable languages to English
- Save-as-voice-sample: grow voice samples from real use
- maxReplyChars: settable, applies to character counter
- Post button: enabled after insert

**Blockers:**
- Phase 1 live spike results (gesture, dialog scope)
- Real Jev response fixture
- Triage calibration data

**Success criteria:**
- Draft → edit → Insert → Post in ≤3 clicks
- Text insert with proper linebreak handling
- No text truncation
- Voice samples can be saved from drafts

**Risk:**
- Chrome composers vary in selector/scoping (address via spike d)
- Gesture handling across reloads (address via spike b)

---

### Phase 3: Ideas/TODO + Markdown Export

**Status:** Pending  
**Effort:** 0.5d estimated  
**Target start:** After phase 2  
**Target completion:** TBD

**Planned deliverables:**
- Save button in draft panel: add idea to TODO list
- Persistent storage: ideas in `local:ideas` (or cloud later)
- TODO list view in side panel: inspect, delete, export
- Markdown export: valid syntax, one idea per line
- Sync: manual export button (cloud sync deferred to v1+)

**Success criteria:**
- Ideas persist across sessions
- Export valid Markdown (parseable by most tools)
- Manual export via button

---

### Phase 4: Card PNG + GIF Suggestion

**Status:** Pending  
**Effort:** 1d estimated  
**Target start:** After phase 3  
**Target completion:** TBD

**Planned deliverables:**
- Card generation: text → PNG using HTML Canvas or Remotion
- Card preview in draft panel
- Insert card as image tweet (or link)
- GIF suggestion: AI recommends reaction GIF (phase 4.5)

**Blockers:**
- Card schema validation (OpenAI strict response mode)
- Image hosting or data URL optimization

**Success criteria:**
- Card preview renders before insert
- Card tweets post successfully
- GIF suggestions are relevant (if included)

---

## Key Decisions

| Decision | Rationale |
|----------|-----------|
| Human-in-the-loop only | No auto-click; user always reviews and clicks Post. Safer, more control. |
| Passive triage | Scan only visible tweets; no auto-scroll, no crawling. Predictable, low cost. |
| Jev in SW, GPT in side panel | SW timeout limits; side panel can call GPT without interrupt. |
| All X selectors in one file | Single point of maintenance when X DOM changes. |
| Settings hash for cache | Edit interests/projects → cache miss → re-triage with new context. |
| TRUSTED_CONTEXTS access | Keep API keys away from content scripts (renderer context). |
| Zod at all boundaries | Validate content script messages before touching APIs/storage. |
| Session storage for cache | Per-browser-session triage cache; cleared on reload (fresh context). |

## Dependencies

| Dependency | Version | Why |
|-----------|---------|-----|
| WXT | 0.21 | Extension framework, MV3 compiler |
| React | 19 | UI components (side panel) |
| TypeScript | 7 | Type safety, strict mode |
| Tailwind v4 | 4.3 | Utility CSS, dark mode support |
| shadcn/ui | Latest | Component library (Button, Input, Switch, Textarea) |
| Zod | 4.6 | Runtime schema validation |
| AI SDK | 7.0 | Jev + OpenAI providers |
| Vitest | 5 | Unit tests, fast iteration |
| happy-dom | 20 | DOM mock for tests |

## Success Metrics

**Phase 1 (Live spikes + code freeze):**
- Badges render on typical tweets within 500ms–1s
- Triage cache hit rate > 90% during typical scroll sessions
- No stale prefs between triage responses
- Settings survive corruption (field recovery)
- All tests pass

**Phase 2 (Draft + insert):**
- Draft action starts within 500ms of badge click
- Insert text into composer without user repasting
- No text truncation for multi-line replies
- Voice samples accumulate over time

**Phase 3 (Ideas + export):**
- Ideas persist across extension reloads
- Markdown export is valid and parseable
- Export file is readable in Markdown editors

**Phase 4 (Cards + GIF):**
- Card preview renders in draft panel
- Card tweets post successfully
- GIF suggestions are topically relevant

## Cost Management

**Current (Phase 1):**
- Jev calls: ~$0.05–$0.10/day at typical usage (4 concurrent, 20 pending)
- No OpenAI costs (phase 2+)

**Phase 2 estimate:**
- GPT calls: ~$0.20–$0.50/day (one draft per engagement session)
- Combined: ~$0.30–$0.60/day

**Mitigation:**
- OpenAI project-scoped key with monthly $5 budget cap
- Queue throttles to 4 concurrent to avoid spike costs
- Jev caching prevents duplicate calls

## Open Questions

| # | Question | Status |
|---|----------|--------|
| 1 | X UI language? | Answered: Vietnamese (en fallback) |
| 2 | X Premium? | Answered: Yes, `maxReplyChars` up to 25k |
| 3 | Default draft model? | Answered: gpt-5.6-terra |
| 4 | Browser support? | Answered: Chrome (side panel MV3 feature) |
| 5 | Side panel styling? | Answered: Tailwind v4 + shadcn/ui |
| 6 | Voice samples? | Answered: Add "Save as sample" in phase 2 |

## Timeline

| Phase | Status | Start | Est. End | Actual |
|-------|--------|-------|----------|--------|
| 1 | In progress | 2026-09-25 | 2026-09-26 | — |
| 2 | Pending | — | — | — |
| 3 | Pending | — | — | — |
| 4 | Pending | — | — | — |

**Estimate:** Sequential phases; ~6 days total effort (2.5 + 2 + 0.5 + 1)

---

## Related Documentation

- [System Architecture](./system-architecture.md) — Contexts, message flow, storage
- [Code Standards](./code-standards.md) — Conventions, testing, comments
- [Codebase Summary](./codebase-summary.md) — File-by-file reference
- [Project Changelog](./project-changelog.md) — Version history and findings
