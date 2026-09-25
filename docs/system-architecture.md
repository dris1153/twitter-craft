# System Architecture

## Contexts and Permissions

Three execution contexts with distinct trust and capability boundaries:

| Context | Trust | Readable Storage | Outbound APIs | Purpose |
|---------|-------|------------------|---------------|---------|
| **Content Script** | Untrusted (shares x.com's renderer) | — | `browser.runtime.sendMessage` only | Parse/render tweets |
| **Background SW** | Trusted extension code | `local:settings`, `local:ideas`, `session:*` (TRUSTED_CONTEXTS) | `https://api.typesafe.ai/*` `https://api.openai.com/*` | API keys, triage, cache, ideas |
| **Side Panel** | Trusted extension code | `local:settings`, `local:ideas` | None | Settings UI, Draft tab, Ideas tab |

## Message Flow

### Triage Path

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
```

### Draft Path (Phase 2)

```
Background SW
  ├─ Receive 'open-panel' from content script
  ├─ Call sidePanel.open({ tabId })  ← must run before any await
  ├─ Store pendingAction: { nonce, at, windowId, tabId, tweet, triage, kind } in session:pendingAction
  └─ Send response immediately

Side Panel
  ├─ Mount: hooks/use-pending-action.ts polls session:pendingAction
  ├─ Fetch tweet + triage context via nonce (re-verify not stale)
  ├─ Show "Draft" tab (Draft tab is active if kind='draft')
  ├─ User clicks "Draft" button → triggers Draft action
  ├─ Side panel calls lib/draft-generator.ts:
  │   ├─ Check: !isProtected && !isAd
  │   ├─ Call OpenAI generateText with instructions + userMessage
  │   ├─ Parse Output.object response (DraftSchema)
  │   ├─ Timeout 30s, store:false, maxRetries:0
  │   └─ Return: { replies: [], quote: null, skipReason?: string }
  ├─ User edits draft text (hooks/use-draft-session.ts tracks edits)
  ├─ User clicks "Insert"
  │   ├─ Side panel copies text to clipboard (user gesture preserved)
  │   ├─ Call insertIntoTab via panel-to-tab.ts (content script method)
  │   └─ Content script calls lib/x-composer.ts:insertDraft()
  ├─ Content script (lib/x-composer.ts):
  │   ├─ Find article by statusId (top-level only, exact match)
  │   ├─ Target verification: href match or @handle boundary regex
  │   ├─ Open reply/quote dialog (calls X's own UI)
  │   ├─ Focus composer, typeInto() with execCommand('insertText')
  │   ├─ If newline drops: clear + paste (Draft.js handling)
  │   ├─ Check post button enabled
  │   ├─ Return: 'inserted' | 'dialog_open' | 'not_found' | ...
  │   └─ Never clicks Post
  ├─ Side panel shows result: "Inserted." or error message
  ├─ If successful and user edited: offer "Save as voice sample"
  └─ User clicks Post on x.com (manual)

Draft Safety (Phase 2)
  ├─ lib/draft-safety-checks.ts before insert:
  │   ├─ Detect unknown links (not x.com links)
  │   ├─ Detect unknown handles (not in original tweet)
  │   ├─ Detect bait patterns (common engagement tricks)
  │   ├─ Check text length against maxReplyChars
  │   └─ If risky: confirm before insert

### Ideas Path (Phase 3)

```
Side Panel (Ideas Tab)
  ├─ Mounted on side panel open; stays mounted alongside Draft
  ├─ User clicks badge with kind='idea' (buildIdea ≥ 0.6)
  ├─ Ideas View calls lib/idea-expander.ts:
  │   ├─ Check cache: existing idea by sourceStatusId
  │   ├─ If new: call OpenAI with ideaModel to expand truncated insight
  │   ├─ Build IdeaDraft: {title, problem, insight, mvpScope, stack, promo, tags}
  │   ├─ Use ideaLanguage setting (default 'vi')
  │   └─ Return expanded idea ready for user edit
  ├─ User inline edits idea (blur + 800ms autosave):
  │   ├─ Call lib/ideas-store.ts:updateIdea()
  │   ├─ Mutation via promise-chain to prevent concurrent write loss
  │   └─ Store in `local:ideas` persisted array
  ├─ Ideas List:
  │   ├─ Filter by status (pending, in-progress, done)
  │   ├─ Inline status select (single click)
  │   ├─ Delete with confirmation
  │   ├─ Open post link (x.com status URL validation)
  │   └─ Each idea de-duped by sourceStatusId
  ├─ Markdown Export (lib/ideas-markdown-export.ts):
  │   ├─ Group ideas by status (## Pending, ## In Progress, ## Done)
  │   ├─ Task list format: ☐ pending, ◉ in-progress, ✓ done
  │   ├─ Fenced code block for source post (all text escaped)
  │   ├─ Only x.com status URLs + project URLs clickable
  │   ├─ Other links/emails rendered as inline code
  │   └─ Export as .md file (user download)

Ideas Safety (Phase 3)
  ├─ lib/draft-safety-checks.ts:assertSendable():
  │   ├─ Skip protected/ad posts for idea generation
  │   ├─ Skip protected/ad posts for triage (applies to ideas too)
  │   ├─ isProjectUrl() validates x.com URLs + project whitelist
  │   └─ All other URLs and emails rendered as literal code
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
| `local:ideas` | local | — | Persist | Array of Idea objects {id, title, problem, insight, mvpScope, stack, promo, tags, status, sourceStatusId, sourceUrl} |
| `session:triage:{hash}:{id}` | session | — | Session | Cached Jev triage result for one tweet |
| `session:triagePausedUntil` | session | — | Session | Epoch ms; if > now(), queue is paused |
| `session:pendingAction` | session | — | Session | Nonce + tweet + triage + kind awaiting side panel open |

**Content script cannot read `local:settings`** — background SW sanitizes and sends only `DisplayPrefs` (`minQuality`, `dimLowScore`, `debug`).

## Tweet Parsing & Language Detection

**Tweet Parser:** `lib/tweet-parser.ts`

Extracts from X's DOM:
- Text, author, metrics (replies/reposts/likes/views from aria-label for exact counts)
- Original language (`originalLang`) from X's auto-translate label ("Được dịch từ Tiếng Nhật" → "ja")
- Translated posts carry lang="vi" from X's rendering; `originalLang` recovers the source
- Quoted posts, media, protected account status, ads

**X DOM Selectors:** `lib/x-dom-selectors.ts`

All queries use data-testid or role selectors (locale-agnostic). When X DOM changes, update this file only.

**Locale keywords:** `lib/x-locale-keywords.ts`

Holds language-specific keywords (en, vi):
- Ad detection: "Quảng cáo" (vi), "Ad" (en)
- Protected account: "Tài khoản được bảo vệ" (vi), "Protected account" (en)
- Auto-translate label prefix: "Được dịch từ" (vi), "Translated from" (en)
- Language code mapping: Vietnamese/Tiếng Việt → "vi", English/Tiếng Anh → "en", etc.

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
- **Idea badge:** Rendered if `isIdeaWorthy` (buildIdea ≥ 0.6, botInstructions ≤ 0.5); never dimmed below quality threshold

**Priority Computation (cached at render time, not storage):**
```
score = 0.75 * triage.quality 
      + 0.25 * triage.replyOpening 
      + freshnessBonus(ageMinutes)
      + hotBonus(likes/min)

freshnessBonus: +0.1 if <60min, +0.05 if <6h, else 0
hotBonus: +0.05 if likes/minute > 5, else 0
priority: round(100 * clamp(score, 0, 1))
```

**Triage Quality Score (from Jev):**
- Extracted from probability distribution using convex weights [0, 0.1, 0.45, 0.85, 1]
- Sinks spam/bait (low levels), lifts substantive posts (high levels)
- Debug mode logs raw Jev answers + confidence scores

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
