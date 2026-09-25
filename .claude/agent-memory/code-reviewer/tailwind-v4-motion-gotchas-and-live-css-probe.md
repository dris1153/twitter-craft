---
name: tailwind-v4-motion-gotchas-and-live-css-probe
description: Tailwind v4 focus/translate/transition gotchas found in the 2026-09-25 neo-brutalist redesign review, plus how to live-verify CSS behavior in headless Chrome without puppeteer
metadata:
  type: project
---

Verified in Chrome (built .output CSS) on 2026-09-25 during the UI redesign review:
- `outline-none` + `focus-visible:outline-2` = NO focus ring: v4 `outline-none` sets `--tw-outline-style:none` and `outline-N` uses `outline-style:var(--tw-outline-style)`.
- v4 `translate-x/y-*` set the `translate` property, not `transform`; `transition-[transform,...]` will not tween them.
- A freshly created ResizeObserver fires once on observe() in the same frame; if its callback snaps (transition:none + reflow) it cancels a just-started CSS transition.
- `::before { content: attr(data-text) }` (shimmer text trick) is exposed in Chrome's AX tree, so text is read twice; use `content: attr(x) / ""`.
- `hidden` tab panels (display:none) restart all CSS animations when shown again.

**Why:** CI (happy-dom vitest) cannot catch any of these; they only show in a real browser.

**How to apply:** For CSS/animation claims, probe instead of guessing: Chrome is at `C:/Program Files/Google/Chrome/Application/chrome.exe`, Node 22 has global WebSocket/fetch, so a small .mjs in the scratchpad can launch `--headless=new --remote-debugging-port`, then use CDP `Runtime.evaluate` (awaitPromise) and `Accessibility.getFullAXTree`. `--dump-dom --virtual-time-budget` did NOT fire ResizeObserver. Related: [[html-to-image-fontsource-gotchas]].
