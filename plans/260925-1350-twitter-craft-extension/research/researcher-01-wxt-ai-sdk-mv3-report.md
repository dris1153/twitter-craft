# WXT + AI SDK v6 + MV3 Extension Research Report

**Date:** 2026-09-25  
**Context:** Chrome MV3 extension (twitter-craft) — content script on x.com, background service worker (SW), React side panel, AI-powered drafting.

---

## 1. WXT Version & Project Layout

### Current WXT Status
- **Version:** ~1.x with 243+ releases, weekly cadence, production-ready
- **Build:** Vite-based, ~1.2s build time, ~50% smaller bundle vs alternatives
- **Framework support:** React/Vue/Svelte/Solid out-of-box

### Project Structure
```
wxt.config.ts                  # Manifest + build config
entrypoints/
  └── content.ts              # Content script on x.com (*.content.ts → auto-includes)
  └── background.ts           # Background service worker
  └── sidepanel/
      └── index.tsx           # React side panel root
public/
  ├── icons/
  └── fonts/                  # Bundle fonts here, not from CDN
src/
  ├── components/
  └── utils/
```

### Manifest Generation
- WXT auto-generates `manifest.json` from entrypoint names + `wxt.config.ts`
- Permissions declared in config:
  ```typescript
  // wxt.config.ts
  export default defineConfig({
    manifest: {
      permissions: ['storage', 'sidePanel', 'unlimitedStorage'],
      host_permissions: [
        '*://api.openai.com/*',
        '*://api.typesafe.ai/*',
        '*://pbs.twimg.com/*'  // For tweet image loading
      ],
      action: {}  // Required for sidePanel
    }
  });
  ```

### Side Panel Access from Content Script
**Problem:** `chrome.sidePanel.open()` requires user gesture; content script click event qualifies.

**Solution:**
```typescript
// content.ts
button.addEventListener('click', async () => {
  // This click IS a user gesture
  await chrome.runtime.sendMessage({ action: 'openSidePanel' });
});

// background.ts (service worker)
chrome.runtime.onMessage.addListener((msg, sender) => {
  if (msg.action === 'openSidePanel') {
    chrome.sidePanel.open({ tabId: sender.tab.id });
  }
});
```

**Critical:** `chrome.sidePanel.open()` promise resolves before content loads (~500ms lag). If sending messages immediately after, add delay:
```typescript
chrome.sidePanel.open({ tabId: sender.tab.id });
setTimeout(() => {
  chrome.runtime.sendMessage({ action: 'sidePanelReady', /* data */ }, { target: 'sidePanel' });
}, 500);
```

### Storage & Messaging
- **Storage:** WXT provides `wxt/storage` with `storage.defineItem()` for reactive storage
  ```typescript
  import { storage } from 'wxt/storage';
  const drafts = storage.defineItem('sync:drafts', { defaultValue: [] });
  ```
- **Messaging:** Use plain `chrome.runtime.sendMessage` (no need for `@webext-core/messaging` overhead for simple cases; can upgrade if fan-out needed)

---

## 2. Vercel AI SDK v6 in MV3 Service Worker

### Compatibility Status
**YES**, `generateText` + `output: Output.object({schema})` works in service workers.

### How It Works
- AI SDK v6 built on **web standards** (Fetch API, ReadableStream)
- Runs on: Node.js, Cloudflare Workers, Deno, Bun, browser service workers
- **No Node.js-specific APIs** (no `fs`, `crypto.subtle`, `Buffer` by default)

### Known Service Worker Limits
1. **30-second idle timeout:** SW suspends if no activity for 30s. Long streaming responses can be killed.
   - **Mitigation:** Use `generateText` (single shot), not `streamText`; or keep SW alive with periodic messages
2. **5-minute execution limit:** Single request cannot exceed 5min
   - **Not a blocker** for tweet analysis (should complete in <1s)
3. **No persistent state across suspends:** Each wake-up is fresh context

