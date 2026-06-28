# 563 Phase 56 check — 10.035 docs/release rollup

> All gates green. Card 10.035 CLOSED — Telegram stack (10.028–10.035) complete.

## Tests
- `bun test test/notifications-docs.test.ts` → **7 pass / 0 fail / 54 expect()**.
  New coverage: bot-integration distinction, no hosted-bot overclaim, shipped `telegram_send`
  framing, Discord/Slack still deferred.

## Static / leak
- `bun run check:types` → exit 0 (no code change; sanity).
- `git diff --check` → exit 0.
- `rg -n "gjc notify|\.gjc/state|GJC_NOTIFICATIONS" docs` → only the two intentional
  `GJC_NOTIFICATIONS*` backward-compatibility notes; no public `gjc notify`, no `.gjc/state`.

## 10.035 — CLOSED
All 5 done-gates met: sdk doc matches shipped JWC subset; onboarding uses jwc/.jwc/JWC_*;
bot-integration distinguishes JWC-native vs cli-jaw channel send; Shipped/Deferred matrix is the
release positioning and does not overclaim Discord/Slack/lifecycle; docs tests assert no raw token
and no stale `gjc notify`. Residual (product decision, not code gap): Discord/Slack adapters and live
production bot deployment (operator runtime).

**Telegram stack 10.028–10.035 fully closed.**
