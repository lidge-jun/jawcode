# 100 Phase 10 split — 20.010 OMP AI OAuth and reasoning replay

## Source card

`struct_har/chase/20.010_omp_chase_ai_oauth_reasoning_replay.md`

## JWC posture

Reference-only split. OMP OAuth/account-selection/reasoning replay is evidence for JWC-native provider/auth hardening, not a port source. Any implementation must coordinate with GJC `10.036` and JWC `@jawcode-dev/ai` owners.

## Existing JWC owners

| Surface | JWC owner |
|---|---|
| OAuth providers | `packages/ai/src/utils/oauth/**`; OAuth tests |
| auth storage and broker | `packages/ai/src/auth-storage.ts`; `packages/ai/src/auth-broker/**`; auth-storage/broker tests |
| provider/model catalog | `packages/ai/src/model-manager.ts`; `packages/ai/src/provider-models/**`; `packages/coding-agent/src/config/model-registry.ts`; model tests |
| reasoning/thinking replay | `packages/ai/src/providers/openai-responses*.ts`; `packages/ai/src/model-thinking.ts`; provider tests |

## Split decisions

| Slice | Decision | Rationale | Required future evidence |
|---|---|---|---|
| `20.010-A` OAuth account selection/listing | adapt only through JWC auth-storage/broker UX | overlaps GJC `10.036`; avoid OMP account model copy | auth-storage and OAuth provider tests |
| `20.010-B` credential refresh/quota rotation | split/security review | token refresh/race and quota behavior are security-sensitive | auth-broker refresh/skew/race tests, no token logs |
| `20.010-C` reasoning/context replay | defer to provider-specific JWC replay tests | OMP snapshot parity would be brittle | provider response/replay tests with JWC message schema |
| `20.010-D` provider proxy/catalog updates | reject bulk import | JWC catalog support must be provider-by-provider | model-manager/model-registry tests |

## Reject/defer

- Do not copy OMP OAuth store shape or catalog entries.
- Do not introduce provider IDs without JWC support and tests.
- Do not implement token/quota rotation without security review.

## Done-gate status

No `20.010` done-gate is closed by this split. The card remains reference-only and active.
