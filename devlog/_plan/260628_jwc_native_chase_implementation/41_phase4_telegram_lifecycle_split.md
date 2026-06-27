# 41 Phase 4 split — 10.033 Telegram session lifecycle

## Source card

`struct_har/chase/10.033_gjc_chase_telegram_session_lifecycle.md`

## JWC posture

Treat as high-risk remote process/session control. Only parser, reason-code, and read-only metadata slices are candidates before a later architecture/security PABCD decides whether Telegram may create, close, or resume sessions at all.

## Adapt candidates

| Slice | Candidate | Allowed now | Required future tests |
|---|---|---|---|
| `10.033-A` | Lifecycle command parser | Yes, pure parser for `/sessions`, `/close`, `/resume`, `/new` grammar into inert intents. | malformed command, unknown command, bounded error codes, no shell execution |
| `10.033-B` | Read-only recent/list model | Maybe, only from already-local metadata and only after privacy review. | wrong chat, no mapped session, metadata minimization |
| `10.033-C` | Audit ledger schema | Maybe, docs/schema first. | idempotency key replay, no token/chat/path secrets |

## Reject for now

- Creating a new local agent process directly from Telegram.
- Accepting arbitrary cwd, prompt, profile, model, shell command, or environment values from Telegram.
- Closing/killing a process from an unmapped chat/topic.
- Resuming sessions by fuzzy title or unvalidated path.

## Defer

| Upstream behavior | Deferred until |
|---|---|
| remote create session | explicit product/security decision and allowlisted project roots |
| remote close session | owner-scoped process control and audit ledger |
| remote resume session | safe session id registry and authorization model |
| recent activity listing | privacy-minimized metadata policy |
| daemon attach for lifecycle control | managed daemon runtime exists |

## Security constraints for later implementation

1. Every lifecycle command must be paired-chat-only and mapped-session/topic-aware.
2. Create/resume paths must be allowlisted and realpath-confined.
3. Close must target a JWC-owned session process only, never arbitrary pid.
4. Idempotency ledger must record request/result without raw secrets.
5. Read-only listing must minimize repo/path metadata and support opt-out.

## Done-gate status after this split

No `10.033` done-gate is closed by this docs-only split. The card remains active.

