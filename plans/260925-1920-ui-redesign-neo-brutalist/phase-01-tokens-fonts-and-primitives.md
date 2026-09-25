---
phase: 1
title: "Tokens, fonts, primitives"
status: completed
priority: P1
effort: "3h"
dependencies: []
---

# Phase 1: Tokens, fonts, primitives

## Overview
Replace the shadcn neutral theme with DESIGN.md tokens (light + derived dark), load the fonts, add motion tokens, and restyle the shadcn primitives. Screens then inherit most of the look.

## Requirements
- Functional: every side-panel surface reads semantic tokens (`--bg`, `--surface`, `--ink`, `--muted-ink`, `--primary`, `--shadow-*`), with no hardcoded colors in components.
- Non-functional: WCAG AA text contrast in both themes; fonts bundled locally (MV3 CSP).

## Architecture
`assets/tailwind.css`:
- `:root` = light, `@media (prefers-color-scheme: dark)` = dark.
- Map to Tailwind via `@theme inline` so utilities like `bg-surface`, `text-ink`, `border-ink`, `shadow-brut-md` work.
- Keep the shadcn variable names (`--background`, `--primary`, …) pointing at the new tokens, so the generated components keep working.

| Token | Light | Dark (derived) |
|---|---|---|
| canvas `--background` | `#f4efea` | `#1c1b1a` |
| surface `--card` | `#ffffff` | `#262422` |
| subtle `--muted` | `#f8f8f7` | `#2e2c29` |
| ink `--foreground`, border, shadow | `#383838` | `#f1ece6` (shadow `#bdb7b0`) |
| muted ink | `#818181` | `#a39e98` |
| primary | `#6fc2ff` on ink text | `#6fc2ff` on `#1c1b1a` text |
| primary wash | `#ebf9ff` | `#1f3140` |
| highlight | `#ffde00` | `#ffde00` |
| destructive | `#d9534f` | `#f38e84` |

- Accents: coral `#f38e84`, periwinkle `#7597ee`, mint `#38c1b0`, marigold `#e1c427`, slate `#84a6bc`, lilac `#b291de`.
- Fonts: JetBrains Mono 400/500/600 (latin, latin-ext, vietnamese) as body `--font-mono`; Inter 400/600 as `--font-sans` for tweet text. Hand-written `@font-face` with `unicode-range` in `assets/ui-fonts.css` (same pattern as `assets/card-fonts.css`; reuse and merge if simpler). Tracking 0.02em.
- Motion tokens: copy the `:root` motion block from `~/.claude/skills/transitions-polish/_root.css` (durations, easings, distances, scales, blur) into `assets/motion.css`.

Primitives (`components/ui/*`):
- **Button:**
  - Variants: `default` = sky fill + ink border + `shadow-md`; `outline` = surface fill + ink border + `shadow-md`; `ghost` = no border/shadow, hover `bg-muted`; `destructive` = coral-ish fill + ink border.
  - Sizes: `xs`/`sm` use `shadow-sm`; `default`/`lg` use `shadow-md`.
  - `:active` → `translate(-2px, 2px)` / `(-4px, 4px)` with the shadow reduced to 0 ("press into shadow"). Transition `transform, box-shadow var(--duration-quick) var(--ease-smooth-out)`.
  - Radius 2px, font mono 500, uppercase optional (not forced; labels stay sentence case for readability).
- **Input/Textarea:** surface fill, 2px ink border, radius 2px, no ring glow; `:focus-visible` → border `--primary` + `shadow-sm` in primary.
- **Switch:** square-ish track (2px radius), ink border, sky when on.
- **Label:** mono 500 12px, muted ink.
- Global base: body mono 14/1.6, `::selection` canary, keep the cursor-pointer rules.

## Related Code Files
- Modify: `assets/tailwind.css`, `components/ui/button.tsx`, `components/ui/input.tsx`, `components/ui/textarea.tsx`, `components/ui/switch.tsx`, `components/ui/label.tsx`, `entrypoints/sidepanel/main.tsx`
- Create: `assets/ui-fonts.css` (or merge into `card-fonts.css`), `assets/motion.css`

## Implementation Steps
1. Write tokens (light/dark) + `@theme inline` mapping + shadow utilities.
2. Fonts: `@font-face` for JetBrains Mono 400/500/600 + Inter 400/600 (woff2, unicode-range).
3. Motion tokens file; import both in `main.tsx`.
4. Restyle the 5 primitives; keep their APIs unchanged.
5. `pnpm compile && pnpm test && pnpm build`; load and screenshot the side panel in light and dark.

## Success Criteria
- [ ] Side panel renders in cream/ink (light) and charcoal paper (dark) with no component code changes yet.
- [ ] Buttons press into their shadow; inputs focus with a sky border, no glow.
- [ ] Contrast AA for body text and muted text in both themes.

## Risk Assessment
- Dark theme is our extrapolation → screenshot both, adjust tokens only.
- Mono at 14px for long text → line-height 1.6; revisit in phase 2 if cramped.
