# 562 Phase 56 build — 10.035 docs/release rollup

> Boss-direct docs build after audit `561` PASS. Closes 10.035.

## Changes
- **`docs/notifications-sdk.md`** (rewrite): transport-agnostic session-endpoint framing + a
  Shipped/Deferred matrix (doubles as release positioning). Shipped = managed daemon logic, threaded
  surface, reply-bridge, lifecycle commands, ask keyboard/callback remote answers, connection-gated
  `telegram_send` egress (each qualified "unit-tested with injected fetch; live = operator token +
  running daemon"). Discord/Slack kept **deferred**. Remote-answer purity + `telegram_send` security
  invariants + secrets/`JWC_NOTIFICATIONS` rules retained.
- **`docs/telegram-onboarding.md`**: accurate opening; "what works now" extended to the shipped subset;
  "still deferred" trimmed to Discord/Slack + live deployment; **Media and files** section rewritten
  to the shipped connection-gated `telegram_send` tool with its enforced invariants (realpath
  workspace confinement, active authorized sink, MIME/size policy, no raw contents/tokens in logs).
  Private-chat-only pairing + Threaded Mode fallback retained.
- **NEW `docs/bot-integration.md`**: distinguishes JWC-native notifications (agent session endpoint:
  ask/answer, threaded topics, lifecycle, `telegram_send`) from cli-jaw channel send
  (`POST /api/channel/send`, one-shot broadcast), with a "choosing" table + secrets note.
- **`packages/coding-agent/test/notifications-docs.test.ts`**: `DOCS` += `bot-integration.md`; new
  truthful assertions — Discord/Slack still deferred (never "supported"), no hosted-bot overclaim
  (every doc keeps "operator"/"running"), `telegram_send` documented as shipped connection-gated
  workspace-confined tool (and NOT "not implemented yet"), bot-integration distinguishes the two
  paths; raw-token / stale-`gjc notify` / `.gjc/state` guards retained.

## Verification handoff
C: `bun test test/notifications-docs.test.ts`, leak scan, check:types. D: close 10.035.
