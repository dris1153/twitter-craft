---
name: project-research-reports-unreliable
description: twitter-craft researcher reports contained wrong X DOM / Jev / WXT claims; always fact-check plan claims sourced from plans/*/research
metadata:
  type: project
---

Researcher reports for twitter-craft (plans/260925-1350-twitter-craft-extension/research/) had several wrong claims found in 2026-09-25 plan review: quoted tweets as nested `article` (actually `div[role="link"]` inside the article), "Show more" as `[aria-label*="more"]` (actually `button[data-testid="tweet-text-show-more-link"]`, inline expand), Jev raw request shape, `defaultValue` for wxt storage (now `fallback`), GPT-6 model names (real ids: gpt-5.6-sol/terra/luna).

**Why:** research agents cite third-party selector lists and blog posts without live verification.

**How to apply:** when reviewing plans/code for this project, grep the claim's origin; if it came from research reports, verify against official docs (docs.typesafe.ai, ai-sdk.dev, wxt.dev, developer.chrome.com) or live-DOM evidence before accepting. Relevant: [[jev-api-shape-differences]].
