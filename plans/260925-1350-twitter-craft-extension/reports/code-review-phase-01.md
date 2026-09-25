---
type: code-review
phase: 1
date: 2026-09-25
score: 7/10 (before fixes)
---

# Code review: Phase 1

## Summary

The trust boundary is solid: zod-validated messages, sender checks, `TRUSTED_CONTEXTS`, protected accounts and ads skipped in both contexts, no settings code in the content bundle. `mapAnswers` matches the real SDK/provider shapes. There were no Critical findings, 3 High and 7 Medium.

Fixes below were applied the same day. Before: 93 tests. After: 122 tests, `tsc` clean, build OK.

## Findings and resolution

| # | Finding | Sev | Resolution |
|---|---------|-----|------------|
| H1 | IntersectionObserver `isIntersecting` ignores the 50% threshold, and tall tweets never reach a 0.5 ratio | High | `lib/visibility-gate.ts`: multi-threshold IO, 400 ms dwell, `isMostlyVisible` (half the tweet, or half the viewport when the tweet is taller than 2× the viewport) |
| H2 | SDK retry sleeps through Retry-After, then the 15 s abort fires, so the error is classified `http` and the queue never pauses | High | `maxRetries: 0`, queue owns backoff; honors `retry-after-ms`/`retry-after`. Test runs the real SDK path against a stubbed fetch 429 (1 call) |
| H3 | Fixtures, Vietnamese strings and protected detection have not been checked on live X | High | **Open.** Needs spike step 5 on live x.com (Debug → Copy HTML) |
| M1 | Background error leaves the content script's port open forever; a bad stored field bricks settings | Med | `.catch` → fallback response; `getSettings` keeps the fields that still validate; settings view has a catch |
| M2 | "Will retry" only happens after scrolling away and back | Med | 15 s re-check via `ctx.setTimeout` → `gate.recheck` |
| M3 | Failed cache write discards a paid Jev answer, then pays again | Med | Resolve first; cache write has its own catch |
| M4 | Pause is lost when the SW stops | Med | `session:triagePausedUntil`, restored at module load |
| M5 | Badge is lost when X re-renders the action bar | Med | `scan()` redraws from the cached entry |
| M6 | Blocklist instead of the allowlisted routes | Med | `lib/x-routes.ts` allowlist with a reserved-path set |
| M7 | No dwell before paying for triage | Med | Covered by the H1 dwell; no cancel message (YAGNI) |
| L1 | Loose schemas (url, handles, projectMatch) | Low | Regex/length limits added |
| L2 | No `minimum_chrome_version` | Low | `116` |
| L3 | Dark variant mismatch | Low | `@custom-variant dark (@media (prefers-color-scheme: dark))` |
| L4 | Prefs reach already-drawn badges late | Low | Accepted (next triage response) |
| L5 | Leftover dim from an orphaned instance | Low | Startup clears opacity |
| L6 | Unhandled rejections (clipboard, pendingAction write) | Low | `.catch` added |
| L7 | 401 keeps failing every tweet | Low | 60 s pause after 401/403 |
| L8 | Project `|` and blank-number form bugs | Low | Fixed and tested |
| L9 | Misnamed test; placeholder queue/badge tests | Low | Renamed; queue and badge tests rewritten to exercise real behavior |

## Still open before Phase 2

- Spikes b/c on live x.com: side panel gesture, and dialog-scoped insert on the Vietnamese UI.
- Spike e: whether `setAccessLevel` persists.
- Real fixtures (H3) and a recorded Jev response.
- Calibration on about 100 tweets.
