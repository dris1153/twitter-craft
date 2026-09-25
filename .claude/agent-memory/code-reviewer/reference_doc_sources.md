---
name: reference-doc-sources
description: Where to fetch authoritative docs for twitter-craft plan fact-checks (TypeSafe Jev, OpenAI structured outputs, Chrome MV3 APIs) and which fetch method works
metadata:
  type: reference
---

- TypeSafe Jev docs: index at https://docs.typesafe.ai/llms.txt; every page has a raw `.md` twin (e.g. /api.md, /model-jaggedness/jev-1.13.md, /legal.md). `curl` them directly; faster and exact vs WebFetch summaries.
- Jev 1.13 jaggedness page states state content is NOT treated as hostile; injected text can move answers. ZDR only for enterprise (legal.md).
- OpenAI structured-outputs docs moved to https://developers.openai.com/api/docs/guides/structured-outputs; WebFetch truncates it, use `curl` + grep ("Supported properties"). Arrays: only minItems/maxItems; `prefixItems` (zod tuples) rejected in strict mode.
- AI SDK OpenAI provider: `strictJsonSchema` defaults to true (https://ai-sdk.dev/providers/ai-sdk-providers/openai).
- Chrome: storage.local exposed to content scripts by default, `setAccessLevel` works on local (Chrome 102+). Official side-panel sample: functional-samples/cookbook.sidepanel-open in GoogleChrome/chrome-extensions-samples (open() called first in onMessage).
- Chrome "stay secure" page is the citation for "treat content scripts as compromised; never send secrets to them".
