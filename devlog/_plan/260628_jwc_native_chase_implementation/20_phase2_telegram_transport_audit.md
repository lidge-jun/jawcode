# 20 Phase 2 audit — Telegram transport shell

## Verdict

PASS after plan fixes.

## Audit history

| Reviewer | Result | Evidence |
|---|---|---|
| Backend initial re-audit | NEEDS_FIX | Flagged one semantic error: `notifications.daemon.idleTimeoutMs` must not map to heartbeat `ttlMs`; scanner safe-read/named-export contract needed more precision. |
| Docs final re-audit | PASS | Confirmed JWC-native boundary, active-card partial evidence policy, evidence artifacts, and no premature close of `10.030`. |
| Backend final re-audit | PASS | Confirmed idle timeout and heartbeat TTL are separated, scanner safe-read exports are concrete, raw token/chat leaks are prohibited, and scope remains shell-only. |

## Plan fixes applied

- Kept heartbeat freshness on `DEFAULT_TRANSPORT_HEARTBEAT_TTL_MS = 20_000`.
- Explicitly prohibited mapping `notifications.daemon.idleTimeoutMs` to heartbeat `ttlMs`.
- Added `safeReadTransportEndpoint(stateRoot, file)` as the per-file safe-read contract.
- Added bounded scanner error shape: `invalid_json`, `unsafe_session_id`, `read_failed`, `invalid_record`.
- Required scan APIs to expose `tokenMasked` only, never raw token/chat values or full fingerprints.
- Kept `10.030` active because poller spawn, network I/O, reload/stop, compiled daemon smoke, and real endpoint connection are deferred.

## Files audited

- `devlog/_plan/260628_jwc_native_chase_implementation/20_phase2_telegram_transport_plan.md`
- `packages/coding-agent/src/notifications/config.ts`
- `packages/coding-agent/src/notifications/discovery.ts`
- `packages/coding-agent/src/config/file-lock.ts`
- `packages/coding-agent/src/harness-control-plane/storage.ts`
- `packages/coding-agent/src/modes/shared/agent-wire/session-registry.ts`
- `struct_har/chase/10.030_gjc_chase_telegram_managed_daemon.md`
