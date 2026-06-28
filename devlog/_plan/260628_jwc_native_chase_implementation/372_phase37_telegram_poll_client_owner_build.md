# 372 Phase 37 build — Telegram poll client + owner-claim

> Boss-direct build after audit `371` NARROW/PASS. Both modules pure/fetch-based; no process spawn.

## Changes
### NEW `packages/coding-agent/src/notifications/telegram-api.ts` (~125 lines)
- `getTelegramUpdates({token, offset?, timeoutSec?, fetchImpl?, signal?})` long-poll (offset+timeout
  in query); `sendTelegramMessage({token, chatId, text, fetchImpl?})`.
- `classifyTelegramError(status, body)`: 409→fatal `conflict`, 429→retryable+`retryAfterMs` (from
  `parameters.retry_after`*1000), 5xx→retryable, 401/400→fatal, network/unknown→retryable.
- `nextBackoffMs(attempt, base=500, cap=30000)` = `min(cap, base*2^attempt)`.
- `TelegramCallOutcome<T>` discriminated union; token sanitized from every `reason` (split/join `***`).

### NEW `packages/coding-agent/src/notifications/daemon-owner.ts` (~55 lines)
- `decideOwnerClaim({current, candidate:{...identity,pid}, now, heartbeatTtlMs?, pidAlive?})` →
  `{action:'claim'|'defer'|'keep', reason}`. null/stopped→claim(no-owner); same identity+pid→keep
  (self-owner); fresh-live owner→defer(live-owner); stale/dead→claim(stale-owner). Reuses
  `isFreshLiveTransportOwner`/`sameTransportIdentity`; `heartbeatTtlMs` defaults to the transport const.

### MODIFY `packages/coding-agent/src/notifications/index.ts` — export both modules.

### Tests
- `notifications-telegram-api.test.ts` (7): getUpdates ok + offset/timeout in URL; 409 fatal; 429
  retryAfterMs; 5xx + thrown-fetch retryable (no token leak); sendMessage ok + 401 fatal;
  classifyTelegramError branches; nextBackoffMs exp+cap.
- `notifications-daemon-owner.test.ts` (6): no-owner, stopped, self-keep, live-defer, stale-claim, dead-claim.

## Verification handoff
C: both suites + full notifications regression + check:types + biome + diff-check.
D: 10.030 stays OPEN (engine=phase 38, process spawn/reload/stop=phase 39).
