---
type: code-review
phase: 2
date: 2026-09-25
score: 8/10 (before fixes)
---

# Code review: Phase 2 (GPT draft + composer insert)

## Summary

No Critical findings. No code path clicks Post. Composer lookup is dialog-scoped, with a `dialog_open` pre-check and exact-id article lookup. Stranger content is only in the JSON user message. `usePendingAction` handles StrictMode, nonce, windowId and age. The strict JSON schema was verified against the real SDK.

Before: 152 tests. After: 199 tests, including the tester's hook/panel tests and our own request-ordering tests. `tsc` clean, build OK.

## Findings and resolution

| # | Finding | Sev | Resolution |
|---|---------|-----|------------|
| H1 | Link check only knew 16 TLDs; `https://evil.ru`, `www.evil.tk`, `evil.com.vn` bypassed confirm | High | Any `http(s)://`/`www.` link, bare domains with any TLD (file extensions excluded), full-host compare; tests for each bypass |
| M1 | Two concurrent inserts could both type into one dialog | Med | Content-script `busy` lock; Insert disabled while inserting |
| M2 | `execCommand` ran without checking focus → could type into or wipe the inline composer | Med | Wait for focus inside the dialog composer before every command, else `insert_mismatch`; test |
| M3 | No tests for request ordering, pending action, quote path, paste fallback | Med | Tester added hook/panel/expand tests; we added stale-result, quote, concurrency, focus tests |
| L1 | Deprecated `image` part | Low | `file` part with `mediaType: 'image'` |
| L2 | `NoOutputGeneratedError` not mapped | Low | Mapped to "no usable draft" |
| L3 | SDK retries sleep past the 30 s timeout on 429 | Low | `maxRetries: 0` |
| L4 | `@bob` matched `@bobby` in dialog check and safety check | Low | Word-boundary regex |
| L5 | Quote menu fallback matched "View Quotes" | Low | Exact trimmed label |
| L6 | Repost menu left open when Quote not found | Low | Escape keydown |
| L7 | Mismatch toast led to duplicate paste | Low | "Ctrl+A, Delete, then Ctrl+V" |
| L8 | Toast claimed "copied" when clipboard failed; `inserted` flag could land on another tweet's session | Low | Clipboard result tracked; updates scoped by tweet id |
| L9 | No stale checks after `getSettings`/`expandInTab`; rejections unhandled | Low | Whole run inside `try` with stale checks after each await |
| L10 | Regenerate discarded edits silently | Low | Second click to confirm when edited |
| L11 | Code-point count vs X weighting (Vietnamese letters count 2) | Low | Accepted (Premium); `ponytail:` note |
| L12 | Draft path didn't re-check protected/ad | Low | `generateDraft` refuses them; test |
| L13 | Unedited model text could become a voice sample | Low | Only after a human edit + insert/copy |
| L14 | Responses API stores by default | Low | `store: false` |

## Live checks still needed (x.com, Vietnamese UI)

1. `execCommand('insertText')` while the side panel holds focus (paste fallback otherwise).
2. Quote mode: X enables Post even when empty. After insert, type one char to confirm the text is in the editor state.
3. Status page focal tweet: does Reply open a dialog or focus the inline box? If the latter, expect `no_dialog`, which is safe.
4. Quote menu `a[href*="/compose/"][role="menuitem"]` and handle/permalink in the quote dialog.
5. Multi-line drafts: preserved or `insert_mismatch`.
