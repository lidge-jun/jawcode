# 30 Phase 3 build — Telegram remote answer safety

## Implemented

This phase implemented the JWC-native remote answer safety core for `10.032` and supported-subset notification docs for `10.035`.

It does not start a Telegram poller, connect to session endpoints, mutate agent state, route answers into live asks, or add Discord/Slack adapters.

## Source paths changed

| Path | Change |
|---|---|
| `packages/coding-agent/src/notifications/remote-answer.ts` | Added pure remote-answer authorization, idempotency, race, value normalization, and Telegram callback payload helpers. |
| `packages/coding-agent/src/notifications/transport-shell.ts` | Replaced drop-only inbound helper with side-effect-free transport decision mapping to remote-answer policy. |
| `packages/coding-agent/src/notifications/protocol.ts` | Added optional `source` label to reply/rejected frames. |
| `packages/coding-agent/src/notifications/index.ts` | Exported remote-answer helpers. |
| `packages/coding-agent/test/notifications-remote-answer.test.ts` | Added authorization, stale/mismatch, idempotency conflict, race, free-text, label cleanup, callback payload, and non-leak tests. |
| `packages/coding-agent/test/notifications-transport-shell.test.ts` | Added invalid/contextless/unauthorized and accepted/rejected transport decision tests. |
| `docs/notifications-sdk.md` | Added JWC supported-subset notification docs. |
| `docs/telegram-onboarding.md` | Added Telegram onboarding status docs that explicitly defer live runtime. |
| `packages/coding-agent/test/notifications-docs.test.ts` | Added docs guard tests for JWC naming, no raw token examples, and no unsupported runtime/adapters claims. |
| `struct_har/chase/10.032_gjc_chase_telegram_remote_answers.md` | Added Phase 3 partial evidence, kept active. |
| `struct_har/chase/10.035_gjc_chase_notifications_adapters_docs.md` | Added Phase 3 partial evidence, kept active. |

## Boundary decisions

- Remote answers are pure policy decisions, not live session mutations.
- `presentedToken` enters the transport boundary as a top-level field and is never embedded in callback payloads.
- Accepted answers return a caller-owned context patch; callers must persist it atomically before applying.
- Docs describe only implemented JWC subset and explicitly defer Telegram polling, Discord/Slack, lifecycle, media, and compiled daemon support.
