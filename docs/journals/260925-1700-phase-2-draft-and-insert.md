---
date: 2026-09-25
type: journal
topic: Triage calibration from live use + Phase 2 (GPT draft, composer insert)
---

# Calibration and Phase 2

## What happened

- Live use showed no tweet above 50 after ~100 scrolls. There were two causes. Freshness was a penalty: 15 points lost after 12 h, and "For you" posts are mostly older than that. The weighted-mean Jev score also clustered mid-scale. Fixed with convex level weights on the score distribution and freshness as a bonus only.
- A real X capture showed that auto-translated posts carry `lang="vi"`. Draft language would have been Vietnamese for Japanese authors. Added `originalLang`, parsed from "Được dịch từ …", and exact counts from aria-labels.
- The user flagged a prompt-sharing post marked "⚠ bait". Root cause: the bot-instruction question matched any AI instructions, and sharing prompts is normal content. Reworded it with explicit criteria. Added 💡 (`build_idea`) as a separate, never-dimmed signal, because reply priority and "save to TODO" are different goals.
- Phase 2: draft in the side panel via AI SDK 7 (`instructions`, `Output.object`, Responses API). Insert goes through a dialog-scoped, target-verified, focus-checked composer path. The clipboard is written first from the side panel.
- Review (8/10) found the link safety check bypassable by any TLD outside a 16-item list. Also no lock against concurrent inserts, and no focus check before `execCommand`. All fixed and tested. 199 tests.

## Lessons

- Real DOM captures beat research: one pasted `<article>` corrected language handling, count precision and quote structure.
- Subagent tests need auditing. Twice now, placeholder or self-implementing tests appeared, and the key race test was skipped until written by hand.

## Open

- Live checks: `execCommand` with side panel focused, quote-mode editor state, focal-tweet reply behavior, Vietnamese quote menu, multi-line drafts.
