---
date: 2026-09-25
type: journal
topic: UI redesign to neo-brutalist DESIGN.md + transitions
---

# UI redesign: neo-brutalist theme and motion

## What happened

- Restyle complete: compact brutalist chip badge; light theme + derived dark "charcoal paper" theme; card PNG restyled to design, theme toggle removed. Shadows scaled to −2/−4/−6 px.
- Shared `ui-fonts.css` (18 unicode-range faces) replaces card-fonts.css. Motion tokens and `t-*` classes live in `assets/motion.css`. Most transitions are mount keyframes with `backwards` fill to prevent leftover filter/transform from creating containing blocks; React keys replay them on each state. Stagger uses CSS `sibling-index()` (Chrome 138+). Accordion uses grid-template-rows; editor mounts on first open and re-keys on every open.

## Lessons

- Tailwind v4 `outline-none` + `focus-visible:outline-2` leaves `outline-style: none`, so focus rings vanished. Fixed by dropping `outline-none` from Button and Switch.
- Tailwind v4 `translate-x` uses the `translate` property, so `transition-[transform]` misses it. Need `transition-all` or explicit `transition-[translate]`.
- ResizeObserver recreated on state change snapped tab slide away, because its first callback fires immediately. Moved to ref-based singleton.
- DESIGN.md's muted #818181 fails WCAG AA; moved to #6b6b6b.
- Shimmer `::before` duplicated text for screen readers. Fixed with `content: attr(data-text) / ""`.
- Importing font CSS twice doubled font embeds in html-to-image output.

## Open

- User live test: light/dark on X, visual polish. Commit on request. DESIGN.md is untracked — confirm commit inclusion.
