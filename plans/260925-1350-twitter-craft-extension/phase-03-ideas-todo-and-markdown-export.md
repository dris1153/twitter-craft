---
phase: 3
title: "Ideas/TODO + Markdown export"
status: pending
priority: P2
effort: "0.5d"
dependencies: [2]
---

# Phase 3: Ideas/TODO + Markdown export

## Context Links

- [Phase 2](./phase-02-gpt-draft-and-composer-insert.md) (pendingAction flow, `ai-models.ts`)
- [Brainstorm report](../reports/260925-1344-brainstorm-twitter-craft-extension-design.md) §5

## Overview

`Idea` on a badge opens the side panel, GPT expands the tweet into a project idea, user edits and saves. Ideas tab lists them with status, notes, and exports to one Markdown file.

## Key Insights

- Volume is small (tens to hundreds of ideas) → one `local:ideas` array item is enough. No IndexedDB.
- [RT#13] Read-modify-write on one array item loses updates even inside one panel (blur-save + status change). Serialize all writes through a promise-chain mutex; patch by id inside the lock.
- Expansion uses the cheap idea model; same JSON-encoded untrusted user message as phase 2.
- [RT#13] Export content is partly stranger-controlled (`sourceText`) or shaped by it (GPT fields). CommonMark passes raw HTML and links through → escape everything, allowlist links.
- Export via `Blob` + `<a download>` in side panel. No `downloads` permission needed.

## Requirements

Functional:
- Idea schema: `{ id, sourceStatusId, title, problem, insight, mvpScope: string[], stack: string[], tags: string[], sourceUrl, sourceText, status: 'new'|'reviewing'|'doing'|'dropped', notes, createdAt }`. `sourceUrl` validated against `^https://x\.com/[^/]+/status/\d+$` before save and before "open source tweet".
- GPT fills `title, problem, insight, mvpScope, stack, tags`, may relate to user's interests/projects.
- Ideas tab: list sorted newest first, filter by status, edit fields inline, change status, delete (confirm), open source tweet.
- `Export .md`: all ideas (or current filter) grouped by status, one section per idea with checkbox list for MVP scope.
- [RT#13] Export escaping: every field as plain text (backslash-escape Markdown punctuation, HTML-escape `<` `>`), newlines flattened in list items; `sourceText` in a fenced block whose fence is longer than its longest backtick run; links only for `https://x.com/*/status/*` and the user's own project URLs, other URLs as inline code.
- [RT#13] Duplicate guard on `sourceStatusId` → show existing instead of new call.

Non-functional: files < 200 lines; export is valid CommonMark.

## Architecture

```
badge Idea ─► background pendingAction {kind:'idea', tweet} ─► side panel Ideas tab
   └─► idea-expander.ts: generateText + Output.object(IdeaDraftSchema) with ideaModel
   └─► user edits → ideas-store.save() → local:ideas
Export ─► ideas-markdown-export.ts (pure) ─► Blob download twitter-craft-ideas-YYMMDD.md
```

## Related Code Files

Create:
- `lib/ideas-store.ts` — `list/save/update/remove` over `storage.defineItem('local:ideas', { fallback: [] })`, all writes via promise-chain mutex
- `lib/idea-expander.ts` — prompt + `generateText` with `Output.object`
- `lib/ideas-markdown-export.ts` — pure `ideasToMarkdown(ideas): string`
- `components/ideas-view.tsx`, `components/idea-editor.tsx`
- `tests/ideas-markdown-export.test.ts`

Modify:
- `lib/types.ts` (Idea, IdeaDraftSchema)
- `entrypoints/sidepanel/app.tsx` (Ideas tab, handle `kind:'idea'`)

## Implementation Steps

1. Types + `ideas-store.ts`.
2. `idea-expander.ts` using `ai-models.ts` with `settings.ideaModel`.
3. `ideas-markdown-export.ts` + test. Fixtures: `sourceText` with unclosed ```` ``` ````, leading `#`, `---`, `- [ ]`, `<img src=…>`, `![](https://evil)`, phishing link; empty list. Assert no raw HTML, no non-allowlisted links, sections intact.
3b. `ideas-store` test: two concurrent `update` calls on different fields of one idea both persist.
4. `ideas-view.tsx` + `idea-editor.tsx`; wire pendingAction `idea`.
5. Compile + tests.

## Todo List

- [ ] Idea types + store
- [ ] Idea expander
- [ ] Markdown export + test
- [ ] Ideas UI + wiring
- [ ] Compile + tests green

## Success Criteria

- [ ] Idea from badge → expanded draft in ≤ ~10s → saved → survives browser restart.
- [ ] Status change and notes persist.
- [ ] Exported file opens cleanly in a Markdown viewer; checkbox lists render.
- [ ] Saving same tweet twice does not create duplicates.

## Risk Assessment

- `chrome.storage.local` 10MB quota: ideas are ~1-2KB each → thousands fit. Add `unlimitedStorage` only if ever hit.
- Concurrent edits from two side panels (two windows): last write wins across windows (mutex is per panel). Acceptable for single user.

## Security Considerations

- Source tweet text stored locally only. Export is user-initiated.
- Export escaped + link-allowlisted so opening it in a Markdown viewer loads no remote content and shows no clickable stranger links.

## Next Steps

Phase 4 adds media to drafts.
