# 431 Phase 43 audit — shutdown topic delete (independent, read-only)

> Audits plan `430`. Verdict: **PASS, closeable:true, all 6 gates met** → close 10.031.

## Confirmed
- `deleteForumTopic({token,chatId,messageThreadId,fetchImpl?})→TelegramCallOutcome<true>` (phase 41);
  tally by `outcome.ok`.
- `runManagedDaemon.onStop` (phase 40) marks owner stopped; `options.token`/`chatId` in scope; adding
  optional `listActiveTopics`/`deleteTopicImpl` is non-breaking; delete placed AFTER owner-stopped,
  failure isolated.
- `ThreadTopicRecord.messageThreadId:number`; `ThreadTopicRegistry.list()` returns records. No collisions.

## Closure ruling
All 6 `10.031` done-gates met: 1/2/5 (threaded-lifecycle + registry), 3 (fail-closed inbound), 4
(reply-bridge real-server test), **6** (deleteSessionTopics wired into onStop best-effort; test proves
stop + failing delete still returns `stopped`). **CLOSE 10.031** upon B+C success. Residual (monitored):
live create/delete daemon↔render integration + media inbound (owned by 10.034).
