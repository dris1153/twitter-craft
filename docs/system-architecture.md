# System Architecture

## Contexts and Permissions

Three execution contexts with distinct trust and capability boundaries:

| Context | Trust | Readable Storage | Outbound APIs | Purpose |
|---------|-------|------------------|---------------|---------|
| **Content Script** | Untrusted (shares x.com's renderer) | — | `browser.runtime.sendMessage` only | Parse/render tweets |
| **Background SW** | Trusted extension code | `local:settings`, `session:*` (TRUSTED_CONTEXTS) | `https://api.typesafe.ai/*` `https://api.openai.com/*` | API keys, triage, cache |
| **Side Panel** | Trusted extension code | `local:settings` | None (for phase 1) | Settings UI |

## Message Flow

```
Content Script (x.com)
  ├─ Parse tweet from DOM
  ├─ Send: { type: 'triage', tweet: Tweet }
  │
  └─> Background SW (TRUSTED_CONTEXTS)
        ├─ Validate with ContentMessageSchema (zod)
        ├─ Check sender.id === browser.runtime.id
        ├─ Check sender.url starts with 'https://x.com/'
        ├─ Skip ads + protected accounts
        ├─ Query cache: session:triage:{hash}:{id}
        ├─ If miss: call Jev API, parse/validate response
        ├─ Store result in cache
        └─ Send back: { ok: true, triage: Triage, prefs: DisplayPrefs }

Content Script
  ├─ Receive TriageResponse
  ├─ Compute priority from triage + tweet metrics
  ├─ Render badge with priority score
  └─ On badge click: Send { type: 'open-panel', kind, tweet, triage }

Background SW
  ├─ Receive 'open-panel'
  ├─ Call sidePanel.open({ tabId })  ← must run before any await
  ├─ Store pendingAction in session:pendingAction
  └─ Send response immediately

Side Panel
  ├─ Poll pendingActionItem for action
  ├─ Load tweet context (nonce check)
  ├─ Future: Call GPT for draft
  ├─ Insert text into x.com composer
  └─ User clicks Post on x.com
```

## Trust Boundary: Content Script → Background

**Validation layers:**
1. Sender check: `sender.id === browser.runtime.id`
2. Origin check: `sender.url?.startsWith('https://x.com/')`
3. Schema validation: `ContentMessageSchema.safeParse(raw)` (zod)
4. Domain filter: Skip ads (`tweet.isAd`), protected accounts (`tweet.isProtected`), protected quotes

**Why:** Content scripts run in x.com's renderer context; attacker JavaScript could craft messages. Background SW sees all messages; must reject untrusted ones before touching storage or APIs.

## Triage Queue

Manages concurrent API calls and rate limiting:

- **Max concurrent:** 4 (Jev rate limits)
- **Max queued:** 20 (LIFO, fast scroll keeps only visible tweets)
- **Rate-limit pause:** 30s if `429`/`529` (honors `retry-after-ms` header)
- **Auth pause:** 60s if `401`/`403` (bad key)
- **Retry:** Auto-retry after pause; content script re-checks visibility after 15s

**Cache strategy:**
- Key: `session:triage:{settingsHash}:{tweetId}`
- Edit interests/projects → hash changes → cache miss → re-triage
- Cache persists for session; not cleared on reload (session storage lifetime)
- Failed requests (429, 401, http) are not cached; retried on next view

**Pause persistence:**
- `session:triagePausedUntil` holds absolute timestamp
- Survives background SW shutdown; restored at module load
- Prevents hammering Jev after auth failure

## Storage Keys

| Key | Type | Access | Lifetime | Content |
|-----|------|--------|----------|---------|
| `local:settings` | local | TRUSTED_CONTEXTS | Persist | API keys, interests, projects, voice samples, banned phrases, preferences |
| `session:triage:{hash}:{id}` | session | — | Session | Cached Jev triage result for one tweet |
| `session:triagePausedUntil` | session | — | Session | Epoch ms; if > now(), queue is paused |
| `session:pendingAction` | session | — | Session | Nonce + tweet + triage awaiting side panel open |

**Content script cannot read `local:settings`** — background SW sanitizes and sends only `DisplayPrefs` (`minQuality`, `dimLowScore`, `debug`).

## X DOM Selectors

**Single source:** `lib/x-dom-selectors.ts`

All queries use data-testid or role selectors (locale-agnostic). When X DOM changes, update this file only.

**Locale keywords:** `lib/x-locale-keywords.ts`

Holds language-specific keywords (e.g., Vietnamese "Ads", "Protected account" labels). Used by `tweet-parser.ts` to detect ads and protected status via text fallbacks.

## Visibility Gate

**Purpose:** Triage tweets only when user is looking at them.

**Mechanism:**
- IntersectionObserver with multi-threshold (0, 0.5, 1)
- Tweet is "mostly visible" if:
  - ≥50% of tweet rect intersects viewport, OR
  - Tweet is taller than 2× viewport AND ≥50% of viewport is tweet
- 400 ms dwell before evaluating (avoids paying for tweets user scrolls past)
- Automatic re-check after 15s if error occurs

## Badge Rendering

**States:**
- `loading` — Call in flight
- `ready` — Success; shows priority score (0–100)
- `error` — {reason}; Errors: `invalid` (ad/protected), `no_key`, `rate_limited`, `http`, `dropped`

**Click handlers (phase 2+):**
- `onDraft` — Open side panel with kind='draft'
- `onIdea` — Open side panel with kind='idea'
- `onCopyHtml` (debug) — Copy article element to clipboard

## Error Recovery

| Error | Cause | Recovery |
|-------|-------|----------|
| `no_key` | Missing/invalid API key | 60s pause; user adds key in settings |
| `rate_limited` | 429/529 response | Parse retry-after; pause queue; auto-retry after pause |
| `http` | Network, timeout, other API error | Retry after 15s visibility gate recheck; logged to console |
| `invalid` | Ad, protected account, etc. | Permanent skip; no retry |
| `dropped` | Queue overflow (20+ pending) | LIFO: old requests dropped; user scrolls back → retry |

**User never sees error badges persist.** After error, badge is removed and tweet is re-evaluated on next visibility gate recheck (~15s).
