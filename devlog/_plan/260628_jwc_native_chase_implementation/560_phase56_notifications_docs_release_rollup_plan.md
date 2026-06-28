# 560 Phase 56 plan — 10.035 notification adapters/docs/release rollup (CLOSE)

> Final docs/product rollup for the Telegram stack. Cards 10.028–10.034 are all closed to
> `_fin/10`; this slice reconciles the docs surface to the **actually shipped + unit-tested**
> JWC subset, adds bot-integration positioning, and closes 10.035.

## Problem
`docs/notifications-sdk.md` and `docs/telegram-onboarding.md` were written at phase 3 and still mark
as **deferred** capabilities that have since shipped and been unit-tested through phases 28–34:
managed daemon poller logic (10.030), threaded session surface (10.031), reply-bridge mapped-session
injection (10.032 stack), session lifecycle commands (10.033), and the connection-gated
`telegram_send` workspace-confined media tool (10.034). The docs test enforces the stale framing.
There is no `bot-integration.md` and no release-positioning surface.

## Shipped vs deferred (ground truth)
| capability | status | evidence module |
|---|---|---|
| local config/status/verify/pairing | shipped | `config.ts`, `telegram-pairing.ts`, `transport-state.ts` |
| managed singleton daemon (engine/loop/runtime) | shipped (logic, unit-tested w/ injected fetch) | `daemon-engine.ts`, `daemon-loop.ts`, `daemon-runtime.ts` |
| threaded per-session topics + fail-closed inbound | shipped | `threaded-surface.ts`, `threaded-lifecycle.ts`, `threaded-shutdown.ts` |
| reply-bridge mapped-session injection | shipped | `reply-bridge.ts`, `remote-answer.ts` |
| session lifecycle commands from chat | shipped | `session-lifecycle.ts`, `lifecycle-command-parser.ts`, `lifecycle-control-runtime.ts` |
| ask keyboard + callback remote answers | shipped | `telegram-ask-keyboard.ts`, `telegram-callback-ingest.ts` |
| connection-gated `telegram_send` media egress | shipped (workspace-confined, token-safe) | `telegram-media-policy.ts`, `telegram-media-render.ts`, `workspace-path-confinement.ts` |
| Discord / Slack adapters | **deferred** (explicitly rejected until requested) | — |
| live production bot deployment | requires operator token + running daemon | runtime, not a code gap |

## Plan
1. **Rewrite `docs/notifications-sdk.md`**: a Shipped/Deferred matrix (doubles as release positioning so
   nothing overclaims), accurate per-capability framing ("implemented + unit-tested with injected
   fetch; live operation requires an operator-supplied bot token and a running managed daemon"),
   Discord/Slack kept explicitly deferred, secrets/placeholder rules retained.
2. **Update `docs/telegram-onboarding.md`**: replace the stale "media not implemented" section with the
   shipped connection-gated `telegram_send` tool and its enforced security invariants (realpath
   workspace confinement, active authorized sink, MIME/size policy, token/response-body never logged);
   keep Discord/Slack deferred; keep private-chat-only pairing + Threaded Mode fallback.
3. **NEW `docs/bot-integration.md`**: distinguish JWC-native notifications (agent session endpoint,
   ask/answer, threaded session topics, `telegram_send`) from cli-jaw channel send
   (`POST /api/channel/send`) — when to use which, and that they are separate delivery paths.
4. **Update `packages/coding-agent/test/notifications-docs.test.ts`**: extend `DOCS` with
   `bot-integration.md`; keep no-raw-token / no-stale-`gjc notify` / no-`.gjc/state` guards; assert
   Discord/Slack still **not** claimed supported; assert `telegram_send` is documented *with* its
   security invariants (not as "unsupported"); assert bot-integration distinguishes JWC-native vs
   cli-jaw channel send; assert release positioning does not overclaim Discord/Slack/lifecycle.

## Done-gate mapping (10.035)
- sdk doc matches JWC subset → step 1.
- onboarding uses jwc/.jwc/JWC_* → retained + step 2.
- bot-integration distinguishes JWC-native vs cli-jaw channel send → step 3.
- changelog/positioning does not overclaim → Shipped/Deferred matrix (step 1) + test (step 4).
- docs tests assert no raw token + no stale `gjc notify` → step 4.

## Verification
`bun test test/notifications-docs.test.ts`; then
`rg -n "gjc notify|\.gjc/state|GJC_NOTIFICATIONS" docs` (every hit must be an intentional
compatibility note); `bun run check:types` (no code change expected, sanity only).

## Class / risk
C2 docs slice (no runtime/auth code change). Docs-only; sub-agent plan audit, focused docs tests.
Residual after close: Discord/Slack adapters (deferred by product decision), live production bot
deployment (operator runtime, not a code gap).
