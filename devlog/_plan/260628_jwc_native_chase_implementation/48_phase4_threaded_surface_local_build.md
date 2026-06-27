# 48 Phase 4 build — threaded surface local helpers

## Build record

Implemented files:

| File | Change |
|---|---|
| `packages/coding-agent/src/notifications/threaded-surface.ts` | New pure topic registry, identity/action renderers, and fail-closed inbound classifier. |
| `packages/coding-agent/test/notifications-threaded-surface.test.ts` | New focused tests for registry dedupe/stale replacement, renderer bounds/no double numbering, fail-closed classifier cases, attachment drops, inert route shape, and import smoke through `../src/notifications`. |
| `packages/coding-agent/src/notifications/index.ts` | Exported the new threaded-surface helpers. |
| `struct_har/chase/10.031_gjc_chase_telegram_threaded_surface.md` | Added local-helper evidence while keeping done-gates open. |

Explicit non-changes:

- No Bot API calls, topic creation/deletion/rename, message sending, live update receiving, daemon integration, filesystem persistence, session injection, or media routing.
- No `10.031` done-gate closure.
