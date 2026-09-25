# Code Standards

Conventions actually used in this codebase.

## File and Naming

**File naming:** kebab-case, descriptive purpose

Examples:
- `lib/tweet-parser.ts` — Tweet DOM parsing
- `lib/x-dom-selectors.ts` — All X.com selectors
- `lib/visibility-gate.ts` — IntersectionObserver logic
- `components/settings-view.tsx` — Settings form UI
- `entrypoints/x-timeline.content/` — Content script entrypoint

**File size:** Keep files under 200 lines for context management

- `lib/triage-queue.ts` — 109 lines (queue + pause logic)
- `lib/tweet-parser.ts` — ~150 lines (DOM parsing + validation)
- `entrypoints/x-timeline.content/index.ts` — 136 lines (content script lifecycle)

**Import paths:** Use `@/` alias (configured in `wxt.config.ts`)

```ts
import { SEL } from '@/lib/x-dom-selectors';
import { renderBadge } from '@/lib/tweet-badge';
```

## Type Safety

**Zod schemas at boundaries:** Every cross-context message and storage access is validated with zod

```ts
// lib/types.ts
export const TweetSchema = z.object({
  id: z.string().regex(/^\d{1,25}$/),
  authorHandle: z.string().regex(HANDLE),
  // ...
});

// lib/messages.ts
export const ContentMessageSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('triage'), tweet: TweetSchema }),
  // ...
]);

// usage in background.ts
const parsed = ContentMessageSchema.safeParse(raw);
if (!parsed.success) return;  // Reject untrusted message
```

**Why:** Content scripts run in x.com's renderer; all messages are attacker-controllable. Zod ensures no malformed data reaches storage or APIs.

## X DOM Access

**All selectors live in `lib/x-dom-selectors.ts`**

Single source of truth for X's DOM structure. When X changes its UI, update this file; the rest of the codebase finds selectors via named constant.

```ts
export const SEL = {
  tweet: 'article[data-testid="tweet"]',
  tweetText: '[data-testid="tweetText"]',
  permalink: 'a[href*="/status/"]',
  // ...
};

// Usage everywhere:
const text = article.querySelector(SEL.tweetText)?.textContent;
```

**Locale keywords in `lib/x-locale-keywords.ts`**

