# 381 Phase 38 audit — managed daemon engine (independent, read-only)

> Audits plan `380`. Verdict: **PASS, zero blockers** (3 minor notes).

## Confirmed against live code
- `readTransportOwner(agentDir): Promise<TransportOwnerState|null>`,
  `writeTransportOwner(agentDir, owner): Promise<void>`.
- `TransportOwnerState` required fields: version, ownerId, pid, startedAt, heartbeatAt,
  tokenFingerprint, chatIdFingerprint (+ optional stoppedAt). `fingerprintSecret(value): string`.
  `DEFAULT_TRANSPORT_HEARTBEAT_TTL_MS = 20_000`.
- `decideOwnerClaim({current, candidate:{...fingerprints,pid}, now, heartbeatTtlMs?, pidAlive?}) →
  {action, reason}` matches usage.
- `scanTransportSessions({agentDir}) → {observations[], errors[]}`; `observations.length` is the
  discovered-session count.
- `getTelegramUpdates → TelegramCallOutcome<TelegramUpdate[]>` (`update_id:number`); failure has
  `{ok:false, retryable, status?, reason}`; `nextBackoffMs(attempt)`.
- Telegram offset advance `max(update_id)+1` confirmed correct per Bot API semantics.
- No barrel name collisions; no timers/spawn/schema.

## Notes (non-blocking)
- `getTelegramUpdates` also accepts `signal?` (engine may pass optionally).
- `observations.length` counts discovered endpoint records (not live sockets) — wording "discovered".

PASS → build.
