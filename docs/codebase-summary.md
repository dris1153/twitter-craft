# Codebase Summary

One-line description per source file.

## Entrypoints

| File | Lines | Purpose |
|------|-------|---------|
| `entrypoints/background.ts` | 57 | Background service worker: validates messages, calls Jev, manages triage queue, opens side panel |
| `entrypoints/x-timeline.content/index.ts` | 135 | Content script: parses tweets, monitors DOM, renders badges, handles click events |
| `entrypoints/sidepanel/app.tsx` | 10 | Root React component for side panel UI |
| `entrypoints/sidepanel/main.tsx` | 10 | Side panel mount point and React DOM initialization |

## Components

| File | Lines | Purpose |
|------|-------|---------|
| `components/settings-view.tsx` | 112 | Settings form UI: API keys, triage prefs, voice config; loads/saves to storage |
| `components/draft-view.tsx` | 110+ | Draft tab UI: display generated drafts, edit variants, insert into composer, save voice samples |
| `components/draft-variant-editor.tsx` | — | Reusable draft variant editor (reply/quote variant with insert + copy buttons) |
| `components/ui/button.tsx` | — | shadcn/ui Button (generated) |
| `components/ui/input.tsx` | — | shadcn/ui Input (generated) |
| `components/ui/label.tsx` | — | shadcn/ui Label (generated) |
| `components/ui/switch.tsx` | — | shadcn/ui Switch toggle (generated) |
| `components/ui/textarea.tsx` | — | shadcn/ui Textarea (generated) |

## Libraries

### Core Types & Messages

| File | Lines | Purpose |
|------|-------|---------|
| `lib/types.ts` | 77 | Zod schemas: Tweet, Triage, Settings, TriageError; type exports |
| `lib/messages.ts` | 28 | Content message schemas (triage, get-prefs, open-panel); TriageResponse type |

### Storage & Draft Session

| File | Lines | Purpose |
|------|-------|---------|
| `lib/settings-store.ts` | 34 | Load/save `local:settings`; handle corrupted fields gracefully; compute settings hash for cache key |
| `lib/pending-action-store.ts` | 7 | `session:pendingAction` item (nonce + tweet + triage awaiting side panel) |

### Triage Logic

| File | Lines | Purpose |
|------|-------|---------|
| `lib/triage-queue.ts` | 108 | Queue with concurrency (4), pause on rate limit, cache per session, LIFO overflow, auto-retry |
| `lib/jev-triage.ts` | 157 | Build Jev evaluation questions; call TypeSafe AI SDK; parse and normalize responses; convex quality weighting |
| `lib/triage-priority.ts` | 27 | Compute priority score (0–100): 0.75·quality + 0.25·replyOpening + freshness + hot bonus; isIdeaWorthy check (buildIdea ≥ 0.6) |

### Draft & Composer (Phase 2)

| File | Lines | Purpose |
|------|-------|---------|
| `lib/draft-generator.ts` | 47 | Generate drafts via OpenAI: AI SDK 7 generateText + Output.object + DraftSchema; 30s timeout, store:false, maxRetries:0 |
| `lib/draft-prompt.ts` | 100+ | Build draft prompt: instructions (trusted context only) + user message (JSON + images); replyLanguage logic |
| `lib/draft-safety-checks.ts` | 60+ | Check for unknown links/handles, bait patterns, text length before insert; confirm if risky |
| `lib/x-composer.ts` | 180+ | Insert draft into x.com composer: dialog scope, target verification, focus check, execCommand + paste fallback, post-button check |
| `lib/panel-to-tab.ts` | 40+ | Send insert message from side panel to content script; handle result codes; clipboard fallback logic |
| `lib/ai-models.ts` | 20+ | Resolve draft model (gpt-5.6-terra or settings override); check API key presence |

### Tweet Parsing

| File | Lines | Purpose |
|------|-------|---------|
| `lib/tweet-parser.ts` | 123 | Parse tweet from article element: text, metrics, author, media, quoted post; detect ads/protected |
| `lib/x-dom-selectors.ts` | 22 | All X.com DOM selectors (article, text, permalink, metrics, quote, etc.) |
| `lib/x-locale-keywords.ts` | 23 | Locale-specific keywords for detecting ads and protected status (en, vi) |

### Rendering & Interaction

| File | Lines | Purpose |
|------|-------|---------|
| `lib/tweet-badge.ts` | 91 | Render badge UI (loading/ready/error); attach click handlers for draft/idea/debug |
| `lib/visibility-gate.ts` | 51 | IntersectionObserver with 400ms dwell and multi-threshold logic for visibility detection |

