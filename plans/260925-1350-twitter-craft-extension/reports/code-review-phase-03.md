---
type: code-review
phase: 3
date: 2026-09-25
score: 7.5/10 (before fixes)
---

# Code review: Phase 3 (Ideas/TODO + Markdown export) and reply tone

## Summary

No Critical or High findings. The reviewer rendered about 30 hostile payloads through micromark+GFM and markdown-it (html + linkify). None produced raw HTML, images, reference links, `<…>` autolinks or entity tricks, and the fenced `sourceText` never escaped its block. The store mutex, dedupe and capture abort handling were confirmed correct. The casual tone prompt is sound, and the prompt-injection posture is unchanged.

Before: 213 tests. After: 215 tests, plus new export cases. `tsc` clean, build OK.

## Findings and resolution

| # | Finding | Sev | Resolution |
|---|---------|-----|------------|
| M1 | Project link allowlist compared hosts: project `github.com/me/proj` made `github.com/evil/malware` clickable | Med | `isProjectUrl` (URL-prefix match) in both export and draft checks; tests |
| M2 | Unsaved idea edits lost on tab switch; a second Idea click replaced an edited capture | Med | Edits live in the capture hook; Draft/Ideas stay mounted (hidden); edited capture queues the new one with a Switch/Keep banner; test |
| M3 | Re-capturing the same tweet saved stale hidden edits | Med | No local edit state in the card; editor keyed by capture `seq`; same tweet re-click is a no-op |
| L1 | Lone `\r` not flattened (setext headings, extra list items) | Low | Flatten all whitespace; test |
| L2 | File-extension exemption let `a@evil.md` / `ftp://evil.py` linkify | Low | Export uses its own stricter scanner (any scheme, emails, all bare domains); tests |
| L3 | Save could clear a newer capture | Low | Clear only when `seq` still matches |
| L4 | Save/update/delete errors swallowed | Low | Shown inline in card and row |
| L5 | Autosave on blur only, and wrote unchanged data | Low | Commit only real changes, on blur and 800 ms after typing |
| L6 | Idea errors said "Regenerate"/"draft model" | Low | `draftErrorText(err, 'idea')` |
| L7 | Delete confirm stayed armed after collapse | Low | Reset when collapsed |
| L8 | Empty interests produced "interested in ." | Low | Fallback text |

## Live checks

- Idea from a video-only post (poster reaches the model), save, edit, status change, export and open in a Markdown viewer.
