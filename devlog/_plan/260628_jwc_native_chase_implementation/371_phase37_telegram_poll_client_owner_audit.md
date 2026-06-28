# 371 Phase 37 audit — Telegram poll client + owner-claim (independent, read-only)

> Audits plan `370`. Verdict: **NARROW (buildable), zero blockers** — one naming correction applied.

## Confirmed against live code (transport-state.ts)
- `TransportIdentity = { tokenFingerprint; chatIdFingerprint }`.
- `TransportOwnerState extends TransportIdentity { version:1; ownerId; pid; startedAt; heartbeatAt; stoppedAt? }`.
- `isFreshLiveTransportOwner({ tokenFingerprint, chatIdFingerprint, owner, now, ttlMs, pidAlive? })` →
  false if no owner / stopped / identity mismatch / pid dead / heartbeat older than ttl.
- `sameTransportIdentity`, `defaultPidAlive` (kill(pid,0), EPERM=alive), `fingerprintSecret` (sha256[0:12]),
  `DEFAULT_TRANSPORT_HEARTBEAT_TTL_MS = 20_000`.
- No existing Telegram getUpdates/sendMessage client. `telegram-pairing.ts` token-sanitize pattern
  (`text.split(token).join("***")`) mirrored. 409 single-owner-conflict → fatal is correct; 429
  `parameters.retry_after` (seconds); getUpdates result = array of `{update_id}`.
- No barrel name collisions; schema untouched; no process spawn.

## Correction applied
- Plan's `heartbeatTtlMs?` maps to `isFreshLiveTransportOwner`'s required `ttlMs`; defaulted to
  `DEFAULT_TRANSPORT_HEARTBEAT_TTL_MS` and passed as `ttlMs`.

PASS-to-build (NARROW).
