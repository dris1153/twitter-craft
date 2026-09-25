---
date: 2026-09-25
type: journal
topic: Phase 4 (card image attached to replies, GIF via X's picker)
---

# Phase 4: card image and GIF

## What happened

- Drafts can now carry an optional card (insight / code / compare), rendered to a 1200 px PNG with html-to-image and pasted into the verified reply dialog. The model can also suggest a GIF search, which opens X's own picker.
- Design choices:
  - Card schema is one flat object with every key required, instead of a union, which suits OpenAI strict mode.
  - The preview is the real PNG rendered from an off-screen node, so preview and attachment cannot drift.
  - A malformed card triggers one retry without the card, so text replies always arrive.
- Review 8/10. Real issues:
  - Card text skipped the planted-link/@handle checks and was auto-attached (High).
  - A failed or hung render could block Insert forever.
  - X allows one image *or* one GIF, and the UI offered both.
  - Fontsource's per-subset CSS has no `unicode-range`, so Vietnamese text on cards relied on luck.
- All fixed:
  - `checkCard` runs on card text, and a card with warnings starts unattached.
  - The render is a pending/ready/failed state tied to the exact card object, behind a pure `cardImageFor`.
  - The render has a 5 s timeout and auto-unticks on failure.
  - `@font-face` is hand-written with `unicode-range`, woff2 only.
  - The GIF button is hidden while a card is attached. 233 tests.

## Lessons

- Every channel that carries model output to the post (reply text, quote, card image) needs the same injection checks; the image was the one nobody thought of.
- Identity-based staleness (compare against the exact object rendered) is simpler and safer than timestamps or counters.
- Heredoc-with-Python edits keep turning `\n` into real newlines; use the editor tool for strings with escapes.

## Open

- Live test: synthetic image paste accepted by X, GIF selectors, Vietnamese glyphs on cards.
