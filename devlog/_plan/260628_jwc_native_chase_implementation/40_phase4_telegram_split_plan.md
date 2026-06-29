# 40 Phase 4 plan — Telegram threaded/lifecycle/media split

## Scope

Split chase cards `10.031`, `10.033`, and `10.034` into JWC-native adapt/reject/defer sub-slices before any new runtime code.

This phase is docs-only. It does not implement Telegram polling, outbound Telegram sending, session lifecycle control, media transfer, file tools, or endpoint WebSocket integration.

## Why split first

The three cards share Telegram as a surface but have different risk classes:

| Card | Surface | Risk |
|---|---|---|
| `10.031` | topic registry, threaded rendering, inbound routing | remote input routing and persisted topic state |
| `10.033` | create/list/resume/close sessions from Telegram | remote process/session control |
| `10.034` | inbound/outbound media and `telegram_send` | model-controlled file egress and inbound file ingestion |

Bundling them would mix safe pure helpers with high-risk runtime control. The split artifacts below are the gate before later code phases.

## New artifacts

| File | Purpose |
|---|---|
| `devlog/_plan/260628_jwc_native_chase_implementation/40_phase4_telegram_threading_split.md` | Split `10.031` into pure topic registry/render/router candidates and runtime-deferred topic lifecycle. |
| `devlog/_plan/260628_jwc_native_chase_implementation/41_phase4_telegram_lifecycle_split.md` | Split `10.033` into safe read-only/parser candidates and deferred create/resume/close process control. |
| `devlog/_plan/260628_jwc_native_chase_implementation/42_phase4_telegram_media_split.md` | Split `10.034` into docs/spec/path-confinement candidates and deferred media transfer/runtime tool work. |
| `devlog/_plan/260628_jwc_native_chase_implementation/43_phase4_telegram_split_audit.md` | Record Backend/Docs/Security audit verdicts. |
| `devlog/_plan/260628_jwc_native_chase_implementation/44_phase4_telegram_split_build.md` | Record final split output and any edits from audit. |
| `devlog/_plan/260628_jwc_native_chase_implementation/45_phase4_telegram_split_check.md` | Record verification and commit evidence. |

## Chase docs to update

| File | Change |
|---|---|
| `struct_har/chase/10.031_gjc_chase_telegram_threaded_surface.md` | Add Phase 4 split evidence and keep card active. |
| `struct_har/chase/10.033_gjc_chase_telegram_session_lifecycle.md` | Add Phase 4 split evidence and keep card active. |
| `struct_har/chase/10.034_gjc_chase_telegram_media_file_transfer.md` | Add Phase 4 split evidence and keep card active. |

## Implementation candidates after this split

These are candidates only; each future candidate still needs its own PABCD cycle.

1. `10.031-A`: pure topic registry and display-safe session identity formatting.
2. `10.031-B`: pure threaded renderer for already-authorized frames, no network.
3. `10.031-C`: fail-closed threaded inbound classifier, no message injection.
4. `10.033-A`: lifecycle command parser and bounded reason codes.
5. `10.033-B`: read-only recent/list view from already-authorized local metadata.
6. `10.033-C`: audit ledger schema for idempotent lifecycle requests, docs/schema-first only.
7. `10.034-A`: workspace path confinement helper for a future Telegram file tool.
8. `10.034-B`: docs/tests for media limits and explicit unsupported runtime behavior.
9. `10.034-C`: outbound frame schema only if it has no network send and no model-visible file tool.

## Explicit rejects/deferments

Reject for now:

- copying GJC daemon/session lifecycle control wholesale.
- accepting arbitrary cwd/path/process commands from Telegram.
- adding model-visible `telegram_send` before path confinement, sink authorization, size limits, and docs are proven.

Defer:

- `createForumTopic`, `deleteForumTopic`, `sendPhoto`, `sendDocument`, and Telegram Bot API calls.
- live WebSocket connection from transport scanner to sessions.
- public `jwc daemon` or `jwc notify start/reload/stop`.
- remote create/resume/close session execution.
- inbound media injection into user messages.

## Verification plan

Docs-only checks:

```sh
git diff --check -- devlog/_plan/260628_jwc_native_chase_implementation/40_phase4_telegram_split_plan.md devlog/_plan/260628_jwc_native_chase_implementation/40_phase4_telegram_threading_split.md devlog/_plan/260628_jwc_native_chase_implementation/41_phase4_telegram_lifecycle_split.md devlog/_plan/260628_jwc_native_chase_implementation/42_phase4_telegram_media_split.md struct_har/chase/10.031_gjc_chase_telegram_threaded_surface.md struct_har/chase/10.033_gjc_chase_telegram_session_lifecycle.md struct_har/chase/10.034_gjc_chase_telegram_media_file_transfer.md
```

Regression smoke because the split references current notification docs and remote-answer surface:

```sh
bun test packages/coding-agent/test/notifications-docs.test.ts packages/coding-agent/test/notifications-remote-answer.test.ts
```

Package typecheck is optional for docs-only, but run if any code changes appear in `git diff --name-only`.
