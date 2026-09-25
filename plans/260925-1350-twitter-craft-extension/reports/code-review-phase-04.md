---
type: code-review
phase: 4
date: 2026-09-25
score: 8/10 (before fixes)
---

# Code review: Phase 4 (card image + GIF)

## Summary

No Critical findings. No Post click anywhere. The flat card schema was verified against the SDK's own `zodSchema()`: `card` is `anyOf[object, null]`, every key is required, and there are no tuples. The rendered-card identity check blocks stale images on edit, regenerate and tweet switch.

Before: 224 tests. After: 233 tests. `tsc` clean, build OK.

## Findings and resolution

| # | Finding | Sev | Resolution |
|---|---------|-----|------------|
| H1 | Card text skipped the planted link/@handle checks; the card was auto-attached | High | `checkCard` over all card fields; a card with warnings starts unattached and shows the warnings; tests |
| M1 | A failed or hung render blocked Insert until the user unticked | Med | 5 s render timeout; on failure attach is auto-unticked with a toast; `cardImageFor` never waits on a failed render |
| M2 | Card and GIF are mutually exclusive on X | Med | Prompt: at most one of card/gifQuery; GIF button hidden while the card is attached; `gif_disabled` result when X's button is disabled |
| M3 | Insert-blocking logic untested; schema test too narrow | Med | Pure `cardImageFor` with tests (stale, pending, failed, ready); schema test also rejects `allOf` and array `items` |
| L1/L2 | Copy image / theme switch could use the previous image | Low | Render state `pending/ready/failed` tied to the card object; pending on every edit or theme change |
| L3 | Fonts embedded as woff2 + woff | Low | Own `@font-face` (woff2 only), `preferredFontFormat: 'woff2'` |
| L4 | Fontsource subset CSS lacks `unicode-range` | Low | Hand-written `assets/card-fonts.css` with the subsets' unicode ranges (latin, latin-ext, vietnamese) |
| L5 | Long gifQuery / oversized PNG gave a misleading error | Low | Query capped at 3 words / 60 chars; PNG capped at 3 MB |
| L6 | Malformed base64 threw after the text was typed | Low | `pasteImage` returns false → `image_failed`; test |
| L7 | Add GIF usable while inserting | Low | Disabled while inserting |
| L8 | `@@handle` on the card | Low | Leading `@` stripped |
| L9 | Card shown for skipped drafts | Low | No card/GIF when there are no replies |
| L10 | Card editor trimmed silently | Low | Inline note when lines exceed the limit |
| L11 | Duplicated `waitFor` | Low | `lib/wait-for.ts` |
| L12 | Retry shares the 30 s timeout | Low | Accepted |

## Live checks

- Use the production build (`pnpm build`, load unpacked).
- Card attach on reply and quote: does X accept the synthetic image paste (`attachedMedia` selector)?
- GIF button selector (`gifSearchButton`) and search input; card + GIF together.
- Vietnamese text on a card renders with Inter (no fallback font).
