# twitter-craft

Personal Chrome MV3 extension for x.com. Triages visible tweets using Jev (TypeSafe System One model), shows badge with priority/action, and side panel (React + Tailwind v4 + shadcn/ui) for settings, drafting, and ideas. GPT drafts replies/quotes with localized tone (reaction/question/take angles). Generates cards as PNG images (insight/code/compare kinds) with dark/light themes. GIF suggestions via X's picker. Captures ideas → export Markdown. No backend; keys local only.

## Setup

```bash
pnpm install
pnpm dev           # Watch + auto-rebuild
pnpm build         # Production build
pnpm compile       # TypeScript type check
pnpm test              # Run test suite
```

## Load Extension

1. Build: `pnpm build`
2. Open `chrome://extensions/`
3. Enable "Developer mode" (top right)
4. Click "Load unpacked"
5. Select `.output/chrome-mv3/` directory
6. In x.com side panel: set Jev API key, OpenAI API key, and interests/projects

## Scripts

| Script | Purpose |
|--------|---------|
| `pnpm dev` | Watch mode; rebuilds on file change |
| `pnpm build` | Production build to `.output/chrome-mv3/` |
| `pnpm zip` | Create `.output/chrome-mv3.zip` for submission |
| `pnpm compile` | TypeScript type check (no emit) |
| `pnpm test` | Run all tests with vitest |

## Key Configuration

**API Keys (stored locally, never synced):**
- Jev key: TypeSafe AI API key. Get from https://typesafe.ai
- OpenAI key: Project-scoped key with monthly budget cap. Get from https://platform.openai.com/api-keys

**Settings (side panel):**
- Jev API key: TypeSafe AI API key (live triage)
- OpenAI API key: Project-scoped key (draft generation)
- Draft model: Default gpt-5.6-terra (or custom)
- Min quality threshold: Dim tweets below this priority (0–100, default 40)
- Interests: Line-separated list. Shapes how Jev scores tweets.
- Projects: `name | description | url` per line. Affects scoring.
- Max reply chars: 280 (X Free) to 25,000 (X Premium). Applied to character counter + safety check.
- Readable languages: en, vi (default). Non-readable posts translate to English before draft.
- Voice samples: Your own tweets/replies, manually added or saved from edited drafts. Shapes draft tone.
- Banned phrases: Phrases to avoid in drafts
- Debug: Enable to log raw Jev answers + copy HTML button

## Safety Notes

**Human-in-the-loop only.** Extension never clicks Post, Retweet, Like, or any confirmation. User always reviews and clicks Post manually.

**Keys stay local.** API keys are stored in `chrome.storage.local` with `TRUSTED_CONTEXTS` access level; never readable by content scripts or synced across devices.

**Use project keys.** OpenAI: Create a project-scoped API key at https://platform.openai.com/account/billing/overview and set a monthly budget cap to $5–$10 to avoid runaway costs.

**Protect account.** Never publish or share keys. Extension is for personal use only.

## Architecture

- **Content script** (`entrypoints/x-timeline.content/`): Parses visible tweets, monitors for changes, renders badges, handles media/GIF insertion
- **Background service worker** (`entrypoints/background.ts`): Validates messages, calls Jev, manages triage queue, opens side panel
- **Side panel** (`entrypoints/sidepanel/`): Settings, Draft tab (GPT-generated replies/quotes with optional card + GIF), Ideas tab, compose insert
- **Storage:**
  - `local:settings` — API keys, interests, projects, voice samples, banned phrases (TRUSTED_CONTEXTS only)
  - `local:ideas` — Persisted ideas (title, problem, insight, mvpScope, stack, promo, tags, status)
  - `session:triage:{hash}:{id}` — Cached Jev answers per session
  - `session:triagePausedUntil` — Rate-limit pause timestamp
  - `session:pendingAction` — Draft/idea action (nonce, at, windowId, tabId, kind, tweet, triage) awaiting side panel

See [System Architecture](./docs/system-architecture.md) for detailed contexts and message flow.

## Development

- **Code standards**: [code-standards.md](./docs/code-standards.md)
- **Codebase summary**: [codebase-summary.md](./docs/codebase-summary.md)
- **Roadmap**: [development-roadmap.md](./docs/development-roadmap.md)
- **Changelog**: [project-changelog.md](./docs/project-changelog.md)

## Testing

```bash
pnpm test              # Run all tests
pnpm test tweet-parser  # Run one test file
pnpm test --ui      # TUI mode
```

Tests use `vitest` + `happy-dom`. Fixtures in `tests/fixtures/` are hand-written from X's DOM; replace with live captures as X changes selectors.

## Troubleshooting

**Badge not showing:** Check min quality threshold; 40 is default. Idea badges (kind=idea) always show if buildIdea ≥ 0.6.
**"Copy HTML" button missing:** Enable Debug in settings
**Triage errors "rate_limited":** Wait 30s, extension auto-retries. Queue pauses at 429/529 response.
**Draft fails or times out:** Check OpenAI API key in Settings. Draft generation timeout: 30s. Model must be in API account.
**Card renders but doesn't attach:** Attach toggle must be checked. If render fails, toggle auto-unticks (text still posts). Try again.
**Card image shows "Could not render":** Timeout 5s or image > 3MB. Simplify card content or try different theme.
**GIF picker not opening:** Only works when card is not attached (X allows one image/GIF per post). Uncheck "Attach card" first.
**Insert fails (says "dialog_open"):** Close any open reply/quote dialog on x.com; try Insert again.
**Text not inserting into composer:** Multi-line text: extension uses paste if execCommand fails. Ensure clipboard is available.
**Image_failed result:** Text inserted but X didn't accept the card image. Try Insert again; card may be too large or format unsupported.
**Voice sample not saving:** Click "Save as voice sample" only after editing a draft (shows after successful insert).
**Translated posts show wrong language:** Check Settings; readable languages are en, vi. Non-readable posts translate to English.
