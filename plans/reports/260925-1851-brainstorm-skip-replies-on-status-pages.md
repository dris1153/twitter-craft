---
type: brainstorm-report
date: 2026-09-25
status: approved
---

# Brainstorm: skip comments, triage only main posts

## Problem

On a tweet's status page every reply under the post gets a Jev score. That is noisy and burns Jev calls. The user wants only the main post, and reposts/quotes as today.

## Decisions (user)

- Scope: status pages only (`/{handle}/status/{id}`). Home/List/Search/Profile are unchanged.
- The author's own thread continuations count as main content.
- Comments keep a small badge with Draft/Idea buttons but no score and no Jev call.

## Rule

| Tweet on a status page | Mode |
|---|---|
| id = URL status id | triage |
| author = URL handle (self-thread) | triage |
| anyone else | manual badge (Draft/Idea only) |
| ad / protected | skip (unchanged) |

Pure `triageMode(tweet, pathname)` in `lib/x-routes.ts`. Entries remember the route key and are re-evaluated on SPA navigation.

## Alternatives rejected

- DOM "Replying to" label: X omits it for replies in the status-page conversation.
- Order-based thread detection (only consecutive author tweets right after the focal one): breaks when X virtualizes the list.
- GraphQL interception (`in_reply_to_status_id_str`): exact everywhere, but needs a MAIN-world script that parses X's private API. Too heavy for a problem limited to status pages.

## Trade-off

The author's replies to commenters also get triaged. This is rare and cheap.

## Success

- Status page: focal post and author thread have scores; other replies show "reply" + Draft/Idea; no Jev calls for them.
- Navigating status → home re-triages normally.
