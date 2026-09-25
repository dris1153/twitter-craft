# twitter-craft

Personal Chrome MV3 extension for x.com. Triages visible tweets using Jev (TypeSafe System One model), shows badge with priority/action, and side panel (React + Tailwind v4 + shadcn/ui) for settings. GPT drafts replies/quotes (phase 2). No backend; keys local only.

## Setup

```bash
npm install
npm run dev           # Watch + auto-rebuild
npm run build         # Production build
npm run compile       # TypeScript type check
npm test              # Run test suite
```

## Load Extension

1. Build: `npm run build`
2. Open `chrome://extensions/`
3. Enable "Developer mode" (top right)
4. Click "Load unpacked"
5. Select `.output/chrome-mv3/` directory
6. In x.com side panel: set Jev API key, OpenAI API key, and interests/projects

## Scripts

| Script | Purpose |
|--------|---------|
| `npm run dev` | Watch mode; rebuilds on file change |
| `npm run build` | Production build to `.output/chrome-mv3/` |
| `npm run zip` | Create `.output/chrome-mv3.zip` for submission |
| `npm run compile` | TypeScript type check (no emit) |
| `npm test` | Run all tests with vitest |

## Key Configuration

**API Keys (stored locally, never synced):**
- Jev key: TypeSafe AI API key. Get from https://typesafe.ai
- OpenAI key: Project-scoped key with monthly budget cap. Get from https://platform.openai.com/api-keys

**Settings (side panel):**
- Min quality threshold: Dim tweets below this priority (0–100, default 40)
- Interests: Line-separated list. Shapes how Jev scores tweets.
- Projects: `name | description | url` per line. Affects scoring.
- Max reply chars: 280 (X Free) to 25,000 (X Premium)
- Voice samples: Your own tweets/replies, separated by `---`
- Banned phrases: Phrases to avoid in drafts

## Safety Notes

**Human-in-the-loop only.** Extension never clicks Post, Retweet, Like, or any confirmation. User always reviews and clicks Post manually.

**Keys stay local.** API keys are stored in `chrome.storage.local` with `TRUSTED_CONTEXTS` access level; never readable by content scripts or synced across devices.

**Use project keys.** OpenAI: Create a project-scoped API key at https://platform.openai.com/account/billing/overview and set a monthly budget cap to $5–$10 to avoid runaway costs.

**Protect account.** Never publish or share keys. Extension is for personal use only.

## Architecture

- **Content script** (`entrypoints/x-timeline.content/`): Parses visible tweets, monitors for changes, renders badges
- **Background service worker** (`entrypoints/background.ts`): Validates messages, calls Jev, manages triage queue
- **Side panel** (`entrypoints/sidepanel/`): Settings UI, future: GPT drafts
- **Storage:**
  - `local:settings` — API keys + user prefs (TRUSTED_CONTEXTS only)
  - `session:triage:{hash}:{id}` — Cached Jev answers per session
  - `session:triagePausedUntil` — Rate-limit pause timestamp
  - `session:pendingAction` — Draft action (nonce, tweet, triage) awaiting side panel

See [System Architecture](./docs/system-architecture.md) for detailed contexts and message flow.

## Development

- **Code standards**: [code-standards.md](./docs/code-standards.md)
- **Codebase summary**: [codebase-summary.md](./docs/codebase-summary.md)
- **Roadmap**: [development-roadmap.md](./docs/development-roadmap.md)
- **Changelog**: [project-changelog.md](./docs/project-changelog.md)

## Testing

```bash
npm test              # Run all tests
npm test -- tweet-parser  # Run one test file
npm test -- --ui      # TUI mode
```

Tests use `vitest` + `happy-dom`. Fixtures in `tests/fixtures/` are hand-written from X's DOM; replace with live captures as X changes selectors.

## Troubleshooting

**"Copy HTML" button missing:** Enable Debug in settings
**Badge not showing:** Check min quality threshold; 40 is default
**Triage errors "rate_limited":** Wait 30s, extension auto-retries
**Wrong draft model:** Verify model ID at https://platform.openai.com/docs/guides/models
