---
date: 2026-09-25
type: journal
topic: twitter-craft brainstorm and implementation plan
---

# twitter-craft: brainstorm and plan

## Context

Greenfield Chrome extension for x.com that triages tech/AI tweets, drafts replies/quotes (with card images or GIF suggestions), and captures build-worthy ideas into a TODO list. No code written yet.

## What happened

- Brainstorm settled the product shape: AI drafts, the user always clicks Post; passive triage of tweets already on screen; no backend.
- User asked to evaluate TypeSafe Jev (System One model, launched 2026-09-15). It fits as the triage gate: typed answers + confidence, ~$0.042/1M input tokens, ~100ms, questions evaluated in parallel. GPT (via Vercel AI SDK, default `gpt-5.6-terra`) only runs when the user clicks Draft/Idea.
- Hard-mode plan: 2 researchers, 4 phases, 3 red-team reviewers, validation interview.
- Red team found 15 issues, all applied. The critical one: `tweetTextarea_0` also exists outside the reply modal (home "What's happening", status-page inline reply), so an unscoped lookup would insert a reply into the wrong composer and could publish it as a standalone post.

## Reflection

- Both researcher reports contained confident but wrong claims: Jev request shape (array questions, `min/max`), non-existent `gpt-6-*` model ids, quote tweets as nested `article`, "Show more" as a link. Red-team fact-checking against official docs caught all of them. Research output needs verification before it shapes a plan.
- Several fallbacks looked fine on paper but could never work: clipboard writes from an unfocused content script, `storage.session` from a content script, `sidePanel.open()` after an `await`. Tracing each flow across contexts (content / SW / side panel) was what exposed them.

## Decisions

- Jev triage in background SW; GPT calls in side panel (no SW lifetime limits).
- Keys in `storage.local` with `TRUSTED_CONTEXTS`; content-script messages treated as hostile.
- Insert is dialog-scoped and target-verified; side panel writes clipboard fallback before every Insert.
- Drafts only in languages the user reads (en/vi); others fall back to English.
- X UI is Vietnamese → locale-agnostic selectors plus a small vi/en keyword table.
- WXT + React + Tailwind v4 + shadcn/ui, Chrome only.

## Next

- Phase 1 spike (Jev in SW, side panel gesture, real end-to-end composer insert, model ids, storage access level).
- Plan: `plans/260925-1350-twitter-craft-extension/plan.md`.
