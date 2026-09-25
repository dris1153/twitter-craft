---
title: "UI redesign: neo-brutalist tokens + motion polish"
description: "Restyle side panel, X badge and reply card PNG per DESIGN.md (light + derived dark), then add token-based transitions from transitions.dev."
status: completed
priority: P2
effort: 2d
branch: master
tags: [frontend, refactor]
blockedBy: []
blocks: []
created: 2026-09-25
completed: 2026-09-25
---

# UI redesign: neo-brutalist tokens + motion polish

## Overview

Apply `DESIGN.md` to the extension: cream paper canvas, charcoal ink, sky-blue primary, 2px radius, hard offset shadows (scaled by size), JetBrains Mono UI. Add a derived dark "charcoal paper" theme, restyle the X badge as a compact brutalist chip, restyle the reply card PNG, and add motion from transitions-dev, then polish it with transitions-polish.

Source: [brainstorm report](../reports/260925-1920-brainstorm-ui-redesign-neo-brutalist.md) · [DESIGN.md](../../DESIGN.md)

## Phases

| Phase | Name | Status | Effort |
|-------|------|--------|--------|
| 1 | [Tokens, fonts, primitives](./phase-01-tokens-fonts-and-primitives.md) | Completed | 3h |
| 2 | [Side panel screens](./phase-02-side-panel-screens.md) | Completed | 4h |
| 3 | [Badge on X](./phase-03-badge-on-x.md) | Completed | 2h |
| 4 | [Reply card PNG](./phase-04-reply-card-png.md) | Completed | 2h |
| 5 | [Transitions + polish](./phase-05-transitions-and-polish.md) | Completed | 4h |

Sequential; 3 and 4 only depend on 1.

## Key rules (from DESIGN.md + decisions)

- Radius 2px everywhere. No gradients. No blurred shadows.
- Shadow scale: `--shadow-sm: -2px 2px 0 0 var(--ink)`, `--shadow-md: -4px 4px 0 0`, `--shadow-lg: -6px 6px 0 0`. Buttons press into the shadow on `:active`.
- Sky `#6fc2ff` is the only filled action color. The rainbow palette is used only as accents (angle stripes, status chips).
- JetBrains Mono for UI; Inter only for tweet text (third-party content).
- No MotherDuck mascot, logo or name.
- Every animation reads motion tokens and has a `prefers-reduced-motion` guard.

## Success Criteria

- [x] No stray colors, radii or blur shadows left (grep for `rounded-md|rounded-lg|shadow-|gradient` outside tokens).
- [x] `pnpm compile`, `pnpm test` (245/245), `pnpm build` green.
- [x] Every animation uses motion tokens with `prefers-reduced-motion` guards.
- [x] WCAG AA contrast achieved in light and dark themes.
- [ ] Light and dark both look intentional (needs live check).
- [ ] Badge readable on X dark and light (needs live check).
- [ ] Card PNG matches DESIGN.md in all three kinds (needs live check).
- [ ] X feed scrolling stays smooth (needs live check).

## Deviations

- **Token values for AA**: `--ink-muted` is `#6b6b6b` (not `#818181`) and `--danger` is `#c0392b` (not `#d9534f`), to meet WCAG AA contrast on light paper. These differ from DESIGN.md but are necessary for accessibility.
- **Layout wrapping**: Ideas filter bar and header tabs wrap at narrow panel widths instead of scrolling, to stay compact and keep labels visible.

---

**Status:** COMPLETED

**Summary:** All 5 phases implemented. Code review findings #1–9, #11–15 fixed; #10 (toast replay on tab switch) deliberately accepted as pre-existing behavior. Tests pass (245/245). Tokens, fonts, side panel screens, badge on X, card PNG, and motion transitions all complete per spec. Ready for live visual verification in light/dark themes and cross-browser testing.
