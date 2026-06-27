# 94 Phase 9 split — 10.052 docs external integrations

## Source card

`struct_har/chase/10.052_gjc_chase_docs_external_integrations.md`

## JWC posture

Split external integration docs by implemented JWC surface. Upstream docs are source evidence; JWC-facing docs must not describe speculative integrations as available product behavior.

## Existing JWC owners

| Surface | JWC owner |
|---|---|
| Grok Build/provider docs | `docs/grok-build-provider-design.md`; provider/model docs and tests |
| Hermes/MCP/bridge docs | `docs/hermes-mcp-bridge.md`; `docs/bridge.md`; runtime MCP owners/tests |
| notifications and Telegram docs | `docs/notifications-sdk.md`; `docs/telegram-onboarding.md`; notification tests |
| tool docs | `docs/tools/**`; `scripts/verify-jwc-skill-docs.ts`; docs utility tests |
| integration indexes | `docs/codebase-overview.md`; `docs/tree.md`; generated internal docs index if intentionally regenerated |

## Candidate slices

| Slice | Allowed future scope | Required evidence |
|---|---|---|
| `10.052-A` | Inventory stale external docs, brand names, and unsupported integration claims. | docs sweep/tests; no stale `gjc` product command instructions. |
| `10.052-B` | Align Grok Build, Hermes MCP, bridge, CodeGraph, and generic controller docs with implemented JWC surfaces. | docs tests and owner code references. |
| `10.052-C` | Reconcile notification/Telegram/remote docs with Phase 1-4 notification implementation evidence. | notification docs tests and chase cross-links. |

## Reject/defer

- Documenting external integrations as available without implemented JWC code/tests.
- Copying upstream GJC remote/controller docs without JWC naming and capability translation.
- Regenerating large docs indexes unless the change explicitly owns the generator output.

## Done-gate status

No `10.052` done-gate is closed by this split. The card remains active.
