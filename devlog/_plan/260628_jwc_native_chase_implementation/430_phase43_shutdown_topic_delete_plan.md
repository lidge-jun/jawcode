# 430 Phase 43 plan — shutdown topic delete (closes 10.031)

> Final slice of `10.031`: gate #6 (topic deletion on session shutdown is best-effort and never breaks
> delivery). Add a best-effort batch delete + wire it into `runManagedDaemon` stop. Closes 10.031.
> Risk class: **C3** (Telegram delete on shutdown); injected delete + best-effort, unit-tested.

## Part 1 — plain explanation
When the daemon stops, it should try to delete the per-session Telegram topics, but a delete failure
must never block the clean stop. This phase adds a best-effort batch delete and calls it from the
daemon's stop hook (alongside marking the owner stopped). Topics come from the existing
`ThreadTopicRegistry`; the bot token is never logged.

## Part 2 — diff-level plan

### NEW `packages/coding-agent/src/notifications/threaded-shutdown.ts` (~35 lines, unit-tested)
```ts
export interface TopicDeletionResult { attempted: number; deleted: number; failed: number; }
export async function deleteSessionTopics(opts: {
  token: string; chatId: string;
  topics: ReadonlyArray<{ messageThreadId: number }>;
  deleteImpl?: typeof deleteForumTopic;
}): Promise<TopicDeletionResult>;
```
Iterate topics; for each call `deleteForumTopic({token, chatId, messageThreadId})`; tally
`deleted`/`failed` from the outcome `ok`. Each call wrapped in try/catch → a throw counts as `failed`,
never propagates. Token never logged.

### MODIFY `packages/coding-agent/src/notifications/daemon-runtime.ts` (~10 lines)
`RunManagedDaemonOptions` += optional `listActiveTopics?: () => ReadonlyArray<{ messageThreadId: number }>`
and `deleteTopicImpl?: typeof deleteForumTopic`. In `onStop` (after marking the owner stopped): if
`listActiveTopics` is provided, `await deleteSessionTopics({token, chatId, topics: listActiveTopics(),
deleteImpl})` inside a try/catch so a delete failure never breaks the stop.

### MODIFY `packages/coding-agent/src/notifications/index.ts` — export threaded-shutdown.

### Tests
- NEW `test/notifications-threaded-shutdown.test.ts`: all delete ok → {attempted,deleted,failed};
  mixed ok/fail (mock deleteImpl) → correct tally; a throwing deleteImpl → counted failed, no throw.
- `test/notifications-daemon-runtime.test.ts` (+1): stop control + `listActiveTopics` returning a topic
  + a failing `deleteTopicImpl` → daemon still returns `stopped`, owner `stoppedAt` set (delete failure
  does not break delivery/stop).

### NEW devlog `431_audit`, `432_build`, `433_check`.

## PABCD
- **A**: independent audit — deleteForumTopic signature + best-effort tally, runManagedDaemon onStop
  wiring (delete after owner-stopped, failure isolated), ThreadTopicRecord.messageThreadId source,
  token-safe. CLOSURE ruling: with deleteSessionTopics wired into the real daemon stop hook, is gate #6
  met and is 10.031 now fully closeable (gates 1-6)?
- **B**: Boss writes deleteSessionTopics + runtime wiring + tests.
- **C**: shutdown + runtime + full notifications regression + check:types + biome + diff-check.
- **D**: close `10.031` to `_fin` if A confirms all 6 gates met; document live forum-topic create/delete
  daemon-render integration (10.034 media boundary) as monitored residual.

## Constraints
- Delete failure never breaks stop/delivery. Token never logged. Injected delete for tests.
- `.jwc` paths. ES modules; files ≤400 lines.
