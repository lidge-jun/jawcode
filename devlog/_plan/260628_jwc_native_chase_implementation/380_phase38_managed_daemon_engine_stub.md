# 380 Phase 38 (stub) — managed Telegram daemon engine

> Slice 2 of card 10.030. Planned after phase 37 (poll client + owner-claim).

Scope (to be planned in full at phase entry): an in-process managed daemon engine that
- scans registered `.jwc/state/notifications/*.json` roots (reuse `scanTransportSessions`),
- claims/keeps the owner slot via `decideOwnerClaim`, writing/refreshing the owner heartbeat,
- drives the Telegram poll loop via `getTelegramUpdates` with `nextBackoffMs` retry/backoff,
- connects newly-discovered session endpoints within a scan interval (independent of the long poll),
- routes inbound updates via `decideTransportInbound` (still fail-closed until a later auth slice).

Testable in-process with a fake clock + fake Telegram client + temp agentDir; NO OS process spawn.