### React Hooks (Phase 2)

| File | Lines | Purpose |
|------|-------|---------|
| `hooks/use-pending-action.ts` | — | Poll session:pendingAction; extract tweet + triage context; nonce check for staleness |
| `hooks/use-draft-session.ts` | — | Manage draft state: variants, edits, insertion status; queue new tweets while editing |

### Utilities

| File | Lines | Purpose |
|------|-------|---------|
| `lib/settings-form.ts` | 61 | Convert Settings ↔ form shape (parse/unparse interests, projects, voice samples) |
| `lib/x-routes.ts` | 12 | Allowlisted X routes where triage runs (home, search, bookmarks, not direct messages) |
| `lib/messages.ts` | 40+ | Content message schemas; TriageResponse type; InsertMode type (reply/quote); InsertResult codes |
| `lib/utils.ts` | 6 | Shared utilities (if any) |

## Tests

| File | Purpose |
|------|---------|
| `tests/tweet-parser.test.ts` | Parse normal tweets, replies, quoted posts, protected/ad detection |
| `tests/tweet-parser-edge-cases.test.ts` | Edge cases: truncated text, Show-more links, media parsing |
| `tests/triage-queue.test.ts` | Queue concurrency, rate-limit pausing, cache hits, LIFO overflow |
| `tests/jev-triage-sdk.test.ts` | Call real TypeSafe SDK with stubbed fetch; verify response parsing |
| `tests/jev-triage-build-state.test.ts` | Build evaluation questions for interests/projects |
| `tests/jev-triage-additional.test.ts` | Additional fields: botInstructions, projectMatch, buildIdea |
| `tests/jev-triage-build-questions.test.ts` | Question building (quality, action, topic, etc.) |
| `tests/triage-logic.test.ts` | Priority scoring: quality, freshness, recency decay |
| `tests/messages.test.ts` | ContentMessageSchema validation |
| `tests/settings-form.test.ts` | Settings ↔ form shape conversion |
| `tests/settings-store.test.ts` | Load/save settings; graceful degradation on corrupted fields |
| `tests/settings-recovery.test.ts` | Field recovery: keep valid fields when one is corrupted |
| `tests/tweet-badge.test.ts` | Badge rendering and state transitions |
| `tests/visibility-and-routes.test.ts` | Visibility gate logic and X route allowlist |

## Configuration

| File | Purpose |
|------|---------|
| `wxt.config.ts` | WXT framework config: React module, Tailwind, manifest permissions |
| `tsconfig.json` | TypeScript strict mode, path aliases (`@/`) |
| `vitest.config.ts` | Test runner config: happy-dom, globals |
| `components.json` | shadcn/ui config (aliases, component paths) |
| `tailwind.config.ts` | Tailwind v4 config (if generated by shadcn/ui init) |

## Fixtures

| File | Purpose |
|------|---------|
| `tests/fixtures/README.md` | Guidance: hand-written from X DOM; replace with live captures |
| `tests/fixtures/*.html` | Sample tweet article elements from X (used by parsers tests) |

## Public Assets

| File | Purpose |
|------|---------|
| `public/icon*.png` | Extension icons (16, 48, 128) |
| `public/twitter-craft.html` | Side panel HTML template (WXT generates from React) |

## Build Output

| Directory | Purpose |
|-----------|---------|
| `.output/chrome-mv3/` | Production extension (generated by `pnpm build`) |
| `.output/chrome-mv3.zip` | Distributable extension package (generated by `pnpm zip`) |
| `.wxt/` | WXT build cache and metadata |
| `node_modules/` | Dependencies (pnpm install) |

## Dependency Tree (Key Libraries)

- **WXT 0.21** — Extension framework
  - `@wxt-dev/module-react` — React integration
- **React 19** — UI component library
- **TypeScript 7** — Type checking
- **Tailwind CSS v4** — Utility CSS framework
- **shadcn/ui** — Component library (Button, Input, Switch, etc.)
- **Zod 4** — Runtime schema validation
- **AI SDK 7** — LLM client library
  - `@ai-sdk/typesafe-ai` — TypeSafe AI (Jev) provider
  - `@ai-sdk/openai` — OpenAI provider (phase 2)
- **Vitest 5** — Unit test framework
- **happy-dom 20** — Minimal DOM implementation for tests

## Size & Metrics

- **Total source lines:** ~1,065 (entrypoints, components, lib)
- **Test lines:** ~1,200 (14 test files, 122 test cases)
- **Type coverage:** Strict TypeScript, all public functions have explicit return types
- **Bundle size:** ~400 KB (extension) before gzip (WXT minifies)
