---
phase: 2
title: "Side panel screens"
status: completed
priority: P1
effort: "4h"
dependencies: [1]
---

# Phase 2: Side panel screens

## Overview
Recompose each side-panel screen with the new tokens so it reads as one intentional system: header + segmented tabs, Draft, Ideas, Settings, card panel.

## Requirements
- Functional: no behavior changes; same buttons and flows.
- Non-functional: files < 200 lines; only token utilities (no raw hex in components except the accent map); 400 px panel width looks balanced.

## Architecture
- **Header (`entrypoints/sidepanel/app.tsx`):** surface bar, 2px ink bottom border, wordmark "twitter-craft" mono 600 13px. Segmented tabs: 2px ink border group with the active segment = sky fill (sliding indicator added in phase 5).
- **Shared bits (`components/panel-card.tsx`, new, small):** `PanelCard` = surface + 2px ink border + `shadow-md` + padding 16; optional `accent` prop → 4px top stripe in an accent color. `Chip` = 2px radius, 1px ink border, mono 600 11px uppercase, optional fill (for status/score tags). Used by Draft, Ideas, Settings.
- **Draft (`draft-view.tsx`, `draft-variant-editor.tsx`):**
  - Source tweet in an "embed" frame: surface, 1.5px ink border, no shadow, Inter for the tweet text, handle in muted ink.
  - Variant = `PanelCard` with angle stripe (reaction coral, question periwinkle, take mint) + angle Chip.
  - Buttons: Reply = default (sky), Quote = outline, Copy/Save sample = ghost.
  - Char counter mono 11px; warnings as a canary callout (ink border).
  - Queued banner / regenerate confirm use the destructive/outline styles.
  - Toast: surface bar, 2px ink top border, mono 12px.
- **Card panel (`card-panel.tsx`, `card-editor.tsx`):** preview inside a "screenshot frame" (2px ink border, `shadow-lg`), controls as sm buttons; attach checkbox styled (square, ink border, sky check).
- **Ideas (`ideas-view.tsx`, `idea-row.tsx`, `idea-editor.tsx`):**
  - Filter as a segmented group with counts.
  - Rows are `PanelCard`s with a status Chip (new sky, reviewing marigold, doing mint, dropped slate); dropped rows get muted ink.
  - Capture card has a canary top stripe.
- **Settings (`settings-view.tsx`):** each section a `PanelCard` with an uppercase mono section title; sticky save bar as surface + ink top border; status text swaps to success/error colors.
- **Empty states:** one mono line + muted hint (e.g. "Click Draft on a tweet badge"), no illustrations (no MotherDuck ducks).

## Related Code Files
- Create: `components/panel-card.tsx`
- Modify: `entrypoints/sidepanel/app.tsx`, `components/draft-view.tsx`, `components/draft-variant-editor.tsx`, `components/card-panel.tsx`, `components/card-editor.tsx`, `components/ideas-view.tsx`, `components/idea-row.tsx`, `components/idea-editor.tsx`, `components/settings-view.tsx`

## Implementation Steps
1. `PanelCard` + `Chip`.
2. Header + tabs.
3. Draft + variant editor + toast.
4. Card panel + editor.
5. Ideas (filter, rows, capture card, editor).
6. Settings (sections, save bar).
7. Grep for leftover `rounded-md|rounded-lg|shadow-(xs|sm|md|lg)|bg-muted/50|text-muted-foreground` and replace with token utilities.
8. Compile, test, build; screenshots light/dark for each tab.

## Success Criteria
- [ ] All three tabs match DESIGN.md in light and dark.
- [ ] Accent colors appear only as stripes/chips; sky is the only filled action.
- [ ] Existing tests pass unchanged (DOM queries use roles/text, not classes).

## Risk Assessment
- Visual regressions in tests that query class names → none currently; keep text labels stable.
