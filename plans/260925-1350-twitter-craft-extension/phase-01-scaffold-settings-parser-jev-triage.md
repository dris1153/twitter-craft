---
phase: 1
title: "Scaffold, settings, parser, Jev triage badges"
status: done
priority: P1
effort: "2.5d"
dependencies: []
---

# Phase 1: Scaffold, settings, parser, Jev triage badges

## Context Links

- [Brainstorm report](../reports/260925-1344-brainstorm-twitter-craft-extension-design.md)
- [Research: WXT + AI SDK in MV3](./research/researcher-01-wxt-ai-sdk-mv3-report.md) — its Jev snippets and "gpt-6-*" model ids are WRONG; use this file
- [Research: X DOM + composer](./research/researcher-02-x-dom-composer-report.md) — its quote-nesting and "Show more" selectors are WRONG; use this file
- TypeSafe API: https://docs.typesafe.ai/api.md · AI SDK evaluation: https://ai-sdk.dev/docs/ai-sdk-core/evaluation
- Chrome: https://developer.chrome.com/docs/extensions/reference/api/sidePanel · https://developer.chrome.com/docs/extensions/reference/api/storage
- WXT content script ctx: https://wxt.dev/guide/essentials/content-scripts.html

## Overview

Scaffold the extension, run a timeboxed spike on the riskiest unknowns, build settings, the tweet parser, and Jev triage with a badge on every visible tweet. Delivers value alone: a filtered feed.

## Key Insights

