# 75 Phase 7 audit — security, provider, and network guards

## Scope

Audit Phase 7 docs/split artifacts for cards `10.036`, `10.038`, `10.043`, and `10.047`.

## Employee audits

| Auditor | Verdict | Notes |
|---|---|---|
| Backend | PASS after fixes | Validated owner/test paths, JWC identity, no wholesale upstream porting, security boundaries, slice sizing, and focused verification commands. |
| Docs | PASS after fixes | Validated numbering, chase-card links, active status, `_fin` overlap paths, Phase 6/7 env-scrub coordination, `10.038` UDS/listen overlap, and wording alignment. |

## Fixes applied during A

| Issue | Fix |
|---|---|
| `_fin` overlap paths were ambiguous under project-root resolution. | Rewrote inventory paths to `struct_har/chase/_fin/10/...`. |
| Phase 6 `10.037-B` and Phase 7 `10.047-B` both referenced env scrub expansion. | Made `10.047-B` the security-policy owner and required coordination with Phase 6 `10.037-B` runtime-cleanup before code. |
| `10.038-B` overlapped with closed UDS/listen baseline. | Scoped it to work only beyond `struct_har/chase/_fin/10/10.018_gjc_chase_rpc_registry_uds.md`. |
| `10.047` chase card omitted sibling overlap/no-double-ownership. | Added provider/RPC/search ownership delegation and auth-gateway owner paths. |
| Env-scrub tests were implied as existing. | Corrected `74` to state no dedicated env-scrub tests exist yet; future code must add before/after fixture tests. |
| Auth-gateway/bridge owner paths were incomplete. | Added `auth-gateway.ts`, `auth-gateway-cli.ts`, and `modes/bridge/**`; marked no-auth negative tests as TBD before code closes. |
| RPC subprocess tests can false-fail on older Bun. | Added Bun `>= 1.3.14` prerequisite note to `70`. |
| `10.036-A` / `10.047-A` wording drift remained. | Aligned wording across parent plan, split docs, and chase cards. |

## Audit outcome

Phase 7 is safe to continue as a docs-only split/evidence cycle. No runtime credential, RPC socket, URL fetch, or redaction logic should change in this cycle.

