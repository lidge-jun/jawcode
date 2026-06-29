# 410 Phase 41 plan — Telegram topic lifecycle (closes 10.031)

> Work-phase 41 = the remaining `10.031` done-gates: forum-topic create / flat-fallback / identity-once
> / delete-on-shutdown. Phase 4 already shipped the pure `threaded-surface.ts` (ThreadTopicRegistry
> dedupe, plain-text renderers, fail-closed inbound classifier + inert route). This adds the token-safe
> topic API client + a pure topic-action decision, with mocked-fetch tests. Then closes 10.031.
> Risk class: **C3** (Telegram network boundary + routing); fetch-injected, token-safe, unit-tested.

## Part 1 — plain explanation
Each session maps to a Telegram forum topic (or falls back to the flat DM when topics aren't
available). The routing/dedup/render logic already exists and is tested; this phase adds the two
network calls (create/delete a forum topic, token-safe + mockable) and the pure decision of whether to
reuse an existing topic, create one, or use flat fallback — and whether to send the identity header
(once per topic). Mocked Telegram proves it end to end; no live bot.

## Part 2 — diff-level plan

### 1. MODIFY `packages/coding-agent/src/notifications/telegram-api.ts` (+~25 lines)
Add two Telegram calls reusing the existing private `telegramCall` (token sanitized, retry/fatal
classification already applied):
```ts
export async function createForumTopic(opts: { token; chatId; name; fetchImpl? }):
  Promise<TelegramCallOutcome<{ message_thread_id: number }>>;   // method createForumTopic
export async function deleteForumTopic(opts: { token; chatId; messageThreadId; fetchImpl? }):
  Promise<TelegramCallOutcome<true>>;                            // method deleteForumTopic (result: true)
```

### 2. NEW `packages/coding-agent/src/notifications/threaded-lifecycle.ts` (~45 lines, unit-tested)
A pure decision over registry state + threaded capability:
```ts
export type TopicActionDecision =
  | { action: "reuse"; messageThreadId: number; needsIdentity: boolean }
  | { action: "create"; needsIdentity: true }
  | { action: "flat-fallback"; needsIdentity: boolean };
export function decideTopicAction(input: {
  threadedSupported: boolean;
  existing?: { messageThreadId: number; identitySent: boolean };
}): TopicActionDecision;
```
- `!threadedSupported` → `flat-fallback` (notifications still delivered), `needsIdentity = !existing?.identitySent`.
- `existing` (threaded) → `reuse` w/ `messageThreadId`, `needsIdentity = !existing.identitySent`.
- else → `create`, `needsIdentity: true`. Identity header is therefore sent exactly once per topic.

### 3. MODIFY `packages/coding-agent/src/notifications/index.ts` — export threaded-lifecycle.

### Tests
- `notifications-telegram-api.test.ts` (+): `createForumTopic` ok → `message_thread_id`; error path
  retryable/fatal + token sanitized; `deleteForumTopic` ok → true; failure tolerated (best-effort).
- NEW `notifications-threaded-lifecycle.test.ts`: flat-fallback when unsupported; reuse existing (no
  re-identity once sent); create when none; identity-once across reuse.

### NEW devlog `411_audit`, `412_build`, `413_check`.

## PABCD
- **A**: independent audit — telegramCall reuse for create/delete (token-safe), getUpdates-style
  outcome shape, decideTopicAction covers all 6 done-gate behaviors with the existing
  registry/classifier, no token logs. CLOSURE ruling: with the topic client + decision + the phase-4
  model/render/classifier, are all 6 `10.031` done-gates demonstrably met (close), or does a gate need
  live daemon wiring (NARROW, keep open)?
- **B**: Boss writes client calls + decision + tests.
- **C**: telegram-api + threaded-lifecycle + full notifications regression + check:types + biome + diff-check.
- **D**: close `10.031` to `_fin` if A confirms; document live createForumTopic daemon wiring + media
  inbound (10.034) as residual. Else keep open.

## Constraints
- Token never logged; fetch injected; flat fallback never drops notifications; inbound stays fail-closed.
- `.jwc` paths. ES modules; files ≤400 lines.
