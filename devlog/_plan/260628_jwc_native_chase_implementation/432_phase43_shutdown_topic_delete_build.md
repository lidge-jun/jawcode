# 432 Phase 43 build — shutdown topic delete

> Boss-direct build after audit `431` PASS (closeable). Closes 10.031.

## Changes
### NEW `packages/coding-agent/src/notifications/threaded-shutdown.ts` (~40 lines)
`deleteSessionTopics({token, chatId, topics, deleteImpl?}) → {attempted, deleted, failed}` — best-effort
batch `deleteForumTopic`, each isolated in try/catch (throw → failed, never propagates); token never logged.

### MODIFY `packages/coding-agent/src/notifications/daemon-runtime.ts`
`RunManagedDaemonOptions` += optional `listActiveTopics?`/`deleteTopicImpl?`. `onStop` now (after marking
owner stopped) best-effort deletes active topics in a try/catch so a delete failure never breaks the stop.

### MODIFY `packages/coding-agent/src/notifications/index.ts` — export threaded-shutdown.

### Tests
- NEW `notifications-threaded-shutdown.test.ts` (4): all-ok tally; mixed ok/fail; throwing delete →
  failed, no throw; empty no-op.
- `notifications-daemon-runtime.test.ts` (+1): stop + `listActiveTopics` + a throwing `deleteTopicImpl`
  → outcome `stopped`, topic delete attempted, owner `stoppedAt` set (failure does not break stop).

## Verification handoff
C: shutdown + runtime + full notifications regression + check:types + biome + diff-check. D: close 10.031.