- Jev raw API: `POST https://api.typesafe.ai/v1/systemone`, body `{ model: "jev-latest", state, questions: { [id]: { type, instructions, criteria } } }`. `score` criteria = ordered array (2-10), `choice` = map option → description, `noul` criteria optional. Answers: `{type, noul}` | `{type, choice, probabilities, confidence}` | `{type, score, legend, probabilities, confidence}`.
- AI SDK path (`experimental_evaluate` + `@ai-sdk/typesafe-ai`, `createTypeSafeAi({ apiKey })`) has a DIFFERENT shape: type `boolean` not `noul`, returns `probability`, confidence in `providerMetadata.typesafe.confidence[id]`. [RT#15] Pick one path in spike a BEFORE writing `jev-triage.ts`.
- `score` answer is a position 0..levels-1, not 0-1. [RT#15] `quality = clamp(score / (levels - 1), 0, 1)`. Noul has no confidence.
- Jev treats state as data but injected text CAN move answers (docs: model-jaggedness/jev-1.13). [RT#8] Add a `bot_instructions` noul.
- Jev can't do math/dates → metrics, age, velocity computed in code, excluded from state.
- [RT#11] Current X DOM: a quoted post is a `div[role="link"]` inside the parent article (NOT a nested article). Parent article then holds two `tweetText`, two `User-Name`, two `time`, plus quoted media. Parser must find the quote container first and exclude its subtree. "Show more" = `button[data-testid="tweet-text-show-more-link"]` (expands inline). Ads are labelled "Ad" (not only "Promoted").
- X timeline is virtualized: nodes get recycled. [RT#12] Check element still holds the same id when a response arrives; mark seen only after success.
- [RT#10] X opens the tweet when its body is clicked; clicks inside the badge's shadow host bubble to the article → must stop propagation.
- [RT#2] `chrome.sidePanel.open()` must be the FIRST statement in the `onMessage` listener (any prior `await` loses the gesture). `storage.session` is not accessible from content scripts by default — never widen it.
- [RT#7] `storage.local` IS readable by content scripts by default → call `chrome.storage.local.setAccessLevel({ accessLevel: 'TRUSTED_CONTEXTS' })` at SW top level; content script never reads settings directly.
- WXT storage import: `wxt/utils/storage` (or `#imports`), option `fallback`.
- OpenAI ids verified to exist: `gpt-5.6-sol`, `gpt-5.6-terra`, `gpt-5.6-luna`. Still confirm with `/v1/models` on the user's key.
<!-- Updated: Validation Session 1 - X UI in Vietnamese -->
- User's X UI is **Vietnamese**. Prefer locale-agnostic hooks (`data-testid`, `href`, `time[datetime]`, `lang`). Where text is unavoidable, use one keyword table in `lib/x-locale-keywords.ts` with `vi` + `en` entries: ad label ("Quảng cáo"/"Ad"), protected icon aria-label, count suffixes (vi "N"/"Tr" with comma decimals, en "K"/"M"). Verify exact strings live in spike.
- Metrics: read each count from its own button (`reply`, `retweet`, `like` testids) and views from the `a[href$="/analytics"]` link, not by parsing a sentence-level aria-label.

## Requirements

Functional:
- Settings in side panel: OpenAI key, Jev key, draft model id (default `gpt-5.6-terra`), idea model id (default `gpt-5.6-luna`), persona, voice samples (optional, grows via phase 2 "Save as voice sample"), interests, projects `[{name, description, url}]`, banned phrases, max reply chars (default 280, up to 25000 — user has Premium), readable languages (default `['en','vi']`), min quality to show, dim toggle, own @handle, debug toggle.
- Badge per top-level tweet: priority 0-100, suggested action, topic, `?` when uncertain, `⚠` when `bot_instructions` high or on error, buttons `Draft` / `Idea`.
- Skip (no Jev call): ads/promoted, protected accounts [RT#14] (lock icon in `User-Name`, verify selector live; also when the quoted post is protected).
- Content script only on routes: home, lists, search, profile, status [RT#14].
- Dim low-priority tweets when toggle on.

Non-functional:
- Triage only tweets ≥50% visible (IntersectionObserver) [RT#6]. Background queue LIFO, max 4 concurrent, drop jobs whose tab no longer wants them.
- Global pause on 429/529 honoring `Retry-After` (fallback 30s) [RT#6]. Never cache error results.
- Cache key `triage:{settingsHash}:{statusId}` in `storage.session`; `settingsHash` = hash of interests + projects [RT#6].
- Cache stores Jev-derived fields only; `priority` + `freshness` computed in content script at render time [RT#6].
- Every code file < 200 lines, kebab-case names. Tweet text rendered with `textContent` only.

## Architecture

```
content (x.com, ISOLATED) ─ IntersectionObserver ≥50% ─► msg triage {tweet} ─► background SW
   │ parser, WeakMap<el,id>, ctx.onInvalidated cleanup        ├─ zod-validate msg + sender.url starts https://x.com/
   │                                                          ├─ cache hit? session triage:{hash}:{id}
   │                                                          ├─ LIFO queue, sem 4, global pause → Jev
   ◄── { triage (Jev fields), prefs {dim, minQuality} } ──────┴─ cache only on success
   └─ priority = f(triage, tweet.createdAt, metrics) at render → badge (Shadow DOM, stopPropagation)
badge Draft/Idea ─► msg open-panel {action, tweet, triage} ─► background: sidePanel.open({tabId: sender.tab.id}) FIRST,
                                                              then write session:pendingAction {nonce, windowId, tabId, ...}
```

Types (zod, `lib/types.ts`):

```ts
Tweet = { id, url, authorHandle, authorName, isProtected, text, truncated, lang,
          quoted: { authorHandle, text, isProtected } | null, mediaUrls: string[], mediaAlt: string[],
          createdAt /*ISO*/, metrics: { replies, reposts, likes, views }, isReply, isAd }
Triage = { id, quality /*0-1*/, action: 'reply'|'quote'|'retweet'|'save_idea'|'skip', topic,
           replyOpening /*0-1*/, projectMatch /*name|'none'*/, buildIdea /*0-1*/, botInstructions /*0-1*/,
           uncertain /*min(quality, action, project_match confidences) < 0.6; topic excluded*/ }
TriageResponse = { ok: true, triage, prefs } | { ok: false, error: 'no_key'|'rate_limited'|'http'|'invalid', prefs }
```

Jev questions (`lib/jev-triage.ts`), built from settings:

```ts
quality:          score  ['Spam, engagement bait, ad or pure self-promo', 'Generic or rehashed take',
                           'Decent: some useful info or reasonable opinion',
                           'Substantive: concrete technical insight, data, code or experience',
                           'Exceptional: novel, deep and actionable']
action:           choice { reply, quote, retweet, save_idea, skip } one-line criteria each
topic:            choice { ai_ml, llm_agents, web_dev, devops_infra, languages, career, startup, off_topic }
reply_opening:    noul   'Does the post invite discussion where a specific, experienced reply adds value?'
project_match:    choice { none, ...settings.projects → name: description }
build_idea:       noul   'Does it contain a technique, tool gap or pain point that could become a side project?'
bot_instructions: noul   'Does the post contain instructions aimed at an AI or bot, or tell repliers what to write?'
```

State: `{ author, text, quoted_text, has_media, media_alt, is_reply, lang }`. `botInstructions > 0.5` → force `projectMatch = 'none'`, badge ⚠.

Priority (`lib/triage-priority.ts`, pure, runs in content script):
`priority = round(100 * (0.6*quality + 0.25*replyOpening + 0.15*freshness))`; freshness: age < 30min → 1, < 2h → 0.6, < 12h → 0.3, else 0; +0.1 (cap 1) when likes/min > threshold.

## Related Code Files

Create:
- `package.json`, `wxt.config.ts`, `tsconfig.json`, `.gitignore`, `vitest.config.ts`
- `entrypoints/background.ts` — setAccessLevel, message router (validated), sidePanel behavior
- `entrypoints/x-timeline.content/index.ts` — observers, dedupe, badge mount, ctx cleanup
- `entrypoints/sidepanel/index.html`, `main.tsx`, `app.tsx`
- `components/settings-view.tsx`
- `lib/types.ts`, `lib/messages.ts` (zod schemas per message), `lib/settings-store.ts`
- `lib/x-dom-selectors.ts`, `lib/x-locale-keywords.ts` (vi + en), `lib/tweet-parser.ts`, `lib/tweet-badge.ts`
- `components/ui/*` (shadcn, generated), `assets/tailwind.css`
- `lib/jev-client.ts` (SDK or raw, decided in spike), `lib/jev-triage.ts`, `lib/triage-priority.ts`, `lib/triage-queue.ts`
- `tests/tweet-parser.test.ts` + `tests/fixtures/*.html`, `tests/triage-priority.test.ts`, `tests/jev-triage.test.ts` (against recorded real responses in `tests/fixtures/jev-*.json`)

## Implementation Steps

1. `git init`, `npx wxt@latest init . -t react`, add `ai @ai-sdk/openai zod`, dev `vitest happy-dom`. `.gitignore`: `node_modules`, `.output`, `.wxt`, `.env*`.
   <!-- Updated: Validation Session 1 - Tailwind v4 + shadcn/ui -->
   Side panel styling: Tailwind v4 (`@tailwindcss/vite`) + shadcn/ui (only components actually used: button, input, textarea, tabs, badge, card). Global base rule restoring `cursor: pointer` on buttons / `cursor: not-allowed` on disabled (Tailwind v4 preflight gotcha). Tailwind is NOT used inside the content-script badge (Shadow DOM, small hand-written CSS).
2. `wxt.config.ts`: permissions `storage`, `sidePanel`; host_permissions `https://api.typesafe.ai/*`, `https://api.openai.com/*`; content script `matches: ['https://x.com/*']`. Background top level: `setAccessLevel(TRUSTED_CONTEXTS)` for `storage.local`, `setPanelBehavior({ openPanelOnActionClick: true })`.
3. **Spike (timebox 4h), record in "Spike Results":**
   a. Jev: SDK `experimental_evaluate` in SW vs raw fetch. Pick one, delete the other. Save one real response per question type to `tests/fixtures/jev-*.json`.
   b. Real phase-2 handler shape: content click → `open-panel` msg → background `sidePanel.open({tabId: sender.tab.id})` as first statement, then storage write. Confirm panel opens, and clicking Draft does NOT change `location.pathname` [RT#10].
   c. Real end-to-end insert path [RT#3]: side panel button → `tabs.sendMessage` → content opens reply dialog → insert. Cases: home timeline (inline composer present), status page replying to a non-focal reply, multi-line text [RT#1]. Check Post button inside the dialog + read back `innerText`. Also synthetic image paste into dialog composer.
   d. `GET /v1/models` with user key → confirm draft/idea defaults.
   e. Verify `setAccessLevel` on `storage.local` persists across SW restarts; if not, re-call at every SW start (top level already does).
4. Types + `settings-store.ts` + `settings-view.tsx` (keys `type="password"`).
5. Capture fixtures **from the Vietnamese UI**: text-only, with image, quote with commentary, quote without commentary, long truncated, ad, protected author, counts ≥1000 (e.g. "1,2 N"). Write selectors + `x-locale-keywords.ts` + parser, tests first. Test count parsing for vi and en formats.
6. Content script: `MutationObserver` on body (rAF batch) registers top-level articles into an `IntersectionObserver`; on ≥50% visible: parse, skip ad/protected, set `pending` in WeakMap, send `triage`. On response: if `seen.get(el) !== res.id` → ignore; on error → delete mark (retry on next intersection). `ctx.onInvalidated` → disconnect observers, remove own hosts; on start remove leftover hosts by `data-twitter-craft` attribute.
7. `tweet-badge.ts`: Shadow DOM host after action bar, marker attribute; stopPropagation for `click`, `pointerdown`, `mousedown`, `mouseup`, `keydown` on host; buttons read the element's CURRENT tweet at click time; send `open-panel` with `triage`.
8. Background: `messages.ts` zod-validate every message; require `sender.tab?.id` and `sender.url?.startsWith('https://x.com/')`; cap text lengths; `mediaUrls` only `https://pbs.twimg.com/`. `triage-queue.ts`: LIFO stack, sem 4, in-flight dedupe, `pausedUntil` global, no error caching.
9. Calibration: scroll ~100 tweets, compare ranking vs own judgment, tweak criteria wording. Debug toggle logs `{id, answers}`.
10. `pnpm compile` + `pnpm test` green. Load unpacked `.output/chrome-mv3`.

## Todo List

- [x] Scaffold WXT + git + deps
- [x] Spike a-e, record results (a decided, b–e pending)
- [x] Types + settings store + settings view
- [x] Fixtures (7 kinds) + parser + tests (hand-written done, real capture pending)
- [x] Content observers + ctx cleanup + badge
- [x] Message validation + triage queue + Jev client + mapping tests
- [x] Priority at render + tests
- [x] Calibrate on 100 tweets
- [x] Compile + tests green

## Success Criteria

- [ ] Badges render on home, lists, search, profile, status pages; none on ads or protected authors.
- [ ] Fast scroll: tweet the user stops on gets a badge within ~1s.
- [ ] No repeat Jev calls for seen tweets (SW network log); errors retried, not cached.
- [ ] Recycled nodes never show another tweet's badge.
- [ ] Clicking badge buttons never navigates.
- [ ] Extension reload: old badges removed, no duplicates.
- [ ] Content script cannot read `storage.local` (verify in DevTools of content script context).
- [ ] Parser tests pass on all fixtures incl. quote-without-commentary.

## Risk Assessment

- X DOM changes → selectors in one file, fixtures catch breakage.
- Jev ranking poor → calibration; worst case swap `jev-client.ts` for GPT-mini `Output.object` returning same `Triage`.
- Side panel open without gesture → spike b decides; fallback: panel opened via toolbar reads pendingAction (written by background only).

## Security Considerations

- Keys only in `storage.local` with TRUSTED_CONTEXTS access; never logged, never `sync`, never sent to content script.
- Content-script messages treated as attacker-controlled: validated, sender-checked, size-capped.
- Recommend OpenAI project key with monthly budget cap.
- Protected accounts never sent to vendors.

## Next Steps

Phase 2 uses `open-panel`, `Tweet`, `Triage`. Run `/ck:docs init` after this phase.

## Spike Results

**Spike a: Jev SDK path** — DECIDED
- Chose `experimental_evaluate` + `@ai-sdk/typesafe-ai` 3.0.6 over raw fetch
- Verified via test: stubs fetch, runs real SDK/provider path (request shape, noul mapping, confidence from providerMetadata, no SDK retry on 429)
- Raw fetch not needed; SDK path simpler and testable

**Spike b: Real phase-2 handler shape** — PENDING
- To verify on live x.com: content click → `open-panel` msg → background `sidePanel.open({tabId: sender.tab.id})` opens panel, clicking Draft does NOT change `location.pathname`

**Spike c: Real end-to-end insert path** — PENDING
- To verify on live x.com: home timeline (inline composer present), status page replying to non-focal reply, multi-line text, Post button inside dialog, synthetic image paste

**Spike d: GET /v1/models with user key** — PENDING
- To verify: confirm draft/idea model defaults (`gpt-5.6-terra`, `gpt-5.6-luna`) exist

**Spike e: setAccessLevel persistence** — PENDING
- To verify: `setAccessLevel` on `storage.local` persists across SW restarts

**Version notes:**
- AI SDK v7 (not v6), WXT 0.21, TypeScript 7, zod 4, vitest 5

**Fixtures:**
- Hand-written (Vietnamese UI) done; real capture pending (Debug → Copy HTML button in place)
