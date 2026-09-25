---
phase: 4
title: "Card PNG + GIF suggestion"
status: pending
priority: P3
effort: "1d"
dependencies: [2]
---

# Phase 4: Card PNG + GIF suggestion

## Context Links

- [Phase 1 spike c](./phase-01-scaffold-settings-parser-jev-triage.md) (image paste result)
- [Research: WXT + AI SDK](./research/researcher-01-wxt-ai-sdk-mv3-report.md) §5 (html-to-image, fonts, CSP)
- [Research: X DOM + composer](./research/researcher-02-x-dom-composer-report.md) §5-6

## Overview

Drafts can include a card image (insight / code / compare) rendered from React templates to PNG and pasted into the composer with the text. GPT can also suggest a GIF keyword; a button opens X's own GIF picker with that query.

## Key Insights

- `html-to-image` `toBlob(node, { pixelRatio: 2 })` in side panel. Fonts must be bundled (`public/fonts/*.woff2`); remote fonts fail under extension CSP.
- [RT#5] OpenAI strict mode (AI SDK default) rejects tuples (`prefixItems`). Card schema uses objects/arrays only; length limits via prompt + trimming, not zod refinements. Card is validated separately (lenient `safeParse`) so a bad card never fails the text replies.
- Image attach = synthetic `paste` event with `DataTransfer.items.add(File)` on the DIALOG-scoped composer (phase 2 `insertInDialog`, spike c result).
- [RT#3] Content script can't write the clipboard (x.com unfocused). Fallback = side panel `Copy image` button (own user gesture, doesn't overwrite the text copied on Insert): `navigator.clipboard.write([new ClipboardItem({'image/png': blob})])`. PNG rendered as soon as "attach card" is on, so the button is instant.
- Blob can't cross `tabs.sendMessage` → send data URL, rebuild `File` in content script.
- No Giphy/Tenor key: open X's GIF picker, type query with `execCommand('insertText')` into its search input. Selector unverified (`gifSearchButton` vs `gifButton`) → verify live, keep in `x-dom-selectors.ts`.
- Card is optional: model returns `card: null` when a card adds nothing. Most replies should be text only.

## Requirements

Functional:
- `CardSpecSchema` discriminated union on `kind` [RT#5]:
  - `insight { kind, title, bullets: z.array(z.string()).max(4) }`
  - `code { kind, title, lang, code: z.string() }` — "≤15 lines" enforced by prompt, trimmed after generation
  - `compare { kind, title, columns: z.object({ a, b }), rows: z.array(z.object({ label, a, b })).max(5) }`
- `DraftSchema.card` in the model call = `CardSpecSchema.nullable()`; if the whole call fails schema validation with a card-related error, retry once with `card: z.null()` so text drafts still arrive.
- Draft view shows card preview under the chosen variant, toggle "attach card", editable fields, light/dark theme toggle.
- `Insert` sends text + optional PNG. `GIF: <query>` chip → opens GIF picker with query prefilled (after composer open).
- Card footer shows user handle (from settings) for branding.

Non-functional: PNG ≤ 1MB, 1200px wide at pixelRatio 2; render ≤ 1s. Files < 200 lines each.

## Architecture

```
DraftSchema.card (phase 2 placeholder → CardSpecSchema) + gifQuery
draft-view ─► card-preview.tsx ─► insight-card | code-card | compare-card
Insert ─► card-to-png.ts toBlob → dataURL ─► tabs.sendMessage insert-draft {text, imageDataUrl?, gifQuery?}
content x-composer: open composer → insertText → pasteImage(File) → (optional) openGifPicker(query)
```

Code highlighting: plain monospace with minimal token coloring is enough; add `shiki` only if cards look bad (YAGNI).
Cards styled with Tailwind (same setup as side panel); `html-to-image` inlines computed styles, so utility classes render correctly in the PNG.

## Related Code Files

Create:
- `components/cards/insight-card.tsx`, `components/cards/code-card.tsx`, `components/cards/compare-card.tsx`
- `components/card-preview.tsx`
- `lib/card-to-png.ts`
- `public/fonts/` (Inter + JetBrains Mono woff2, OFL license files)

Modify:
- `lib/types.ts` (CardSpecSchema, DraftSchema.card)
- `lib/draft-prompt.ts` (when to propose a card/GIF; card text limits)
- `lib/draft-generator.ts` (retry once without card on card-schema failure)
- `tests/draft-schema.test.ts` (create: no unsupported JSON-schema keywords)
- `lib/x-composer.ts` (`pasteImage`, `openGifPicker`)
- `lib/x-dom-selectors.ts` (GIF button, GIF search input, attached media preview)
- `components/draft-view.tsx`
- `lib/messages.ts` (`insert-draft` payload)

## Implementation Steps

1. Card schema + prompt rules (card only when it clarifies: code, comparison, 3-4 crisp takeaways). Unit test: convert `DraftSchema` to JSON schema (same conversion the SDK uses) and assert no `prefixItems`, no array-form `items`, no `allOf`. One live smoke call.
2. Three card components with bundled fonts, fixed 600px width, theme prop. Trim bullets/code/rows to limits before render.
3. `card-to-png.ts` (`toBlob`, size check, data URL). Render on toggle; cache blob in draft state.
4. `x-composer.pasteImage(dataUrl)` inside the verified dialog: build `File`, dispatch paste, wait for media preview in that dialog; return `image_failed` on timeout → side panel toast points to `Copy image` button.
5. `openGifPicker(query)`: click GIF button inside composer, wait search input, insert query.
6. Manual tests: card attach on reply + quote; GIF picker prefill; fallback path when paste blocked. Compile + tests.

## Todo List

- [ ] CardSpec schema + prompt rules
- [ ] 3 card templates + fonts
- [ ] card-to-png
- [ ] pasteImage + fallback
- [ ] GIF picker prefill
- [ ] Manual tests + compile + tests

## Success Criteria

- [ ] Reply with card: text + image attached, Post enabled, nothing auto-posted.
- [ ] Card renders same in preview and PNG (fonts correct).
- [ ] GIF chip opens picker with query typed.
- [ ] Paste blocked → `Copy image` in side panel + Ctrl+V works; text copied on Insert is not overwritten.
- [ ] Draft with no card and draft with malformed card both still return text replies.

## Risk Assessment

- X ignores synthetic image paste → `Copy image` fallback in side panel (1 extra click + Ctrl+V).
- Card schema breaks drafting → object-only schema, JSON-schema unit test, retry without card.
- GIF picker selectors change → chip degrades to "copy query" only.
- Cards look templated/spammy if overused → prompt limits cards to cases where they add clarity; toggle defaults off unless model proposes one.

## Security Considerations

- Card text is model output → rendered as React text nodes, no `dangerouslySetInnerHTML`.
- Bundled fonts only; no remote resource loads in extension pages.

## Next Steps

Later (not planned): track which replies gained followers, crawl lists/search, backend sync.
