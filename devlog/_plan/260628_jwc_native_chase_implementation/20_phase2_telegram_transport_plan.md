# 20 Phase 2 plan — Telegram transport shell

## Scope

Implement the JWC-native transport shell for chase card `10.030`.

This phase does not implement Telegram `getUpdates`, outbound Telegram sends, inbound answer routing, topic/thread rendering, reload/stop CLI, or remote control. It creates the local singleton state, owner fingerprinting, root registry, discovery scanning, and fail-closed inbound decision helpers needed before a real Telegram poller can exist.

## Source anchors

| Card | Source fact | JWC posture |
|---|---|---|
| `10.030` | GJC has daemon owner state, roots registry, singleton poller, heartbeat, stale-owner replacement, scan cadence, and compiled daemon smoke tests. | Adapt local state/ownership/scanner shell only. No Telegram network loop or inbound delivery yet. |
| `10.028` | JWC Phase 1 now writes `.jwc/state/notifications/<sessionId>.json` helpers. | Use those helpers as scanner input. |
| `10.029` | JWC Phase 1 now resolves token/chat config and masks secrets. | Use masked/fingerprinted token/chat values; never log raw secrets. |

Mandatory naming contract: `struct_har/chase/008_gjc_jwc_naming_contract.md`.

## Risk class

C4 security/process-lifecycle slice. Even without Telegram network I/O, this creates daemon ownership state and token fingerprints.

Required reviewers:

- Backend: state model, scanner, CLI integration, tests.
- Security-focused review: token/chat fingerprinting, no raw secret persistence/logging, fail-closed inbound handling.
- Architecture spot-check: no public daemon control surface and no premature Worker/compiled entrypoint.
- Docs: chase partial-evidence wording and active-card status.

## Exact JWC owner files

### New files

| File | Purpose |
|---|---|
| `packages/coding-agent/src/notifications/transport-state.ts` | Pure state paths, owner state, root registry, token/chat fingerprinting, stale/live owner predicates, private JSON writes. |
| `packages/coding-agent/src/notifications/transport-shell.ts` | Scanner/fail-closed transport shell that reads discovery records and produces inert session observations. |
| `packages/coding-agent/test/notifications-transport-state.test.ts` | Ownership, fingerprints, stale detection, root registry, secret non-leak tests. |
| `packages/coding-agent/test/notifications-transport-shell.test.ts` | Discovery scan and fail-closed inbound/drop behavior tests. |

### Modified files

| File | Planned change |
|---|---|
| `packages/coding-agent/src/notifications/index.ts` | Export transport-state and transport-shell helpers. |
| `packages/coding-agent/src/cli/notify-cli.ts` | Optional: include inert transport-shell status fields only if useful; no daemon start/reload/stop action. |
| `struct_har/chase/10.030_gjc_chase_telegram_managed_daemon.md` | Add Phase 2 partial evidence, keep active. |
| `devlog/_plan/260628_jwc_native_chase_implementation/20_phase2_telegram_transport_audit.md` | Record plan audit. |
| `devlog/_plan/260628_jwc_native_chase_implementation/20_phase2_telegram_transport_build.md` | Record build details. |
| `devlog/_plan/260628_jwc_native_chase_implementation/20_phase2_telegram_transport_check.md` | Record verification output and commit hash. |

## Explicit non-changes

Do not modify `packages/coding-agent/scripts/build-binary.ts` in this phase.

Reason: no Worker or compiled daemon entrypoint is introduced. Compile-entrypoint impact is explicitly "none" for this shell slice. A future phase that adds an internal daemon process or Worker must update `build-binary.ts` and add a compiled smoke test.

Do not add public `jwc daemon`, `jwc notify daemon-internal`, `jwc notify start`, `reload`, or `stop` commands.

## State path contract

There are two distinct roots:

| Root | Owner | Purpose |
|---|---|---|
| `Settings.getAgentDir()` | user-global JWC agent config dir | Singleton transport owner/roots registry. |
| repository `.jwc/state` | per-project/session state root | Phase 1 notification endpoint discovery files. |

`registerTransportRoot()` registers repository `.jwc/state` roots, not `agentDir`.

## State model

Use the JWC agent directory for singleton transport state:

```text
<agentDir>/notifications/telegram/
```

Files:

