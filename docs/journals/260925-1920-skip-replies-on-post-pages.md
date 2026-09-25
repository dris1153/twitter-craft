---
date: 2026-09-25
type: journal
topic: Skip other people's replies on post pages
---

# Skip replies on post pages

- User saw replies on a post's page getting Jev scores. Rule chosen: on `/{handle}/status/{id}`, score the post and the author's own tweets (self-thread); other replies get a "not scored" badge with Draft/Idea and no Jev call. Everything else is unchanged.
- Signals come from the URL (post id, author handle), not X's DOM. X omits "Replying to" in the conversation view, and ordering breaks under virtualization.
- The review caught a real regression before it shipped: X changes the URL for modals (`/compose/post` for the reply composer, `/status/{id}/photo/1` for media) while the page stays mounted. Treating those as navigations wiped every badge on the page, including during our own Insert flow. Fixed by tracking the page under any overlay. Also anchored the status regex so `/quotes` lists are still scored, and stale triage results now check the route too.
- Lesson: in SPAs, URL change ≠ page change. Model "page" separately from `location.pathname`.
