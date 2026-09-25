---
date: 2026-09-25
type: journal
topic: Phase 1 implementation (scaffold, parser, Jev triage badges)
---

# Phase 1: Jev triage badges

## What happened

- Scaffolded WXT 0.21 + React 19 + Tailwind v4 + shadcn/ui. Installed versions are newer than the plan assumed: AI SDK 7 (not 6), TypeScript 7, zod 4, vitest 5. Code follows the installed typings.
- Jev goes through AI SDK `experimental_evaluate` + `@ai-sdk/typesafe-ai`. The provider maps boolean questions to `noul` and exposes confidence under `providerMetadata.typesafe.confidence`. A test runs the real SDK path against stubbed fetch.
- The shadcn CLI resolved `@/` through WXT's generated tsconfig and wrote components one directory above the project. Moved them back, fixed the `cn` import, and pinned `paths` in the root tsconfig.
- Tester added useful schema and parser tests, but two were placeholders: a queue test asserting `true`, and a badge test that re-implemented `stopPropagation` itself. Both were rewritten to exercise real behavior.
- Code review (7/10): `isIntersecting` ignores the threshold, and the SDK's own retry swallowed 429s, so the queue never paused. Fixed both (visibility gate with dwell, `maxRetries: 0`) plus 7 medium issues. Now 122 tests.

## Decisions

- Queue owns all backoff; pause persisted in `storage.session` so a stopped SW doesn't hammer Jev after restart.
- Route allowlist with a reserved-path set, since `/notifications` and `/explore` look like handles.
- `getSettings` keeps each field that still validates, so one bad field can't wipe the API keys.

## Open

- Live verification on x.com (Vietnamese UI): real fixtures, protected/ad labels, side panel gesture, dialog-scoped insert, `setAccessLevel` persistence, calibration on about 100 tweets.
