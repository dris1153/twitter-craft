---
name: jev-api-shape-differences
description: twitter-craft uses the AI SDK path for Jev (experimental_evaluate + @ai-sdk/typesafe-ai); verified answer shapes and a retry gotcha that defeats the triage queue's 429 pause
metadata:
  type: project
---

Phase 1 chose the AI SDK path (no `lib/jev-client.ts`). Verified in node_modules on 2026-09-25 (typesafe-ai 3.0.6, ai 7.0.x):
- Provider sends `boolean` as raw `noul`; SDK answers are `{score}` (fractional 0..levels-1), `{choice, probabilities}`, `{probability}`.
- Confidence lives in `providerMetadata.typesafe.confidence[id]`, only for choice/score (never boolean).
- AI SDK retry sleeps on `retry-after` when < 60s, and that sleep aborts on `abortSignal`. With `maxRetries > 0` plus a short `AbortSignal.timeout`, a 429 surfaces as an AbortError, not APICallError, so a queue-level 429 pause never triggers.

**Why:** the queue's unit tests mock `triageWithJev`, so SDK retry/abort interplay is invisible to CI.

**How to apply:** when reviewing any Jev/OpenAI call wrapped by an app-level queue or backoff, check `maxRetries` (should be 0 when the app owns backoff) and how abort errors are classified. Related: [[project-research-reports-unreliable]].