### Code Example
```typescript
// background.ts (service worker)
import { generateText, Output } from 'ai';
import { createOpenAI } from '@ai-sdk/openai';
import { z } from 'zod';

const openai = createOpenAI({
  apiKey: process.env.OPENAI_API_KEY || globalThis.RUNTIME_OPENAI_KEY
});

chrome.runtime.onMessage.addListener(async (msg, sender, respond) => {
  if (msg.action === 'analyzeTweet') {
    const schema = z.object({
      sentiment: z.enum(['positive', 'negative', 'neutral']),
      topics: z.array(z.string()),
      confidence: z.number().min(0).max(1)
    });

    try {
      const result = await generateText({
        model: openai('gpt-4o'),  // See Q4 for Sept 2026 models
        prompt: msg.tweetText,
        output: Output.object({ schema })
      });

      respond({ success: true, data: result.object });
    } catch (err) {
      respond({ success: false, error: err.message });
    }
  }
});
```

### Runtime API Key Injection
Don't hardcode API keys. Pass at runtime:
```typescript
const apiKey = localStorage.getItem('OPENAI_API_KEY'); // Or from popup settings
const openai = createOpenAI({ apiKey });
```

### Image Input Handling
```typescript
const result = await generateText({
  model: openai('gpt-4o'),
  messages: [
    {
      role: 'user',
      content: [
        { type: 'text', text: 'Describe this tweet' },
        { type: 'image', image: new URL('https://pbs.twimg.com/...')  }
        // SDK passes URL to OpenAI; does NOT download locally
        // OpenAI fetches it server-side — you need host_permission for pbs.twimg.com
      ]
    }
  ]
});
```

---

## 3. @ai-sdk/typesafe-ai + experimental_evaluate

### Status: CONFIRMED AVAILABLE
- **npm package:** `@ai-sdk/typesafe-ai` (official Vercel AI SDK provider)
- **Last checked:** Merged into Vercel AI as of PR #20851 (Sept 2025)
- **Works in:** Node.js, service workers, browsers (fetch-based)

### API Overview
```typescript
import { experimental_evaluate } from 'ai';
import { typeSafeAi } from '@ai-sdk/typesafe-ai';

const result = await experimental_evaluate({
  model: typeSafeAi.evaluationModel('jev-latest', {
    apiKey: process.env.TYPESAFE_API_KEY
  }),
  state: 'This tweet is about AI ethics',
  questions: [
    {
      type: 'choice' as const,
      id: 'category',
      question: 'What category?',
      options: ['tech', 'policy', 'general']
    },
    {
      type: 'score' as const,
      id: 'confidence',
      question: 'Confidence in classification',
      min: 0,
      max: 1
    }
  ]
});

// result.questions[0].answer === 'tech' (choice)
// result.questions[1].answer === 0.85 (score)
// result.providerMetadata.typesafe.confidence[questionId] available
```

### TypeSafe Jev API Endpoint (Raw Fallback)
If SDK integration fails, use raw fetch:

```typescript
import { z } from 'zod';

const JevRequestSchema = z.object({
  model: z.literal('jev-latest'),
  state: z.string(),
  questions: z.array(z.object({
    id: z.string(),
    type: z.enum(['noul', 'choice', 'score']),
    question: z.string(),
    options: z.array(z.string()).optional(),
    min: z.number().optional(),
    max: z.number().optional()
  }))
});

const JevResponseSchema = z.object({
  answers: z.record(z.union([z.string(), z.number(), z.boolean()])),
  model: z.string(),
  usage: z.object({ tokens: z.number() })
});

async function jev(req: z.infer<typeof JevRequestSchema>) {
  const res = await fetch('https://api.typesafe.ai/v1/systemone', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.TYPESAFE_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(req)
  });
  
  if (!res.ok) throw new Error(`TypeSafe API: ${res.statusText}`);
  return JevResponseSchema.parse(await res.json());
}
```

---

## 4. OpenAI Model IDs (September 2026)

### Current Models Available via API
| Model | Use Case | Retired from ChatGPT | Notes |
|-------|----------|----------------------|-------|
| **gpt-4o** | High-quality drafting + vision | Feb 13, 2026 | Still available via API; cheaper than Turbo |
| **gpt-4-turbo** | Same as gpt-4o but higher performance | — | If cost permits |
| **gpt-4o-mini** or **o4-mini** | Cheap idea expansion, fast | Feb 13, 2026 | Vision support, ~15% cost of gpt-4o |
| **gpt-6-astra** | Latest released Sept 3, 2026 | — | Check if in public API yet (usually 2-4 week delay) |
| **gpt-6-sol, gpt-6-luna** | Latest released Sept 22, 2026 | — | Likely experimental pricing |

