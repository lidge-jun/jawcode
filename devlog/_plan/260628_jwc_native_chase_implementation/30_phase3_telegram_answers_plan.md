# 30 Phase 3 plan — Telegram remote answer safety

## Scope

Implement a JWC-native remote answer safety core for chase cards `10.032` and `10.035`.

This phase is intentionally narrower than full Telegram remote answering. JWC still has no Telegram poller, endpoint connection loop, or public daemon control surface. Phase 3 adds pure authorization, callback/free-text normalization, idempotency/race decisions, and supported-subset docs so a future poller can route remote input into JWC ask gates without inventing policy at the transport boundary.

## Source anchors

| Card | Source fact | JWC posture |
|---|---|---|
| `10.032` | GJC supports remote ask buttons/free text, duplicate/race handling, redaction-aware ask readability, and scoped inbound acknowledgements. | Adapt core answer policy and render/parse helpers only. Do not add Telegram network I/O or session mutation yet. |
| `10.035` | GJC has notification SDK/adapters docs and tests guarding stale command names/secrets. | Add JWC docs for the currently supported subset only; explicitly defer Discord/Slack adapters and mobile runtime promises. |
| Phase 1 | JWC now has notification protocol/config/discovery helpers and masked status output. | Reuse protocol/config helpers; preserve JWC env/naming. |
| Phase 2 | JWC now has fail-closed `decideTransportInbound()` and scanner observations. | Replace the single drop-only decision with a policy-aware pure decision helper; keep default drop unless authorization and active action context are present. |

Mandatory naming contract: `struct_har/chase/008_gjc_jwc_naming_contract.md`.

## Risk class

C4 security. Remote input can unblock an agent, so authorization, idempotency, stale action rejection, and no raw secret leakage are required before any runtime transport can use it.

Required reviewers:

- Backend: remote action state machine, idempotency, tests.
- Security-focused audit: authorization fail-closed behavior, token/action/session binding, stale/mismatched rejection, no raw token/chat/log leakage.
- Docs: supported-subset docs, JWC naming, no overclaim of unimplemented Telegram runtime.

## Exact JWC owner files

### New files

| File | Purpose |
|---|---|
| `packages/coding-agent/src/notifications/remote-answer.ts` | Pure remote answer types, authorization guard, callback payload parsing, option label cleanup, free-text normalization, idempotency/race decision helper. |
| `packages/coding-agent/test/notifications-remote-answer.test.ts` | Authorization, stale/mismatched action, duplicate idempotency, local-vs-remote race, free-text/custom, label cleanup, and secret non-leak tests. |
| `docs/notifications-sdk.md` | JWC supported-subset docs for notification config/discovery/transport shell/remote answer policy. |
| `docs/telegram-onboarding.md` | JWC Telegram onboarding status doc that clearly says runtime poller is not implemented yet. |
| `packages/coding-agent/test/notifications-docs.test.ts` | Docs guard: no stale public `gjc notify`, no `.gjc` paths, no raw token examples, no unsupported Discord/Slack claims. |

### Modified files

| File | Planned change |
|---|---|
| `packages/coding-agent/src/notifications/index.ts` | Export remote-answer helpers. |
| `packages/coding-agent/src/notifications/protocol.ts` | Add optional `source?: "local" | "telegram"` to reply/rejected frames only if the implementation needs typed source labeling; no wire-breaking required fields. |
| `packages/coding-agent/src/notifications/transport-shell.ts` | Replace current parameterless drop helper with a policy-aware `decideTransportInbound(input)` that still returns `drop` by default. |
| `packages/coding-agent/test/notifications-transport-shell.test.ts` | Update fail-closed tests to cover unauthorized and authorized-but-no-active-action decisions. |
| `struct_har/chase/10.032_gjc_chase_telegram_remote_answers.md` | Add Phase 3 partial evidence; keep active unless all done gates are truly met. |
| `struct_har/chase/10.035_gjc_chase_notifications_adapters_docs.md` | Add Phase 3 docs evidence; keep active because broader adapters/release surface remain deferred. |
| `devlog/_plan/260628_jwc_native_chase_implementation/30_phase3_telegram_answers_audit.md` | Record plan audit. |
| `devlog/_plan/260628_jwc_native_chase_implementation/30_phase3_telegram_answers_build.md` | Record implementation details. |
| `devlog/_plan/260628_jwc_native_chase_implementation/30_phase3_telegram_answers_check.md` | Record verification output and commit hash. |

