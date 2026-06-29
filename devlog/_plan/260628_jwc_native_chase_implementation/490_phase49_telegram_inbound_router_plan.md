# 490 Phase 49 plan — Telegram inbound dispatch router (chase 10.032 live routing, gates 1/2)

> Work-phase 49 of the 10.032 stack. Composes the existing, individually-tested pieces
> (`classifyThreadInboundUpdate` thread→session routing + `decideTelegramCallbackInbound` +
> `decideTelegramMessageInbound`) into ONE pure dispatch-plan function. This is the live-routing seam
> that gates 1/2 (remote answer resolves the active ask; later/duplicate answers rejected) need, without
> the router owning any live state.

## Gap
The daemon tick (`runDaemonTick`) polls Telegram updates but only counts them + advances the offset — no
update is dispatched to a decider or forwarded to a session. The button/free-text deciders exist and are
tested, and `classifyThreadInboundUpdate` already resolves a thread update to a session (fail-closed), but
nothing composes them into "what side effects should this update cause".

## Slice (C3 — pure composition of tested pure deciders; no new external contract)
### NEW `src/notifications/telegram-inbound-router.ts`
- `InboundDispatchAction` (discriminated):
  - `{ kind:"answer_callback"; callbackQueryId; outcome:"accepted"|"rejected"; reason? }` — clear the
    inline-button spinner.
  - `{ kind:"deliver_answer"; sessionId; value; source:"button"|"free_text"; ackMessageId? }` — forward
    the accepted answer to the mapped session (caller runs `forwardTelegramReplyToSession`).
  - `{ kind:"forward_reply"; sessionId; text; updateId }` — in-topic free text with NO active ask =
    ordinary reply for the caller to inject.
  - `{ kind:"drop"; reason }` — fail-closed (wrong_chat / unknown_topic / duplicate / attachment / stale /
    empty / a rejection reason).
- `InboundDispatchPlan = InboundDispatchAction[]` (a button accept yields BOTH an answer_callback ack and
  a deliver_answer).
- `routeTelegramInboundUpdate(update, ctx): InboundDispatchPlan` where
  `ctx = { expectedChatIdFingerprint, presentedToken?, registry: ThreadTopicRegistry, isDuplicateUpdate,
  recordUpdateId?, resolveActionContext:(sessionId)=>RemoteActionContext|undefined }`.
  - **callback_query update**: resolve session via `registry.findByThread(chatFp, threadId)` (derived from
    the callback's chat/thread); dedupe on `update_id`; `resolveActionContext(sessionId)` →
    `decideTelegramCallbackInbound` → accepted ⇒ `[answer_callback accepted, deliver_answer button]`,
    rejected ⇒ `[answer_callback rejected reason]`, unresolved session/context ⇒ `[answer_callback
    rejected stale_action]` (still ack to clear the spinner).
  - **text message update**: `classifyThreadInboundUpdate` → drop ⇒ `[drop reason]`; route ⇒
    `resolveActionContext(sessionId)`; no context ⇒ `[forward_reply]` (ordinary reply); context ⇒
    `decideTelegramMessageInbound` → accepted ⇒ `[deliver_answer free_text ackMessageId]`, rejected ⇒
    `[drop reason]` (fail-closed: a disallowed/late free-text answer is NOT injected).
  - neither callback nor text ⇒ `[drop "unroutable"]`.
- Pure / side-effect-free apart from the injected `recordUpdateId` dedupe hook; token/chat/session never
  embedded or echoed.

## Done-gate mapping (10.032)
Provides the deterministic routing for **gates 1 & 2** (remote answer resolves the active ask; a later
local/remote answer for the same action is rejected via `already_answered` / `idempotency_conflict`). The
actual engine I/O (calling `forwardTelegramReplyToSession` + `answerTelegramCallbackQuery` from the tick)
and the live pending-action → `RemoteActionContext` bridge remain the next phase; this slice is the pure
plan they will execute.

## Verification
New router suite (callback accept→2 actions, callback reject, unresolved callback→ack reject, text drop
variants, text route→no-context forward_reply, text route→accepted deliver, text route→rejected drop,
duplicate dedupe, wrong-chat drop). Full `test/notifications-*.test.ts test/notify-cli.test.ts`;
`check:types`; biome; `git diff --check`. Independent audit attempt before B.
