---
name: x-overlay-routes-keep-page-mounted
description: X modal routes (/compose/post, /status/ID/photo/N) change location.pathname but keep the underlying page's articles mounted; route-keyed badge logic must ignore them
metadata:
  type: project
---

X pushes overlay URLs without unmounting the page underneath: the reply/quote dialog uses `/compose/post` (the extension's own insertDraft flow opens it), the media viewer uses `/{handle}/status/{id}/photo/N` even when opened from /home.

**Why:** 2026-09-25 review of the "skip replies on status pages" change: scan() reset every entry when routeKey(location.pathname) changed, so opening the reply dialog on a status page wiped all badges (evaluate early-returns on non-triage routes, and the IntersectionObserver does not re-fire for stationary tweets after the dialog closes). Opening a photo from /home re-ran status-page rules on the whole timeline.

**How to apply:** When reviewing any content-script logic keyed on location.pathname, ask what happens under /compose/post and photo/video modal paths, and whether an in-flight async result checks the same key before writing. See [[research-reports-unreliable]] for other X DOM claims to verify.
