# 20 Phase 2 build — Telegram transport shell

## Implemented

This phase implemented the JWC-native Telegram transport shell for `10.030`.

It does not start a daemon, perform Telegram network I/O, expose public daemon commands, route inbound answers, or add a compiled daemon entrypoint.

## Source paths changed

| Path | Change |
|---|---|
| `packages/coding-agent/src/notifications/transport-state.ts` | Added transport state paths, secret fingerprinting, owner freshness predicates, private owner writes, roots registry, and lock-protected root registration. |
| `packages/coding-agent/src/notifications/transport-shell.ts` | Added registered-root scan helper, per-file safe read, masked inert observations, bounded errors, and fail-closed inbound decision. |
| `packages/coding-agent/src/notifications/index.ts` | Exported transport state and shell helpers. |
| `packages/coding-agent/test/notifications-transport-state.test.ts` | Added fingerprint, owner freshness, private permissions, root registry, and non-leak tests. |
| `packages/coding-agent/test/notifications-transport-shell.test.ts` | Added scan observation, malformed discovery, safe-read, and fail-closed inbound tests. |
| `struct_har/chase/10.030_gjc_chase_telegram_managed_daemon.md` | Added Phase 2 partial evidence and kept card active. |

## Boundary decisions

- Owner state lives under `<agentDir>/notifications/telegram/`.
- Registered roots are per-repo `.jwc/state` roots.
- Owner JSON stores only `tokenFingerprint` and `chatIdFingerprint`.
- Scanner observations expose `tokenMasked` only.
- `notifications.daemon.idleTimeoutMs` is not used as heartbeat TTL.
- Public CLI and compiled entrypoint remain unchanged.

## Explicitly deferred

- Telegram `getUpdates`.
- Outbound Telegram send.
- Inbound answer/session routing.
- Daemon process spawn and timer cadence.
- Reload/stop lifecycle control.
- `jwc daemon` or `jwc notify start/reload/stop`.
- `packages/coding-agent/scripts/build-binary.ts` changes.