### Recommendation for twitter-craft
```typescript
// src/config.ts (configurable)
export const MODEL_CONFIG = {
  DRAFT_MODEL: 'gpt-4o',      // High-quality short-form writing + vision
  EXPAND_MODEL: 'gpt-4o-mini', // Cheap, fast expansion
  ANALYSIS_MODEL: 'gpt-4o'     // Structured analysis (Jev via TypeSafe)
};

// Switch at runtime in settings
const draftModel = chrome.storage.local.get('draftModel') || MODEL_CONFIG.DRAFT_MODEL;
```

### Check Current Availability
```bash
# Before shipping, verify models exist:
curl -H "Authorization: Bearer $OPENAI_API_KEY" \
  https://api.openai.com/v1/models | jq '.data[].id' | grep gpt
```

---

## 5. html-to-image in MV3 Side Panel

### Library: `html-to-image`
```bash
npm install html-to-image
```

```typescript
// sidepanel/DraftExport.tsx
import { toPng, toJpeg } from 'html-to-image';
import { useRef } from 'react';

export function DraftExporter() {
  const ref = useRef<HTMLDivElement>(null);

  const exportPNG = async () => {
    if (!ref.current) return;
    
    const png = await toPng(ref.current, {
      pixelRatio: 2,
      cacheBust: true  // Force re-fetch resources (won't help remote fonts, but ensures cache miss)
    });
    
    // Download as blob
    const blob = await fetch(png).then(r => r.blob());
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'draft.png';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <>
      <div ref={ref} className="draft-content">
        {/* Your draft here */}
      </div>
      <button onClick={exportPNG}>Export as PNG</button>
    </>
  );
}
```

### Font Loading in MV3
**Problem:** html-to-image uses SVG `<foreignObject>` to render DOM into canvas. Google Fonts (remote URLs) will be **blocked by CSP**.

**Solution: Bundle fonts locally**

```typescript
// src/styles/fonts.css
@font-face {
  font-family: 'Inter';
  src: url('/fonts/Inter.woff2') format('woff2');
  font-weight: 400;
}

@font-face {
  font-family: 'Inter';
  src: url('/fonts/Inter-Bold.woff2') format('woff2');
  font-weight: 700;
}

/* Apply globally */
* { font-family: 'Inter', system-ui, -apple-system; }
```

**Alternative: Inline fonts as data URI** (for small fonts)

```css
@font-face {
  font-family: 'CustomFont';
  src: url('data:font/woff2;base64,AAEAAAALAIAAAwBQRF...') format('woff2');
}
```

### MV3 CSP Configuration
Add to `manifest.json` (via `wxt.config.ts`):

```typescript
export default defineConfig({
  manifest: {
    content_security_policy: {
      extension_pages: "default-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https://pbs.twimg.com; font-src 'self';"
    }
  }
});
```

**Key points:**
- No `https://fonts.googleapis.com` in `font-src`
- No `unsafe-inline` in `style-src` (Tailwind v4 may need `@layer` base rules injected)
- `data:` URIs OK for data-embedded fonts
- `pbs.twimg.com` only if exporting images with tweet screenshots

### html-to-image Caveats
1. **SVG-based rendering** → doesn't support complex filters, gradients (mostly OK for drafts)
2. **External images** → URLs must be in `host_permissions` or `data:` URIs
3. **Web fonts** → must be bundled or base64; remote URLs silently fail
4. **Canvas size** → respects `pixelRatio` but very large DOM may timeout (side panel inherently small, so OK)

---

## Summary Table

| Component | Choice | Status | Notes |
|-----------|--------|--------|-------|
| **Framework** | WXT v1.x | ✅ Stable | Weekly updates, production-ready |
| **Content Script → SW Messaging** | chrome.runtime.sendMessage | ✅ Works | Add 500ms delay before side-panel messages |
| **Storage** | `wxt/storage` | ✅ Built-in | Prefer over raw chrome.storage |
| **AI SDK** | Vercel AI SDK v6 | ✅ Works in SW | Fetch-based, watch 30s idle timeout |
| **Structured Output** | `generateText` + `Output.object()` | ✅ Works | No Node APIs needed |
| **TypeSafe Jev** | @ai-sdk/typesafe-ai provider | ✅ Available | Or raw fetch fallback provided |
| **Draft Model** | gpt-4o | ✅ Available | Still in API post-Feb retirement |
| **Cheap Model** | gpt-4o-mini | ✅ Available | Vision support, ~15% cost |
| **Image Export** | html-to-image | ✅ Works | Bundle fonts locally; CSP safe |