| File | Content |
|---|---|
| `owner.json` | Current owner state with `version`, `ownerId`, `pid`, `tokenFingerprint`, `chatIdFingerprint`, `startedAt`, `heartbeatAt`, optional `stoppedAt`. |
| `roots.json` | Registered state roots, each normalized as an absolute path with `updatedAt`. |

Path resolver:

- `transportPaths(agentDir)` returns `{ dir, ownerFile, rootsFile }`.
- Mapping from GJC to JWC:
  - GJC `telegram-daemon.state.json` -> JWC `owner.json`
  - GJC `telegram-daemon.roots.json` -> JWC `roots.json`
  - GJC `<agentDir>/notifications/` -> JWC `<agentDir>/notifications/telegram/`

Permissions:

- Directory mode `0700` where supported.
- File mode `0600` where supported.
- Atomic temp-write then rename.

Token/chat handling:

- Store only SHA-256 fingerprints, never raw token or chat id.
- `fingerprintSecret(value)` uses `createHash("sha256").update(value).digest("hex").slice(0, 12)` to stay compatible with the GJC token fingerprint shape while hardening chat id storage.
- Display helpers expose masked/fingerprint prefixes only.
- Tests must assert raw token/chat strings are absent from serialized state.

## Ownership predicates

Add pure helpers:

- `fingerprintSecret(value: string): string`
- `sameTransportIdentity(owner, identity): boolean`, where `identity` is `{ tokenFingerprint: string; chatIdFingerprint: string }` derived from `ResolvedNotificationConfig`.
- `isFreshLiveTransportOwner({ owner, now, ttlMs, pidAlive, tokenFingerprint, chatIdFingerprint })`
- `markTransportOwnerStopped(owner, now)`

Exported default:

- `DEFAULT_TRANSPORT_HEARTBEAT_TTL_MS = 20_000`

Rules:

1. A live pid with fresh heartbeat and same token/chat fingerprints remains owner.
2. A dead pid or stale heartbeat is replaceable.
3. Different token/chat fingerprints cannot reuse the same owner.
4. `stoppedAt` owner is not live.
5. Runtime callers must not map `notifications.daemon.idleTimeoutMs` to `ttlMs`. `idleTimeoutMs` is reserved for future daemon idle shutdown semantics only; it must not influence owner freshness, stale-owner replacement, scanner behavior, or tests in this phase. Heartbeat freshness stays governed by `DEFAULT_TRANSPORT_HEARTBEAT_TTL_MS` in Phase 2, with tests allowed to pass explicit `ttlMs` values directly to `isFreshLiveTransportOwner()` for deterministic stale/fresh assertions. If runtime-configurable heartbeat TTL is needed later, add a dedicated setting instead of overloading idle timeout.
6. Default `pidAlive` should treat `EPERM` as alive and `ESRCH` as dead.

## Root registry

Add pure helpers:

- `readTransportRoots(agentDir)`
- `writeTransportRoots(agentDir, roots)`
- `registerTransportRoot(agentDir, stateRoot, now)`

Rules:

1. Paths are absolute and deduplicated.
2. Re-registering a root updates `updatedAt`.
3. Registry writes are private and atomic.
4. Registry contains `.jwc/state` roots, not repository roots.
5. `writeTransportRoots` and `registerTransportRoot` use `withFileLock` from `packages/coding-agent/src/config/file-lock.ts` to avoid concurrent write loss.
6. Root file schema is `{ version: 1, roots: Array<{ stateRoot: string; updatedAt: number }>, sessions?: Record<string, string> }`; `sessions` is accepted for forward compatibility but not populated in Phase 2.

## Fail-closed scanner

`transport-shell.ts` must scan registered roots by reading:

```text
<stateRoot>/notifications/*.json
```

It may return observations such as:

```ts
{
  sessionId: string;
  url: string;
  tokenMasked: string | null;
  inboundMode: "drop";
}
```

Named exports:

- `safeReadTransportEndpoint(stateRoot: string, file: string)` returns `{ ok: true; observation }` or `{ ok: false; error }` without throwing for malformed per-file data.
- `scanTransportSessions(options: { agentDir: string; now?: number })` reads registered roots with `readTransportRoots(agentDir)`, scans `<stateRoot>/notifications/*.json`, and returns `{ observations, errors }`.
- `decideTransportInbound(input: unknown)` returns `{ mode: "drop"; reason: "authorization_not_implemented" }`.

