---
type: brainstorm-report
date: 2026-09-25
status: approved
project: twitter-craft
---

# Brainstorm: twitter-craft Chrome extension

## Summary

Personal Chrome extension for x.com. Triages tweets while user scrolls (Jev, System One model), drafts replies/quotes with optional media via GPT (Vercel AI SDK), suggests action per tweet, captures build-worthy ideas into a TODO list. Human always clicks Post. No backend.

## Problem & requirements

- Scan tech/AI tweets, surface the genuinely useful ones.
- Draft engaging replies (text + card image / GIF suggestion), in tweet's language.
- Suggest retweet/quote for strong posts.
- Capture ideas worth turning into side projects → TODO for later review.
- AI via Vercel AI SDK so model swap is cheap. GPT first.
- Goals (all three): grow followers/personal brand, learn + collect knowledge, promote own projects.

## Decisions (agreed)

| Topic | Decision |
|---|---|
| Automation | AI drafts, user reviews and clicks Post. No auto-post (X automation rules, ban risk, AI-slop risk) |
| Feed source | Passive: triage tweets visible while user scrolls. No auto-scroll/crawl |
| Triage trigger | Jev decides which tweets deserve an LLM call (user has Jev key) |
| Media | Template-rendered cards (PNG) + GIF keyword suggestion. No AI image gen |
| Ideas store | `chrome.storage.local`, side panel tab, export Markdown |
| Reply language | Same as source tweet |
| Retweet | AI suggests action (reply/quote/retweet/save_idea/skip), user executes |
| Backend | None (YAGNI). Keys in `chrome.storage.local` |

## Approaches evaluated

| | Approach | Pros | Cons |
|---|---|---|---|
| **A (chosen)** | Extension only. Jev triage + GPT drafts from background SW | Simplest, ~$0.03/day triage, 100ms latency, calibrated confidence | Jev brand new, keys stored client-side |
| B | A + backend (Hono/Next on Vercel) for keys, DB, cron | Keys off client, multi-device sync, enables crawl | Infra + auth overhead for single user |
| C | No Jev, GPT-mini batch triage (10 tweets/call) | Single vendor | 1-3s latency, no calibrated confidence, 10-50x pricier (still cheap). Kept as fallback |

## Jev research notes

- TypeSafe AI "System One" model, launched 2026-09-15. Returns typed answers + probabilities + confidence, does not generate text.
- Endpoint `POST https://api.typesafe.ai/v1/systemone`, Bearer auth. Body: `model` (`jev-latest`), `state` (text/object/array), `questions` map.
- Question types: `noul` (0-1 probability), `choice` (≤255 options, required criteria map), `score` (2-10 ordered levels).
- Questions evaluated in parallel → many questions ≈ cost of one. One state per request (no multi-item batching).
- Pricing ~$0.042 / 1M input tokens, output free. Latency 70-500ms (mostly ~100ms). Limits ~1,200 req/min.
- State ≤ ~64k tokens. Text/JSON only, no images.
- Weak at: counting, math, dates, indirection, writing → do those in code.
- JS SDK `@typesafe-ai/sdk` (docs say Node 20+). AI SDK integration: `experimental_evaluate` + `@ai-sdk/typesafe-ai` (reported Node 22+). Also on AI Gateway as `typesafe-ai/jev`.
- Signups paused 2026-09-22 (user already has key).
- Confidence-routing pattern: <0.6 = uncertain → human decides.

## Final design

### Architecture

```
x.com tab
 ├─ content script ─ parse tweet (data-testid) ─ badge (Shadow DOM) [Draft][Idea]
 │        ▲ triage result
 ├─ background SW ─ Jev triage (~100ms, cache by tweet id)
 │        └─ AI SDK generateText + Output.object ─ GPT (draft / card / idea)
 └─ side panel (React): Draft | Ideas | Settings
          └─ Insert ─► paste text + PNG into X composer ─► user clicks Post
```

Stack: WXT + React + TypeScript, `ai`, `@ai-sdk/openai`, `@ai-sdk/typesafe-ai` (or raw fetch), `zod`, `html-to-image`.

### 1. Triage (Jev, automatic, 1 call per visible tweet)

- State: `{author, text, quoted_text, has_media, alt_text, lang}`.
- Questions (one request):
  - `quality` score (5 levels: bait/promo → generic → decent → substantive → exceptional)
  - `action` choice: reply | quote | retweet | save_idea | skip
  - `topic` choice: ai_ml, llm_agents, web_dev, devops_infra, languages, career, startup, off_topic
  - `reply_opening` noul: does the post invite a knowledgeable reply that adds value
  - `project_match` choice: user's projects (from settings) + none
  - `build_idea` noul: contains technique/idea that could become a side project
