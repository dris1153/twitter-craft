---
date: 2026-09-25
type: journal
topic: Reply tone fix from live feedback + Phase 3 (ideas/TODO, Markdown export)
---

# Reply tone and Phase 3

## What happened

- Live test of Phase 2: insert-as-reply works, but drafts read like AI lectures, e.g. a 200-char analysis replying to "morphing dropdown ✨". Cause: the prompt demanded "one concrete thing (number, mechanism…)", and the angles were insight/practical. Rewrote it: match the post's length, say one thing, casual; banned AI tells; added a bad-vs-good tone example; angles are now reaction/question/take. The Quote button only appeared when the model proposed a quote, so every draft now gets Reply + Quote.
- Phase 3: Idea button → GPT (idea model, Vietnamese notes by default) turns the post into title/problem/insight/MVP steps/stack/promo/tags → edit → Save to TODO. The list has status, inline autosave and a Markdown export. Video posters now reach the vision model, so video-only posts work.
- Review 7.5/10. The Markdown export survived about 30 hostile payloads. The real bugs were elsewhere: a host-level project allowlist (github.com/me/proj vouched for github.com/evil), unsaved idea edits lost on tab switch, and a stale-edit save when re-capturing the same tweet. All fixed, with tests.

## Lessons

- Prompt rules that sound like quality ("add one concrete thing") produced exactly the AI voice the user hates. For social replies, length and register matter more than information density.
- Allowlists on shared hosts (github.com, x.com) must match by URL prefix, not host.
- Keep in-progress edit state in the hook that owns the flow, not in a card that may unmount or be reused.

## Open

- Live test Phase 3 (capture, save, edit, export in a Markdown viewer). Phase 4 (card PNG + GIF) next.