## Remote answer policy contract

Add pure types:

- `RemoteAnswerInput`
- `RemoteActionContext`
- `RemoteAnswerDecision`
- `RemoteAnswerRejectionReason`
- `NormalizedRemoteAnswer`
- `RemoteActionContextPatch`

Minimum input fields:

```ts
{
  sessionId: string;
  actionId: string;
  idempotencyKey: string;
  transport: "telegram";
  kind: "button" | "free_text";
  value: string;
  presentedToken?: string;
}
```

Minimum context fields:

```ts
{
  sessionId: string;
  actionId: string;
  expectedToken: string;
  answeredBy?: "local" | "telegram";
  idempotencyRecords?: readonly Array<{
    key: string;
    valueHash: string;
    status: "accepted" | "rejected";
    reason?: RemoteAnswerRejectionReason;
  }>;
  allowedValues?: readonly string[];
  allowFreeText?: boolean;
}
```

Accepted answer shape:

```ts
interface NormalizedRemoteAnswer {
  sessionId: string;
  actionId: string;
  idempotencyKey: string;
  source: "telegram";
  kind: "button" | "free_text";
  value: string;
}
```

Context patch shape:

```ts
interface RemoteActionContextPatch {
  answeredBy: "telegram";
  idempotencyRecord: {
    key: string;
    valueHash: string;
    status: "accepted";
  };
}
```

Decision shape:

```ts
type RemoteAnswerDecision =
  | { status: "accepted"; answer: NormalizedRemoteAnswer; contextPatch: RemoteActionContextPatch }
  | { status: "rejected"; reason: RemoteAnswerRejectionReason; idempotencyRecord?: { key: string; valueHash: string; status: "rejected"; reason: RemoteAnswerRejectionReason } };
```

Remote answer rejection reasons:

```ts
type RemoteAnswerRejectionReason =
  | "unauthorized"
  | "session_mismatch"
  | "stale_action"
  | "idempotency_conflict"
  | "already_answered"
  | "invalid_button_value"
  | "free_text_not_allowed"
  | "empty_free_text";
```

Decision rules:

1. Missing/wrong `presentedToken` rejects as `unauthorized`.
2. Mismatched `sessionId` rejects as `session_mismatch`.
3. Mismatched `actionId` rejects as `stale_action`.
4. Reused `idempotencyKey` with the same normalized value hash returns the prior accepted/rejected status without producing a second answer.
5. Reused `idempotencyKey` with a different normalized value hash rejects as `idempotency_conflict`.
6. First writer wins: if `answeredBy` is absent and the answer is valid, the decision is `accept` with a caller-visible patch `{ answeredBy: "telegram", idempotencyRecord }`.
7. If `answeredBy` exists, reject later answers as `already_answered` even when the later answer is otherwise valid.
8. Atomicity boundary: the pure helper only decides. The runtime caller must persist the returned context patch atomically before applying or forwarding the answer. Concurrent callers must re-read context and re-run the helper after a failed compare-and-swap or lock acquisition.
9. Button answers must match `allowedValues` after label cleanup.
10. Free text is accepted only when `allowFreeText` is true and trimmed value is non-empty.
11. Accepted remote answers carry `source: "telegram"` and never include token/chat values.
12. Unauthorized/mismatched decisions expose bounded reason codes only, not raw input secrets.

## Callback/render helper contract

Add pure helpers:

- `stripTelegramOptionPrefix(label: string): string`
- `normalizeRemoteAnswerValue(input): string`
- `buildTelegramCallbackPayload({ sessionId, actionId, value, nonce }): string`
- `parseTelegramCallbackPayload(payload: string)`

Rules:

1. Strip duplicate numbering such as `1. Deploy` or `1) Deploy` while preserving meaningful labels.
2. Reject callback payloads that exceed a conservative size limit.
3. Payloads include session/action identity and nonce/idempotency key, but never token/chat values.
4. Parsing returns bounded error codes, not thrown raw JSON errors.

## Transport integration boundary

`transport-shell.ts` may call the pure remote-answer policy but must still not:

- call Telegram Bot API
- connect to session WebSockets
- mutate JWC agent/session state
- inject prompts
- start/reload/stop daemon processes

This phase proves the security decision layer, not live remote control.

### Transport inbound API

Replace the Phase 2 drop-only helper with explicit pure types:

