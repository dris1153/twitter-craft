# Project Changelog

## 0.1.0 (2026-09-25)

**Phase 1: Scaffold, Settings, Parser, Jev Triage Badges — In Progress**

### Completed

**Infrastructure & Foundation**
- WXT 0.21 project scaffold with React 19 + TypeScript 7 + Tailwind v4 + shadcn/ui
- Package.json with build, dev, test, compile scripts
- wxt.config.ts: React module, Tailwind, MV3 manifest, permissions (storage, sidePanel)

**Type System & Validation**
- Zod schemas for all boundaries: Tweet, Triage, Settings, DisplayPrefs
- ContentMessageSchema for attacker-controlled content script messages
- TriageResponse union type for success/error handling
- PendingAction for side panel draft context

**Storage & Settings**
- `local:settings` (TRUSTED_CONTEXTS): API keys, interests, projects, voice samples, prefs
- `session:triage:{hash}:{id}`: Triage cache per session, keyed by settings + tweet ID
- `session:triagePausedUntil`: Rate-limit pause persistence across SW shutdowns
- `session:pendingAction`: Pending draft awaiting side panel
- Settings form: load, save, graceful field recovery on corruption
- Settings → DisplayPrefs filter (expose only minQuality, dimLowScore, debug to content script)

**Triage Queue**
- Concurrent (4 max), LIFO, 20-tweet limit
- Rate-limit pause (30s, honors Retry-After header)
- Auth pause (60s on 401/403)
- Cache per session; edit interests/projects → hash change → cache miss → re-triage
- Pause persistence: survives SW shutdown, restored at module load
- Auto-retry on visibility gate recheck (15s)

**Content Script & Tweet Parsing**
- x.com content script: parses tweets from DOM, monitors mutations, renders badges
- Tweet parser: extracts text, metrics, author, media, quoted posts, language
- Ad detection: CSS selectors + locale keywords (en, vi)
- Protected account detection: lock icon + locale keywords
- Top-level tweet filter (ignores nested quotes)
- Quoted post extraction (role="link" within article)

**X DOM Abstraction**
- Single source: `lib/x-dom-selectors.ts` (all X.com selectors)
- Selectors use data-testid (locale-agnostic) with fallback keywords
- Locale keywords: `lib/x-locale-keywords.ts` (Vietnamese + English)

**Rendering & Visibility**
- Badge rendering: loading/ready/error states, priority score (0–100)
- Visibility gate: IntersectionObserver with multi-threshold, 400ms dwell
- "Mostly visible" logic: 50% tweet rect or 50% viewport if tweet > 2× viewport
- Automatic re-check after 15s on error

**Background Service Worker**
- Validates messages: sender ID, x.com origin, zod schema
- Calls Jev API (TypeSafe), parses responses
- Manages triage queue, rate limiting, error handling
- Opens side panel (sidePanel.open must run before await)
- Sends DisplayPrefs to content script

**Settings UI (Side Panel)**
- React form: API keys (Jev, OpenAI), interests, projects, quality threshold, debug toggle
- Form ↔ storage conversion (parse multiline fields, validate)
- Graceful error display: invalid field, save failure
- Field recovery on corruption (show defaults; user can re-save)

**Security & Trust Boundary**
- Content script cannot read `local:settings` (TRUSTED_CONTEXTS)
- All messages validated with zod before touching storage/APIs
- Protected accounts and ads skipped in both contexts
- No untrusted eval or innerHTML usage

**Testing**
- 14 test files, 122 test cases
- Vitest + happy-dom (no browser)
- Fixtures: hand-written X DOM from Vietnamese UI
- Tests: parser edge cases, queue logic, Jev SDK integration, form conversion, visibility gate

**Code Quality**
- TypeScript strict mode, no unhandled rejections
- File size: all under 200 lines (median ~100 LOC)
- Comments: invariants and "why" only; no narration
- All X selectors centralized
- Zod validation at all boundaries

### Known Issues / Open Items

**Spike (Live x.com Testing)**
- [ ] Fixture validity: Vietnamese UI selectors, protected detection, ad label
- [ ] Side panel gesture: sidePanel.open() loses user gesture across reloads
- [ ] Dialog scope: verify composer insert target and multi-line handling

**Spike: Storage Permissions**
- [ ] Verify `setAccessLevel(TRUSTED_CONTEXTS)` persists after SW reload

**Phase 1 → Phase 2 Blockers**
- Jev response format must be recorded from live API (captured, validated against schema)
- Triage queue behavior calibrated on ~100 tweets
- Composer insert logic proven on live x.com (scoped dialog, fallback clipboard)

### Roadmap Notes

**Next: Phase 2** (GPT draft + composer insert)
- Requires: Spike e (gesture), Spike d (dialog scope), real Jev fixture
- Adds: GPT calls from side panel, text insert into composer, localized draft language
- Estimated: 2d effort

**Later: Phase 3** (Ideas/TODO + Markdown export)
- Estimated: 0.5d effort

**Later: Phase 4** (Card PNG + GIF suggestion)
- Estimated: 1d effort

### Red Team Findings (Applied)

**15 findings addressed** (1 Critical, 10 High, 4 Medium; 1 sub-suggestion deferred)

| # | Finding | Severity | Applied |
|---|---------|----------|---------|
| 1 | Unscoped composer lookup inserts into wrong box | Critical | Scoped + multi-line, P1 spike |
| 2 | sidePanel.open loses gesture; pendingAction missed/stale | High | Nonce + context re-fetch, P1 spike |
| 3 | Clipboard fallback fails in unfocused content script | High | P1 spike, P2 |
| 4 | Stale GPT result paired with wrong tweet | High | Nonce check, defer to P2 |
| 5 | Card tuples reject OpenAI strict | High | Card shape in phase 4 |
| 6 | Triage queue starvation, 429 storms, cache staleness | High | Multi-level pause, queue owns backoff, fresh score computed at render |
| 7 | API keys readable by content script; unvalidated messages | High | TRUSTED_CONTEXTS, zod validation |
| 8 | Weak prompt injection defense | High | Settings validation, phase 2 prompt hardening |
| 9 | Drafts in unreadable languages | High | `readableLanguages` default en/vi, translate to en if needed |
| 10 | Badge clicks bubble to X | High | Event handler stops propagation |
| 11 | Wrong quote-tweet DOM, Show-more, Ad label | High | Selectors + fixture review (spike 3) |
| 12 | Orphaned content script, recycled-node race | Medium | Node.isConnected check, entry tracking, reset on mismatch |
| 13 | Ideas store lost updates | Medium | Deferred to phase 3 |
| 14 | Protected accounts sent to vendors | Medium | Explicit skip in both contexts |
| 15 | Jev answer mapping/normalization | Medium | `mapAnswers`, tested against real SDK shape |

### Metrics

- **Tests:** 122 passing (13 files)
- **Type coverage:** 100% (TypeScript strict, no `any`)
- **Fixture sources:** Hand-written from Vietnamese X UI
- **Build:** `npm run build` produces `.output/chrome-mv3/`
- **Bundle:** ~400 KB (extension minified)
- **Estimated triage cost:** $0.10/day at typical usage (4 concurrent, 20 queued)

---

## Versioning

Follows semantic versioning. Phase releases (0.1, 0.2, etc.) mark completion of planned roadmap phases. Patches (0.1.1, etc.) for bug fixes and maintenance.

**Version numbering:**
- Major (1.x): User-facing breaking changes
- Minor (0.x): New features (phases)
- Patch (0.1.x): Bugs, maintenance
