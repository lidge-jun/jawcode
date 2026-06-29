# 11 Phase 1 continuation plan — notification session registry

## Scope

Implement the next JWC-native `10.028` foundation slice after Phase 1, Phase 2, and Phase 3.

This phase adds an in-process notification session registry contract that proves token-gated connect decisions, `action_needed` replay, local/remote answer race handling, and stale discovery cleanup without adding a real WebSocket server, Rust/N-API surface, Telegram polling, or session lifecycle process wiring.

## Source anchors

| Card | Source fact | JWC posture |
|---|---|---|
| `10.028` | GJC SDK exposes local authenticated endpoint discovery, replayable pending action frames, connect-token rejection, and `action_resolved`/`reply_rejected` semantics. | Adapt the contract in TypeScript first so JWC has testable server-precondition logic before a later runtime server slice. |
| `10.030` | JWC already has a fail-closed transport shell and discovery root scanner. | Reuse existing transport/drop behavior; do not start daemon or network polling here. |
| `10.032` | JWC already has remote answer authorization/race/idempotency helpers. | Reuse `decideRemoteAnswer`; do not add live Telegram callback routing here. |

Mandatory naming contract: `struct_har/chase/008_gjc_jwc_naming_contract.md`.

## Risk class

C4 security-adjacent. The phase touches token-gated local notification behavior and action answer semantics, but remains in-process and test-only with no external listener.

Required reviewers:

- Backend/security: token rejection, answer race, replay behavior, cleanup lifecycle.
- Docs: chase/devlog evidence and JWC naming.

## Exact file changes

### NEW

| File | Purpose |
|---|---|
| `packages/coding-agent/src/notifications/session-registry.ts` | In-process registry for notification sessions, pending action frames, authorized connect snapshots, remote reply resolution, local answer wins, and stale discovery cleanup helper. |
| `packages/coding-agent/test/notifications-session-registry.test.ts` | Focused tests for token rejection, replay, race/idempotency, stale cleanup, and secret non-leak. |
| `devlog/_plan/260628_jwc_native_chase_implementation/11_phase1_notification_session_registry_plan.md` | This plan. |
| `devlog/_plan/260628_jwc_native_chase_implementation/12_phase1_notification_session_registry_audit.md` | A-phase audit record. |
| `devlog/_plan/260628_jwc_native_chase_implementation/13_phase1_notification_session_registry_build.md` | B-phase build record. |
| `devlog/_plan/260628_jwc_native_chase_implementation/14_phase1_notification_session_registry_check.md` | C-phase verification record. |

### MODIFY

| File | Planned change |
|---|---|
| `packages/coding-agent/src/notifications/index.ts` | Export `session-registry.ts`. |
| `struct_har/chase/10.028_gjc_chase_notifications_sdk.md` | Add Phase 1 continuation evidence. Mark token rejection/replay/race prerequisites as partially implemented, but keep server and shutdown done-gates open. |

## Planned `session-registry.ts` API

```ts
export interface NotificationSessionRegistryOptions {
	sessionId: string;
	connectToken: string;
	now?: () => number;
}

export interface NotificationActionDraft {
	actionId: string;
	prompt: string;
	options?: readonly string[];
	allowFreeText?: boolean;
}

export interface NotificationConnectSnapshot {
	sessionId: string;
	frames: NotificationServerFrame[];
}

export class NotificationSessionRegistry {
	constructor(options: NotificationSessionRegistryOptions);
	connect(presentedToken: string | undefined): NotificationConnectSnapshot | { rejected: true; reason: "unauthorized" };
	enqueueAction(action: NotificationActionDraft): NotificationActionNeededFrame;
	resolveRemote(input: RemoteAnswerInput): NotificationServerFrame;
	resolveLocal(actionId: string): NotificationServerFrame;
}

export async function markStaleNotificationDiscoveryRecord(
	stateRoot: string,
	sessionId: string,
	now?: number,
): Promise<NotificationEndpointRecord | null>;
```

Implementation rules:

1. `connect()` must reject missing/wrong tokens without returning pending action frames.
2. Authorized connect returns `hello` with `NOTIFICATION_PROTOCOL_VERSION` and the configured `sessionId`, plus replayable unresolved `action_needed` frames.
3. `enqueueAction()` records only unresolved action state and returns the public `action_needed` frame; it does not persist prompt history.
4. `resolveRemote()` uses existing `decideRemoteAnswer()` so remote answer race/idempotency behavior stays in one owner.
5. `resolveRemote()` accepted decisions return `{ type: "action_resolved", actionId }`.
6. `resolveRemote()` rejected decisions return `{ type: "reply_rejected", actionId, reason, source: "telegram" }`.
7. Registry action state must persist `answeredBy` and `idempotencyRecords` from accepted `contextPatch` so same-key replay remains idempotent and local-won races reject later remote replies.
8. `resolveLocal()` marks an action local-won and returns `action_resolved`; later remote replies must return `reply_rejected` with `already_answered`.
9. Returned wire frames and connect/reject/resolve JSON must not include the connect token. Discovery persistence may still contain the token only inside `0600` endpoint records written by `writeNotificationDiscoveryRecord()` and masked by display helpers.
10. `markStaleNotificationDiscoveryRecord()` reads an existing discovery record, sets `stale: true`, sets `stoppedAt`, updates `updatedAt`, rewrites with existing `0600` helper, and returns null if the record is missing.

`close()` and full session shutdown metadata are explicitly deferred because this slice has no endpoint metadata owner, no WebSocket server, and no process lifecycle wiring.

## Explicit non-changes

- Do not add a WebSocket server, HTTP server, Bun.serve listener, Rust crate, N-API wrapper, worker entrypoint, or compiled binary entrypoint.
- Do not start Telegram Bot API polling or send network requests.
- Do not change `notify` CLI commands.
- Do not alter `packages/coding-agent/src/notifications/transport-shell.ts` unless the audit proves a necessary integration gap.
- Do not close the `10.028` card; this is a prerequisite slice only.

## Verification plan

Focused tests:

```sh
bun test packages/coding-agent/test/notifications-session-registry.test.ts packages/coding-agent/test/notifications-remote-answer.test.ts packages/coding-agent/test/notifications-discovery.test.ts packages/coding-agent/test/notifications-transport-shell.test.ts
```

Type/static checks:

```sh
cd packages/coding-agent && bun run check:types
git diff --check -- packages/coding-agent/src/notifications/session-registry.ts packages/coding-agent/src/notifications/index.ts packages/coding-agent/test/notifications-session-registry.test.ts struct_har/chase/10.028_gjc_chase_notifications_sdk.md devlog/_plan/260628_jwc_native_chase_implementation/11_phase1_notification_session_registry_plan.md devlog/_plan/260628_jwc_native_chase_implementation/12_phase1_notification_session_registry_audit.md devlog/_plan/260628_jwc_native_chase_implementation/13_phase1_notification_session_registry_build.md devlog/_plan/260628_jwc_native_chase_implementation/14_phase1_notification_session_registry_check.md
```

Expected commit:

```text
feat(notifications): add session registry contract
```
