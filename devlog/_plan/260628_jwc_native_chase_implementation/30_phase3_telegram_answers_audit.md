# 30 Phase 3 audit — Telegram remote answer safety

## Verdict

PASS after plan fixes.

## Audit history

| Reviewer | Result | Evidence |
|---|---|---|
| Docs | PASS | Confirmed partial evidence policy, active-card status, JWC naming, and no unsupported Telegram/Discord/Slack promises. |
| Backend initial | FAIL | Required explicit `idempotency_conflict`, deterministic `decideTransportInbound(input)` contract, and local-vs-remote race/atomicity rules. |
| Backend re-audit | FAIL | Remaining gap: transport input token binding and payload-to-remote-answer mapping. |
| Backend final re-audit | FAIL | Remaining gap: `NormalizedRemoteAnswer`, `RemoteActionContextPatch`, and `RemoteAnswerDecision` shapes were named but undefined. |
| Backend type-shape re-audit | PASS | Confirmed accepted/rejected transport mapping and all remote-answer decision shapes are deterministic. |

## Plan fixes applied

- Added same-key/different-body `idempotency_conflict`.
- Added first-writer race semantics and caller-owned atomic context patch boundary.
- Added top-level transport `presentedToken`, explicitly excluded tokens from callback payloads.
- Added payload-to-`RemoteAnswerInput` mapping for button callbacks and free-text objects.
- Added `NormalizedRemoteAnswer`, `RemoteActionContextPatch`, `RemoteAnswerDecision`, and rejection reason shapes.

## Files audited

- `devlog/_plan/260628_jwc_native_chase_implementation/30_phase3_telegram_answers_plan.md`
- `packages/coding-agent/src/notifications/protocol.ts`
- `packages/coding-agent/src/notifications/transport-shell.ts`
- `packages/coding-agent/src/notifications/config.ts`
- `packages/coding-agent/src/modes/shared/agent-wire/workflow-gate-broker.ts`
- `struct_har/chase/10.032_gjc_chase_telegram_remote_answers.md`
- `struct_har/chase/10.035_gjc_chase_notifications_adapters_docs.md`
