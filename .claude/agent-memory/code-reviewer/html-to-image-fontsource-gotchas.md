---
name: html-to-image-fontsource-gotchas
description: twitter-craft card PNG stack (html-to-image 1.11.13 + @fontsource 5.3 subset CSS) has silent-failure and hang behaviors CI cannot show; plus X's GIF/photo exclusivity
metadata:
  type: project
---

Verified in node_modules on 2026-09-25 (phase 4 review):
- html-to-image `resourceToDataURL` swallows fetch errors and caches `''` per font filename forever, so `getFontEmbedCSS` almost never rejects; a failed font fetch silently renders fallback fonts for the panel's lifetime.
- html-to-image `createImage` does `img.onload -> img.decode().then(rAF(resolve))` with no catch: a decode rejection (or a hidden panel pausing rAF) leaves `toBlob` pending forever. Any UI that waits on a render needs its own timeout.
- Without `preferredFontFormat: 'woff2'`, both woff2 and woff URLs of every @font-face are inlined (about 2x the base64 per render).
- `@fontsource/*/latin-400.css`-style subset files have NO `unicode-range`; same-descriptor faces overlap, relying on Chrome's composite-face per-glyph fallback.
- X allows photos OR one GIF per post: an attached card image disables X's GIF button, so a GIF flow must not run after a card attach.

**Why:** unit tests run in happy-dom and never execute html-to-image or live X, so these only surface in live tests.

**How to apply:** when reviewing card/PNG or composer-media code here, check for a render timeout, woff2-only embedding, and card+GIF exclusivity. Related: [[project-research-reports-unreliable]], [[host-level-link-allowlists]] (card text also bypasses checkDraft link warnings).
