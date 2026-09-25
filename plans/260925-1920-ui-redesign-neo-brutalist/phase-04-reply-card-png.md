---
phase: 4
title: "Reply card PNG"
status: completed
priority: P2
effort: "2h"
dependencies: [1]
---

# Phase 4: Reply card PNG

## Overview
Restyle the attached card (`components/share-card.tsx`) per DESIGN.md and remove the dark/light theme toggle.

## Requirements
- Functional: same 3 kinds, same data, same rendering pipeline (`renderCardPng`); preview still the real PNG.
- Non-functional: 600 px logical width → 1200 px PNG; fonts bundled (JetBrains Mono + Inter already in `assets/card-fonts.css`; add JetBrains Mono 500/600 + vietnamese); PNG < 1 MB.

## Architecture
- Outer canvas: cream `#f4efea`, padding 24 px so the hard shadow is inside the PNG.
- Card: white, 2px `#383838` border, 2px radius, `-6px 6px 0 #383838` shadow, padding 32.
- Kind tag top-left (Yellow Status Badge): canary fill, 1px ink border, mono 600 11px uppercase → `TL;DR` (insight), `CODE` (code), `VS` (compare).
- Title: mono 600 24px ink, tracking 0.02em.
- **Insight:** bullets with 10px square sky markers, mono 400 18px, line-height 1.4.
- **Code:** chalk `#f8f8f7` block, 1.5px ink border, mono 16px, language as a small outline chip.
- **Compare:** 3-column grid with 1.5px ink rules; header cells sky wash `#ebf9ff`, mono 600.
- Footer: `@handle` mono 13px muted `#818181`, top rule 1px ink.
- Card panel: drop the theme toggle and `CardTheme`.

## Related Code Files
- Modify: `components/share-card.tsx`, `components/card-panel.tsx`, `assets/card-fonts.css`
- Tests: none reference theme; `card-attach` tests unchanged.

## Implementation Steps
1. Update card fonts (JetBrains Mono 400/500/600 incl. vietnamese).
2. Rewrite `ShareCard` layout/styles.
3. Remove theme state/toggle from `CardPanel`.
4. Build, render each kind (incl. Vietnamese text), check PNG size.

## Success Criteria
- [ ] All three kinds render per DESIGN.md; Vietnamese glyphs in JetBrains Mono.
- [ ] Hard shadow visible inside the PNG bounds; PNG < 1 MB.

## Risk Assessment
- html-to-image and box-shadow outside the node bounds → the shadow is inside the padded outer canvas node, which is the captured node.