Safe-read implementation contract:

1. `safeReadTransportEndpoint()` is the only helper that may call the Phase 1 raw discovery reader (`readNotificationDiscoveryRecord()`) for scanner input.
2. `safeReadTransportEndpoint()` converts successful records through `toNotificationEndpointDisplay()` before returning an observation.
3. `scanTransportSessions()` must not call `readNotificationDiscoveryRecord()` directly; it calls `safeReadTransportEndpoint()` per file so one malformed discovery file cannot abort the scan.
4. All three helpers are named exports from `transport-shell.ts` and re-exported from `notifications/index.ts`.

Safe-read error shape:

```ts
{
  sessionId?: string;
  file: string;
  code: "invalid_json" | "unsafe_session_id" | "read_failed" | "invalid_record";
}
```

Inbound policy for this phase:

1. All inbound updates/messages are dropped or ack-only.
2. No answer injection, no user-message injection, no session lifecycle command.
3. No network fetch, no Telegram Bot API, no WebSocket connection.
4. Scanner reuses Phase 1 discovery display semantics via `toNotificationEndpointDisplay()` for emitted observations, but it must wrap each file read/parse in `safeReadTransportEndpoint()` so one malformed discovery file cannot abort the scan.
5. Unknown/corrupt discovery files are ignored with bounded error metadata and no token leak.
6. The scanner must not log, persist, or return raw discovery `token` fields.
7. Observations expose `tokenMasked` only; raw `token`, raw chat id, and complete fingerprints are never returned from scan APIs.

## Daemon lifecycle (shell-only)

In scope:

- owner path resolution
- owner read/write/stop-mark helpers
- heartbeat freshness predicate
- root registration
- discovery scan observations
- fail-closed inbound decision helper

Deferred:

- spawning a daemon process
- `jwc notify daemon-internal`
- public `jwc daemon` or `jwc notify start/reload/stop`
- wait-for-pid-death reload semantics
- scan timer/cadence
- Telegram `getUpdates`
- outbound Telegram sends
- network retry/backoff
- compiled binary entrypoint/smoke

## Verification plan

Focused tests:

```sh
bun test packages/coding-agent/test/notifications-transport-state.test.ts packages/coding-agent/test/notifications-transport-shell.test.ts
```

Regression tests from Phase 1:

```sh
bun test packages/coding-agent/test/notifications-config.test.ts packages/coding-agent/test/notifications-discovery.test.ts packages/coding-agent/test/notify-cli.test.ts
```

Package checks:

```sh
bun run check:schemas
cd packages/coding-agent && bun run check:types
git diff --check
```

`bun run check:tools` should be attempted. If it still fails on unrelated pre-existing formatter issues, record exact unaffected file list in the check artifact.

## Chase close policy

This phase cannot close `10.030`.

Done-gate mapping:

| Done-gate item | Phase 2 status |
|---|---|
| Multiple JWC sessions attach to one fresh daemon owner for same token/chat | Partially modeled by owner predicates and roots registry; no process attach yet. |
| A second poller is not started while owner pid is live | In scope as pure owner predicate; no poller spawn. |
| Reload/stop are owner-scoped and do not clear newer owner requests | Deferred; no reload/stop CLI. |
| Session endpoint files created after daemon startup are connected within scan interval | Partially modeled by scanner observations; no connection. |
| Poller survives transient network errors and logs bounded failures | Deferred; no network poller. |
| Token/chat fingerprinting avoids secret logs | In scope. |

Default posture: add partial evidence to `10.030`, keep it active, and do not move it to `_fin`.

## Evidence artifacts

This PABCD loop must produce:

| Artifact | Required content |
|---|---|
| `devlog/_plan/260628_jwc_native_chase_implementation/20_phase2_telegram_transport_audit.md` | Backend, security, architecture/docs audit verdicts plus plan fixes. |
| `devlog/_plan/260628_jwc_native_chase_implementation/20_phase2_telegram_transport_build.md` | Changed paths, implementation decisions, no-network/no-daemon boundaries, deferred slices. |
| `devlog/_plan/260628_jwc_native_chase_implementation/20_phase2_telegram_transport_check.md` | Fresh command output, reviewer verdict, known unrelated failures, and commit hash. |