---

## Gotchas & Risks

1. **Service Worker Idle Timeout**
   - Risk: Long streams killed after 30s inactivity
   - Mitigation: Use `generateText` not `streamText`; or keep alive with periodic pings

2. **Side Panel Load Race**
   - Risk: Messages sent before side panel JS loads
   - Mitigation: 500ms delay confirmed safe; or use `chrome.runtime.connect` for persistent port

3. **API Key Storage**
   - Risk: Storing in `chrome.storage.local` is not encrypted
   - Mitigation: Require user paste API key in settings; store in extension memory only (lost on reload)
   - Better: Use `chrome.identity.getAuthToken()` + OAuth2 if offering server-side API

4. **Image URL Permissions**
   - Risk: `gpt-4o` downloads images from URLs you pass; need `host_permissions`
   - Mitigation: Already included `pbs.twimg.com` in manifest

5. **Font CSP Blocking**
   - Risk: Remote Google Fonts silently fail in side panel + html-to-image
   - Mitigation: Bundle fonts (already noted); test in incognito mode (CSP stricter)

6. **TypeSafe Model Availability**
   - Risk: "jev-latest" endpoint may change; no public SLA
   - Mitigation: Use raw fetch fallback; monitor API status

---

## Unresolved Questions

1. **GPT-6 models API availability** — Search confirms releases (Astra Sept 3, Sol/Luna Sept 22) but public API timeline unclear. Check `/v1/models` on Sept 25 or later.

2. **@ai-sdk/typesafe-ai exact npm version** — Confirmed merged but specific stable release version not found. Recommend checking npm package directly.

3. **Service worker message quota** — No mention of message count limits in research. Test with high-frequency analytics.

4. **html-to-image + Tailwind v4 `@layer` interaction** — If using Tailwind v4 with custom fonts, `@layer base` rules may need CSP `unsafe-inline` exemption (not confirmed).

5. **TypeSafe API rate limits** — No public docs found; request limits unknown. Monitor for 429 responses.

---

## Sources

- [WXT Framework | wxt.dev](https://wxt.dev/)
- [Chrome Extension Development Setup: The 2026 Starter Guide | DEV Community](https://dev.to/extensionbooster/chrome-extension-development-setup-the-2026-starter-guide-extensionbooster-24h2)
- [WXT Chrome Extension Tutorial (2026): Side Panel to Firefox | R44j](https://r44j.dev/blog/build-chrome-extension-with-wxt-side-panel-content-script-firefox)
- [Chrome Side Panel API Reference | Chrome for Developers](https://developer.chrome.com/docs/extensions/reference/api/sidePanel)
- [Vercel AI SDK v6 Blog Post | Vercel](https://vercel.com/blog/ai-sdk-6)
- [Vercel AI SDK Documentation | vercel.com](https://vercel.com/docs/ai-sdk)
- [Add @ai-sdk/typesafe-ai + experimental_evaluate Provider | GitHub PR #20851](https://github.com/vercel/ai/pull/20851)
- [AI SDK Providers: TypeSafe | ai-sdk.dev](https://ai-sdk.dev/providers/ai-sdk-providers/typesafe-ai)
- [OpenAI Model Release Notes | help.openai.com](https://help.openai.com/en/articles/9624314-model-release-notes)
- [html-to-image | npm](https://www.npmjs.com/package/html-to-image)
- [GitHub: html-to-image Library | bubkoo/html-to-image](https://github.com/bubkoo/html-to-image)
- [Writing a Strict CSP for MV3 | MV3 Extension Dev Hub](https://mv3-extension.com/manifest-v3-architecture-extension-lifecycle/extension-security-csp-hardening/writing-a-strict-content-security-policy-for-mv3/)
- [Using Custom Fonts in Chrome Extensions | Best Chrome Extensions Guide](https://bestchromeextensions.com/2025/03/22/chrome-extension-custom-fonts-loading/)
