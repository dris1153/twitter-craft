---
name: host-level-link-allowlists
description: twitter-craft link allowlists (checkDraft, Markdown export) compare hostOf() only, so a github.com project URL allowlists every GitHub link; recheck when reviewing link-safety code
metadata:
  type: project
---

`hostOf()` in lib/draft-safety-checks.ts is reused for "user's own project links" in both draft warnings and the phase 3 Markdown export (as of 2026-09-25). A project on a shared host (github.com, x.com, npmjs.com) makes every stranger URL on that host "trusted", including OAuth `/login/oauth/authorize` consent-phishing links.

**Why:** spec [RT#13] asks for the user's own project URLs, not hosts; tests (`['https://evalkit.dev']`) only cover a single-tenant host, so CI never shows it.

**How to apply:** when reviewing any allowlist built from project URLs, check for prefix/exact URL matching, not host matching. Markdown output can be verified by bundling the lib file with `npx rolldown` into the scratchpad and rendering with micromark+gfm and markdown-it (linkify on). Related: [[project-research-reports-unreliable]].
