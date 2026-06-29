# 411 Phase 41 audit — Telegram topic lifecycle (independent, read-only)

> Audits plan `410`. Verdict: **NARROW** — build the client+decision; do NOT close 10.031.

## Confirmed
- Private `telegramCall<T>({token, method, query?, fetchImpl?, signal?})` is reusable + token-sanitized
  → `createForumTopic`/`deleteForumTopic` inherit safety.
- Phase-4 `threaded-surface.ts` exports `ThreadTopicRegistry` (dedupe/stale), `classifyThreadInboundUpdate`
  (fail-closed drops), `renderThreadIdentityHeader`/`renderThreadActionNeeded`, inert route.
- No name collisions.

## Done-gate assessment
| Gate | Met | Note |
|---|---|---|
| 1 create-or-flat-fallback no drop | ✅ | decideTopicAction + createForumTopic (mocked) |
| 2 dedupe concurrent create | ✅ | ThreadTopicRegistry + reuse decision |
| 3 inbound wrong-chat/unknown/dup ignored | ✅ | classifyThreadInboundUpdate (phase 4) |
| 4 in-topic free text injects only to mapped session | ❌ | classifier returns inert route; **live injection needs daemon→ask-bridge wiring** (deferred) |
| 5 identity header once per topic | ✅ | decideTopicAction.needsIdentity |
| 6 topic deletion on shutdown best-effort | ❌ | deleteForumTopic exists but **no shutdown hook calls it** (runtime) |

## Closure ruling
**closeable: false.** Gates #4 (live route→session injection) and #6 (shutdown delete hook) require
daemon runtime wiring this phase does not provide; phase-4 split explicitly deferred free-text
injection + topic delete runtime integration. Build phase 41 (valuable client+decision), keep 10.031
OPEN, residual = inbound route→ask-bridge injection + session-shutdown delete hook (phase 42).