```ts
type TransportInboundDecision =
  | { mode: "drop"; reason: "authorization_not_implemented" | "unauthorized" | "no_active_action" | "invalid_payload" }
  | { mode: "accepted"; answer: NormalizedRemoteAnswer; contextPatch: RemoteActionContextPatch }
  | { mode: "rejected"; reason: RemoteAnswerRejectionReason };

interface TransportInboundInput {
  payload: unknown;
  presentedToken?: string;
  context?: RemoteActionContext;
}
```

Branches:

1. Missing/invalid payload shape -> `{ mode: "drop", reason: "invalid_payload" }`.
2. Missing active action context -> `{ mode: "drop", reason: "no_active_action" }`.
3. Missing/wrong token -> `{ mode: "drop", reason: "unauthorized" }`.
4. Valid authorization + active action -> delegate to `decideRemoteAnswer()`.
5. `decideRemoteAnswer()` accepted -> `{ mode: "accepted", answer, contextPatch }`.
6. `decideRemoteAnswer()` rejected -> `{ mode: "rejected", reason }`.

Token binding:

- `presentedToken` is a top-level transport boundary field. It represents already-extracted connection/session authorization material and is intentionally not encoded in Telegram callback payloads.
- `decideTransportInbound()` copies `presentedToken` into the `RemoteAnswerInput` passed to `decideRemoteAnswer()`.
- Payload builders/parsers must never include token/chat values.

Payload mapping:

1. Button callback payload parses as `{ transport: "telegram", kind: "button", sessionId, actionId, idempotencyKey, value }`.
2. Free-text payload supplied by the future poller maps as `{ transport: "telegram", kind: "free_text", sessionId, actionId, idempotencyKey, value }`; Phase 3 tests construct this object directly because no poller exists.
3. Any missing non-empty `sessionId`, `actionId`, `idempotencyKey`, `kind`, or `value` maps to `{ mode: "drop", reason: "invalid_payload" }`.
4. Unknown `kind`, malformed callback JSON, oversize callback payload, or parse error maps to `{ mode: "drop", reason: "invalid_payload" }`.
5. A valid payload plus `presentedToken` and `context` becomes `RemoteAnswerInput` by adding `presentedToken` and delegating to `decideRemoteAnswer()`.

Transport decisions are still side-effect-free. Returning `accepted` does not inject a prompt, mutate a session, or call a network endpoint in Phase 3.

## Docs contract for `10.035`

Docs must say exactly what is supported now:

- `jwc notify status/setup` config foundation.
- `.jwc/state/notifications/*.json` discovery records.
- Telegram transport shell state/scanner.
- Remote answer safety policy helpers are implemented but no Telegram poller is shipped.

Docs must not promise:

- Discord/Slack adapters.
- live Telegram inbound/outbound runtime.
- session lifecycle commands.
- media/file transfer.
- compiled daemon binary support.

Docs tests must check:

- no public `gjc notify`
- no `.gjc/state` paths
- no raw-looking bot token examples
- no unsupported Discord/Slack availability claim

## Verification plan

Focused tests:

```sh
bun test packages/coding-agent/test/notifications-remote-answer.test.ts packages/coding-agent/test/notifications-transport-shell.test.ts packages/coding-agent/test/notifications-docs.test.ts
```

Focused test cases must include:

- unauthorized/missing token -> drop/reject without secret leak
- stale action/session mismatch
- reused idempotency key same body -> idempotent replay
- reused idempotency key different body -> `idempotency_conflict`
- local already answered then Telegram answer -> `already_answered`
- Telegram first accepted returns context patch and caller atomicity note is documented
- concurrent race simulated by re-running helper after context shows `answeredBy: "local"`
- free-text accepted only when allowed
- duplicate option numbering stripped
- docs guard for no stale JWC/GJC names or raw token examples

Regression tests:

```sh
bun test packages/coding-agent/test/notifications-transport-state.test.ts packages/coding-agent/test/notifications-config.test.ts packages/coding-agent/test/notifications-discovery.test.ts packages/coding-agent/test/notify-cli.test.ts
```

Package checks:

```sh
bun run check:schemas
cd packages/coding-agent && bun run check:types
git diff --check
```

Attempt `bun run check:tools`; if it still fails on known unrelated formatter issues, record exact unaffected file list in the check artifact.

## Chase close policy

This phase is partial evidence only.

`10.032` remains active because real Telegram callback routing, endpoint connection, assistant lead-in ordering, activity/ack UX, and full remote ask lifecycle are not implemented.

`10.035` remains active because full adapter docs/release surface and Discord/Slack decisions remain deferred.
