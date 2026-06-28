# 522 Phase 52 build — lifecycle control runtime

Built after audit `521` PASS. Closes 10.033 (slices B + C + authorization gate; A done in phase 11).

## Changes
### NEW `src/notifications/lifecycle-audit.ts` (~95 ln)
- `LifecycleOutcome` = `listed{sessionCount}` | `execution_deferred{reason}` | `rejected{reason}`.
- `LifecycleAuditRecord` + `buildLifecycleAuditRecord()` — JSONL-safe; never carries bot token or
  message text (only intent kind, chat id, resume session id, outcome, bounded reason, idempotency key,
  replay flag).
- `LifecycleIdempotencyLedger` — bounded (default 256) in-memory ledger; replay returns first outcome;
  insertion-order eviction.

### NEW `src/notifications/lifecycle-control-runtime.ts` (~125 ln)
- `LifecycleSessionSummary` (id/title/updatedAt only) — privacy-minimized read-only listing (10.033-B).
- `LifecycleControlContext` (ownerChatId, chatId, idempotencyKey, listSessions(), ownsSession()).
- `executeLifecycleIntent()` — replay-first; else authorize (paired-chat-only, per-session ownership for
  resume) → dispatch. `list` returns summaries; `new`/`close_current`/`resume` are authorized + audited
  but resolve to `execution_deferred` (no spawn/attach/kill). Every call emits an audit record.

### MODIFY `src/notifications/index.ts` — export lifecycle-audit + lifecycle-control-runtime.

### NEW `test/notifications-lifecycle-control-runtime.test.ts` (9 tests)
wrong-chat reject; resume-unowned reject; list read-only shape; new/close/resume deferred+audited;
idempotency replay returns first outcome even after ownership flips; ledger eviction; audit no-secrets.

## Verification handoff
C: lifecycle suite + full notifications regression + check:types + biome + diff-check. D: close 10.033.
