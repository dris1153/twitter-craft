---
phase: 3
title: "Badge on X"
status: completed
priority: P2
effort: "2h"
dependencies: [1]
---

# Phase 3: Badge on X

## Overview
Restyle the Shadow DOM badge (`lib/tweet-badge.ts`) as a compact brutalist chip that reads well on X dark and light.

## Requirements
- Functional: same states (loading, manual, ready, error) and buttons; stopPropagation host unchanged.
- Non-functional: no layout shift in X's action bar area; system mono font stack (bundled fonts would need `web_accessible_resources`, YAGNI); CSS stays inside the shadow root.

## Architecture
- Host row: small gap, wraps.
- Score chip: cream `#f4efea` fill, 1.5px `#383838` border, 2px radius, `-2px 2px 0 #383838` shadow, mono 600 12px ink. Tier fill: ≥70 sky `#6fc2ff`, 40–69 canary `#ffde00`, else cream.
- Meta labels (action, topic, 💡, ?, bait): mono 11px. On X dark the page text color is light, so the labels use X's `color` via `currentColor` with reduced opacity; chips carry their own cream fill so they read on both themes.
- Buttons Draft/Idea: cream fill, ink border, `-2px 2px` shadow, press-into-shadow on `:active`.
- Error chip: coral fill. Manual "not scored" chip: outline only.
- Font stack: `ui-monospace, SFMono-Regular, Menlo, Consolas, "JetBrains Mono", monospace`.

## Related Code Files
- Modify: `lib/tweet-badge.ts` (STYLE block + class names only)
- Modify: `tests/tweet-badge.test.ts` only if class names asserted (currently `.pill`, `.err`); keep those classes.

## Implementation Steps
1. Rewrite the STYLE string with the tokens above (literal hex; shadow DOM can't read panel CSS).
2. Keep class names used by tests (`pill`, `err`), add tier classes.
3. Build, load on x.com dark and light, check wrap and overlap with the action bar.

## Success Criteria
- [ ] Badge readable and consistent on X dark and light.
- [ ] No overlap or shift of X's buttons; tests green.

## Risk Assessment
- Cream chips may feel loud on dark feeds → shadow and size stay small (`-2px`); tune fill to `#f4efea` at full opacity only for the score chip.
