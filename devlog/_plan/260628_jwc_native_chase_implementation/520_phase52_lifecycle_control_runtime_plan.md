# 520 Phase 52 plan — JWC lifecycle control runtime (closes 10.033)

Card: `struct_har/chase/10.033_gjc_chase_telegram_session_lifecycle.md` (C4, security-heavy).
Upstream evidence only: GJC `lifecycle-control-runtime.ts`/`lifecycle-orchestrator.ts`/`recent-activity.ts`,
`crates/gjc-notifications/src/{control_server,lifecycle}.rs`. JWC reimplements safe inert pieces; no upstream copy.

## Prior slices
- **10.033-A DONE** (phase 11): `lifecycle-command-parser.ts` → inert intents
  `{list|new|close_current|resume(sessionId)}` + bounded rejections. Safe-id regex enforced; no cwd/prompt/
  profile/shell/env accepted from Telegram (parser rejects all arguments except a safe resume id).

## This phase — 10.033-B + 10.033-C + authorization gate (the closing slice)
JWC stance (per card): Telegram-driven **process execution** of new/resume/close stays **deferred** as a
later C4 decision. We build the SAFE control surface around the parsed intent:

1. **Authorization (fail-closed)** — a parsed intent is dispatched only for the paired owner chat; any other
   chat, or a resume/close against a session not owned by that chat, is rejected (`unauthorized` /
   `unknown_session`). Unknown ⇒ reject, never act.
2. **Read-only listing (10.033-B)** — `list` returns a privacy-minimized session summary
   (`sessionId` + short `title` + `updatedAt`) from an injected read-only provider. No secrets, no paths,
   no token, no prompt bodies.
3. **Idempotency ledger + audit (10.033-C)** — every dispatch is recorded to a bounded in-memory
   idempotency ledger keyed by a caller-supplied key; a replayed key returns the first outcome WITHOUT
   re-dispatch. Each dispatch also yields a JSONL-safe audit record (intent kind, chat id, session id,
   outcome, reason, timestamp) that **never contains the bot token or message text**.
4. **Execution deferral** — `new`/`resume`/`close_current` return a bounded
   `{outcome:"execution_deferred", reason:"remote_lifecycle_execution_disabled"}`; they are authorized,
   idempotency-tracked, and audited, but never spawn/kill/attach a process. This is the explicit JWC
   deferral, not a stub: the surface is complete and safe; only the (deferred) execution wiring is absent.

## Files
- NEW `src/notifications/lifecycle-audit.ts` (~90 ln): `LifecycleOutcome`, `LifecycleAuditRecord`,
  `buildLifecycleAuditRecord()` (token/text-free), `LifecycleIdempotencyLedger` (bounded, get/record).
- NEW `src/notifications/lifecycle-control-runtime.ts` (~150 ln): `LifecycleSessionSummary`,
  `LifecycleControlContext` (ownerChatId, chatId, idempotencyKey, listSessions(), ownsSession()),
  `executeLifecycleIntent(intent, ctx, ledger, now)` → outcome + audit record.
- MODIFY `src/notifications/index.ts`: export both.
- NEW `test/notifications-lifecycle-control-runtime.test.ts`: wrong-chat fail-closed; list read-only
  shape (no secrets); new/resume/close → execution_deferred + audited; idempotency replay returns first
  outcome without re-dispatch; resume/close of unowned session → unknown_session; audit record carries
  no token/text.

## Done-gate mapping
| gate | mechanism |
|---|---|
| paired-chat-only | `executeLifecycleIntent` rejects `chatId !== ownerChatId` |
| unknown fails closed | unauthorized / unknown_session rejections; default reject |
| idempotency prevents dup create/close/resume | `LifecycleIdempotencyLedger` replay returns first outcome |
| audit JSONL without secrets | `buildLifecycleAuditRecord` omits token + message text |
| create/resume cannot escape roots | parser admits no cwd/path; resume id is safe-regex only; execution deferred |
| close cannot kill unrelated | `close_current` targets only the mapped owner session; execution deferred |

## Verification
`bun test test/notifications-lifecycle-*.test.ts` + full `notifications-*` regression + `check:types` +
biome + `git diff --check`. Independent C4 audit before B.
