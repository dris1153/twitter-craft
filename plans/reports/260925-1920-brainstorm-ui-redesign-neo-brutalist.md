---
type: brainstorm-report
date: 2026-09-25
status: approved
---

# Brainstorm: UI redesign per DESIGN.md + transitions

## Problem

Restyle the whole extension UI (side panel, badge on X, reply card PNG) to follow `DESIGN.md`, a neo-brutalist "crayon-coded terminal on cream paper" style reference. Make it look polished and premium, and add or polish motion with the transitions-dev / transitions-polish skills.

## Decisions (user)

| Topic | Decision |
|---|---|
| Badge on X | Compact brutalist chip: cream, charcoal border, `-2px 2px` hard shadow, mono |
| Side panel theme | Light per DESIGN.md + derived dark "charcoal paper" |
| Reply card PNG | Restyle per DESIGN.md (drop gradients and the dark/light toggle) |
| Shadow density | Scaled: small `-2px 2px`, primary/cards `-4px 4px`, hero frames `-6px 6px` |

## Guardrails

- Use the style (tokens, type, shapes) only. No MotherDuck mascot, logo or name.
- Aeonik Mono (commercial) is replaced by JetBrains Mono (bundled); Inter is used for third-party text (tweet content).
- "Premium" comes from restraint: cream/charcoal/sky as the core, rainbow palette as accents only, hard shadows on primary actions and cards.
- No gradients, no blur shadows, radius 2px everywhere.

## Approach (chosen: A)

- **A:** tokens in Tailwind `@theme`, restyled shadcn primitives, then per-screen polish. Screens inherit, least duplication.
- **B:** custom components, dropping shadcn. Rejected: double the work.
- **C:** recolor only. Rejected: does not reach the polished look.

## Design

1. **Tokens:**
   - Light: `#f4efea` canvas, `#fff` surface, `#383838` ink/border/shadow, `#6fc2ff` primary, 2px radius.
   - Dark (derived): canvas `#1c1b1a`, surface `#262422`, ink `#f1ece6`, shadow in ink color (dimmed).
   - Type: JetBrains Mono 400/500/600 with 0.02em tracking; Inter for tweet text.
   - Motion tokens from transitions.dev `_root.css`.
2. **Accents:**
   - Draft angle stripe: reaction coral, question periwinkle, take mint.
   - Idea status chips: new sky, reviewing marigold, doing mint, dropped slate.
   - Score tiers: ≥70 sky, 40–69 canary, low chalk.
3. **Side panel:**
   - White header with sliding segmented tabs.
   - Draft: tweet "embed" frame, variant cards, primary Reply (sky) + outlined Quote.
   - Card preview in a screenshot frame.
   - Ideas: segmented filter, accordion rows.
   - Settings: sectioned cards; inputs focus by border color, no glow.
4. **Badge on X:** Shadow DOM chip with a system mono stack. Bundled fonts would need `web_accessible_resources`; YAGNI.
5. **Card PNG:** white card on cream, 2px charcoal border, `-6px 6px` shadow, mono, canary kind tag (TL;DR / CODE / VS).
6. **Motion:**
   - Tabs sliding (tabs, idea filter).
   - Shimmer/thinking text (drafting, idea expanding).
   - Texts reveal with 40 ms stagger (variants).
   - Toast.
   - Accordion (idea rows).
   - Skeleton reveal (card render).
   - Text swap (confirm buttons).
   - Checkbox/toggle.
   - Error shake (settings save error).
   - Number pop-in + shimmer (badge score).
   - Button press into shadow (150 ms smooth-out).
   - All with `prefers-reduced-motion`. Finish with a transitions-polish pass.

## Risks

- Mono for long draft/idea text is slightly less readable → line-height 1.6.
- Dark theme is our own extrapolation → user review.
- Badge motion must stay light while the feed scrolls.

## Success

- Every screen follows the tokens (no stray colors, radii or blur shadows); light and dark both look intentional.
- Badge readable on X dark and light, no layout breakage.
- Card PNG matches DESIGN.md.
- Motion consistent with tokens; reduced-motion respected.
- Tests and build still green.