Fallback keywords for detecting ads and protected accounts (used when CSS selectors aren't available or language differs from English).

```ts
export const keywords = {
  vi: { ad: ['Quảng cáo'], protected: ['Tài khoản được bảo vệ'] },
  en: { ad: ['Ad'], protected: ['Protected'] },
};
```

## Tweet Content Access

**Use `textContent` only; never `innerHTML`**

- Safe: `node.textContent` → plain string
- Unsafe: `innerHTML` → XSS risk, plus includes invisible markup

```ts
// ✓ Good
const text = tweetNode.querySelector(SEL.tweetText)?.textContent || '';

// ✗ Bad
const html = tweetNode.innerHTML;  // XSS; also includes metadata
```

## Comments

**Comment only non-obvious logic: constraints, invariants, protocols, "why" not "what"**

- No narration: "// loop through items"
- No step numbering: "// 1. fetch data"
- No rephrasing: If the code name says it, don't comment it again

**Examples:**

```ts
// ✓ Good: explains why and constraint
// The SW can be stopped mid-pause; persist the pause so a restart doesn't hammer Jev again.
const pausedUntilItem = storage.defineItem<number>('session:triagePausedUntil', { fallback: 0 });

// ✓ Good: protocol/invariant
// Must run before any await: sidePanel.open() needs the user gesture carried by this message.
browser.sidePanel.open({ tabId: tab.id });

// ✗ Bad: restates obvious code
// Check if the parsed message is successful
if (!parsed.success) return;
```

## Error Handling

**Always catch promise rejections; log or ignore explicitly**

```ts
// ✓ Good: caught and logged
void browser.sidePanel.open({ tabId: tab.id }).catch((err) => {
  console.warn('[twitter-craft] sidePanel.open', err);
});

// ✓ Good: re-parse on error to avoid bricking on corrupted field
const full = SettingsSchema.safeParse(raw);
if (full.success) return full.data;
const shape = SettingsSchema.shape as Record<string, { safeParse: (v: unknown) => { success: boolean } }>;
const valid = Object.fromEntries(Object.entries(raw).filter(([k, v]) => shape[k]?.safeParse(v).success));
return SettingsSchema.parse(valid);

// ✗ Bad: unhandled rejection
browser.sidePanel.open({ tabId: tab.id });
```

## Testing

**Test location:** `tests/{name}.test.ts`

**Fixtures:** `tests/fixtures/`

Hand-written tweet DOM from X's structure. Replaced with real captures as X updates selectors.

**Framework:** vitest + happy-dom (no browser needed)

```ts
import { describe, it, expect } from 'vitest';
import { parseTweet } from '@/lib/tweet-parser';
import tweetFixture from './fixtures/tweet-normal.html?raw';

describe('tweet parser', () => {
  it('parses normal tweet', () => {
    const doc = new DOMParser().parseFromString(tweetFixture, 'text/html');
    const article = doc.querySelector('article')!;
    const tweet = parseTweet(article);
    expect(tweet?.text).toContain('hello');
  });
});
```

## Storage

**Never store sensitive data in `sync` or `session` + `sync`**

- `local:settings` — API keys, stored locally only (TRUSTED_CONTEXTS)
- `session:*` — Cache + transient state, cleared per session

```ts
// ✓ Good: TRUSTED_CONTEXTS access level
export const settingsItem = storage.defineItem<Settings>('local:settings', {
  fallback: SettingsSchema.parse({}),
});

// In background.ts, set access level once:
void browser.storage.local.setAccessLevel({ accessLevel: 'TRUSTED_CONTEXTS' });
```

## Console Logging

**Use `[twitter-craft]` prefix for all logs**

Helps distinguish extension logs from x.com's console noise.

```ts
console.warn('[twitter-craft] triage failed', err);
console.log('[twitter-craft] triage', url, result);
```

## Build and Compile

**Verify before commit:**

```bash
pnpm compile   # tsc --noEmit (no errors)
pnpm test          # All tests pass
pnpm build     # Produces .output/chrome-mv3/
```

## TypeScript

**Strict mode enabled** (default for WXT projects)

- Explicit return types for exported functions
- No `any`; use `unknown` + narrowing if needed
- Use `as const` for literal string unions to avoid loosening

```ts
// ✓ Good
export function computePriority(triage: Triage, tweet: Tweet): number {
  return Math.round((triage.quality || 0) * tweet.metrics.views / 100);
}

// ✓ Good: literal type
const TRIAGE_ACTIONS = ['reply', 'quote', 'retweet', 'save_idea', 'skip'] as const;
export type Action = typeof TRIAGE_ACTIONS[number];
```

## React Components

**Size:** Aim for single-responsibility; split if >100 lines

**Example:** `components/settings-view.tsx` (169 lines)

- Uses custom helper `Field` component for repeated label + input pattern
- Handles form state + validation + storage in one component (acceptable for settings; split if re-used)

**Props:** Keep props stable (no inline objects in default values)

```ts
// ✓ Good
function Field({ id, label, hint, children }: {
  id: string;
  label: string;
  hint?: string;
  children: ReactNode;
}) {
  return (…);
}

// ✗ Bad: object creates new reference every render
<Field {...{ id: 'x', label: 'y' }} />
```

## Tailwind v4 + shadcn/ui

**Setup:**
- `@tailwindcss/vite` plugin (WXT handles it)
- shadcn/ui components in `components/ui/`
- `dark:` variants via `@custom-variant`

**Example:** `components/settings-view.tsx`

```tsx
<div className="space-y-6 p-4 pb-20">
  <section className="space-y-3">
    <h2 className="text-sm font-semibold">API keys & models</h2>
  </section>
</div>
```
