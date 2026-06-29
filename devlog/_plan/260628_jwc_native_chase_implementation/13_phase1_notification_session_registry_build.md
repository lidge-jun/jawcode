# 13 Phase 1 continuation build — notification session registry

## Build record

Implemented files:

| File | Change |
|---|---|
| `packages/coding-agent/src/notifications/session-registry.ts` | New in-process notification session registry with token-gated connect, hello/action replay, remote answer frame mapping, local-won race handling, and stale discovery cleanup. |
| `packages/coding-agent/test/notifications-session-registry.test.ts` | New focused tests for connect rejection, action replay, remote idempotency, local answer race, stale discovery record update, and secret non-leak. |
| `packages/coding-agent/src/notifications/index.ts` | Exported the new registry module. |
| `struct_har/chase/10.028_gjc_chase_notifications_sdk.md` | Added Phase 1 continuation evidence while keeping done-gates open. |

Explicit non-changes:

- No WebSocket server, HTTP listener, Bun.serve listener, Rust crate, N-API wrapper, worker entrypoint, compiled binary entrypoint, Telegram polling, or network I/O.
- No `notify` CLI changes.
- No card closure.
