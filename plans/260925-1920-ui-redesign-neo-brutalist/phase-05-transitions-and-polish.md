---
phase: 5
title: "Transitions + polish"
status: completed
priority: P2
effort: "4h"
dependencies: [2, 3, 4]
---

# Phase 5: Transitions + polish

## Overview
Add motion from transitions-dev where it clarifies state, then run a transitions-polish pass so every value maps to the motion tokens.

## Requirements
- Functional: motion never blocks interaction; no motion on elements that re-render often (badge list) beyond a one-time pop.
- Non-functional: every animation uses `var(--duration-*)` / `var(--ease-*)`; `prefers-reduced-motion` guard on each; no layout thrash (transform/opacity/filter only, grid-rows for accordion).

## Architecture (skill references: `~/.claude/skills/transitions-dev/NN-*.md`)

| UI | Transition | Ref |
|---|---|---|
| Header tabs, Ideas filter | Tabs sliding indicator (sky block slides) | 16-tabs-sliding |
| "Drafting…", "Turning into idea…", "Rendering card…" | Shimmer / thinking text | 15-shimmer-text, 28-thinking-states |
| 3 variants + quote appear | Texts reveal, 40 ms stagger | 18-texts-reveal |
| Toast | Toast open/close (slower in, faster out) | 22-toast |
| Idea row expand | Accordion (grid-rows) | 21-accordion |
| Card preview render | Skeleton → reveal | 14-skeleton-reveal |
| "Insert anyway", "Delete for good", "Discard edits and regenerate" | Text states swap | 04-text-states-swap |
| Attach checkbox; Settings switches | Checkbox check; Toggle | 25-checkbox-check, 27-toggle |
| Settings save invalid | Error state shake | 12-error-state-shake |
| Badge score appears (X) | Number pop-in (one-shot); loading shimmer | 02-number-pop-in, 15-shimmer-text |
| Buttons | Press into shadow: `transform, box-shadow` `var(--duration-quick) var(--ease-smooth-out)` | (phase 1) |

- Hard-shadow system: motion is translation plus shadow collapse, no blur-heavy effects on the brutalist surfaces. Keep blur only where the transition defines it (text swap, reveal) at `--blur-small`.
- Badge (shadow DOM): inline literal values from the transition snippets (tokens don't cross into the shadow root), same numbers as the tokens.

## Related Code Files
- Modify: `assets/motion.css` (transition classes `t-*`), `entrypoints/sidepanel/app.tsx`, `components/draft-view.tsx`, `components/draft-variant-editor.tsx`, `components/card-panel.tsx`, `components/ideas-view.tsx`, `components/idea-row.tsx`, `components/settings-view.tsx`, `components/ui/switch.tsx`, `lib/tweet-badge.ts`

## Implementation Steps
1. Load `transitions-dev` skill; for each row, read the referenced snippet and adapt it (keep `t-*` naming and the reduced-motion guard).
2. Wire hooks (data attributes / state classes) in the components.
3. Load `transitions-polish` skill; run its review over the project and apply the token mappings it confirms (usage-based, not nearest-number).
4. Compile, test, build; manual pass in light/dark with OS reduced-motion on and off.

## Success Criteria
- [ ] Every listed interaction animates per its token; reduced-motion disables all.
- [ ] transitions-polish review reports no remaining ad-hoc values (or only "no matching token usage").
- [ ] Scrolling X feed stays smooth (badge animates once per tweet).

## Risk Assessment
- Too much motion in a small panel → keep to the table; no hover animations on list rows beyond press.
- Accordion with autosizing textareas → animate the wrapper only.