- Code-side signals (Jev can't do math/dates): tweet age, engagement velocity → freshness boost for follower growth.
- Confidence < 0.6 → badge shows "?". Low quality → dim tweet (toggle).
- Cache results by tweet id; concurrency limit in SW.

### 2. Draft (GPT, only on click)

- Input: tweet + media URLs (vision) + persona + voice samples + project list.
- Output (zod): `{ replies: [3 angles: insight | question | experience], quote?, card?, gifQuery?, skipReason? }`.
- Anti-slop: 10-20 real tweets of user as few-shot, banned phrases list, each reply must contain one concrete point (number, experience, counterexample, question), `skip` allowed.
- Promotion: only when `project_match` high, no link in first reply, frequency cap.

### 3. Media

- Cards: React templates (insight, code snippet, comparison) → PNG via `html-to-image` → synthetic paste event (DataTransfer text + image file) into composer. Fallback: copy to clipboard.
- GIF: AI suggests keyword; button opens X's GIF picker (prefill search if feasible). No Giphy key.

### 4. Retweet / quote

Badge shows suggested action. Retweet = user uses native button (highlighted). Quote = open quote composer + paste draft.

### 5. Ideas / TODO

`Idea` button → GPT expands into `{title, problem, insight, mvp_scope, stack, source_url, tags}` → `chrome.storage.local` → side panel tab with status (new/reviewing/doing/dropped) → export `.md`.

### 6. Settings

OpenAI key, Jev key, model id per task (draft / idea), persona + voice samples, projects (name, description, link), thresholds, banned phrases.

## Cost estimate

- Jev: ~500 tweets/day × ~1.5k tokens ≈ 0.75M tokens ≈ $0.03/day.
- GPT: only on click, ~30 drafts/day → cents to ~$0.3/day depending on model.

## Risks & mitigations

| Risk | Mitigation |
|---|---|
| X DOM changes break parser/composer insert | All selectors in one file, rely on `data-testid`; expect periodic fixes |
| Jev SDK / AI SDK `evaluate` fails in MV3 service worker (Node 20/22+ noted) | Day-1 spike; fallback raw `fetch` to `/v1/systemone` (~20 lines) |
| Jev vendor risk (10 days old, early access, experimental AI SDK API) | Triage behind one module with own output type; swap to GPT-mini (approach C) if needed; pin versions |
| Jev text-only → image-heavy tweets underrated | Send alt text + `has_media`; manual Draft still uses GPT vision |
| Jev calibration on tweet quality unknown (vendor claims) | Eyeball first ~100 tweets, tune criteria wording |
| AI-sounding replies hurt brand | Voice samples, banned phrases, concreteness rule, allow skip |
| Self-promotion looks spammy | project_match gate, no link in first reply, frequency cap |
| Synthetic paste of image blocked by X | Fallback clipboard copy |
| API keys plaintext in `chrome.storage.local` | Personal use only; never publish build with keys |

## Phases

1. Scaffold WXT + settings + tweet parser + Jev triage + badges (incl. SW spike for Jev).
2. GPT draft reply/quote in side panel + insert into composer (text).
3. Ideas/TODO + Markdown export.
4. Card templates → PNG paste + GIF keyword.

Later (YAGNI now): track which replies earn followers, list/search crawl, backend sync.

## Success criteria

- Badges appear on visible tweets within ~1s, no duplicate calls per tweet id.
- Top-scored tweets match user's judgment on a 100-tweet sample (tune until acceptable).
- Draft → edit → Insert → Post flow ≤ 3 clicks.
- Ideas persist across sessions and export to valid Markdown.
- Triage cost ≤ $0.10/day at normal usage.

## Unresolved questions

- Exact OpenAI model ids for draft/idea (verify current lineup at plan time).
- Whether `@ai-sdk/typesafe-ai` runs in extension SW (spike).
- Whether X accepts synthetic paste with image file in reply composer (spike).
- Engagement velocity source: DOM metrics only (no follower counts) — enough?

## Sources

- https://flaviocopes.com/jev/
- https://docs.typesafe.ai/introduction
- https://docs.typesafe.ai/api.md
- https://docs.typesafe.ai/sdk/javascript.md
- https://docs.typesafe.ai/patterns/confidence-routing.md
- https://en.wikipedia.org/wiki/Jev_(AI_model)
- https://x.com/aisdk/status/2100371570871185745
- https://www.netlify.com/changelog/typesafe-jev-ai-gateway/
- https://vercel.com/blog/ai-sdk-6
- https://ai-sdk.dev/docs/reference/ai-sdk-core/output
- https://wxt.dev/
- https://kanopylabs.com/blog/wxt-vs-plasmo-vs-extension-js
