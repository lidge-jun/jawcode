# 71 Phase 7 split — 10.036 provider auth and model catalog

## Source card

`struct_har/chase/10.036_gjc_chase_ai_provider_auth_model_catalog.md`

## JWC posture

Adapt only provider/auth/catalog hardening that preserves JWC's existing `@jawcode-dev/ai` registry, local/broker credential split, and JWC model profile UX. Do not bulk-port upstream model catalog churn.

## Existing JWC owners

| Surface | JWC owner |
|---|---|
| credential storage and broker sentinel | `packages/ai/src/auth-storage.ts`; `packages/ai/src/auth-broker/**`; auth-storage tests |
| provider model registry | `packages/ai/src/model-manager.ts`; `packages/ai/src/provider-models/**`; `packages/coding-agent/src/config/model-registry.ts` |
| model profiles and selector UX | `packages/coding-agent/src/config/model-profiles.ts`; model selector/profile tests |
| onboarding/import | `packages/coding-agent/src/setup/provider-onboarding.ts`; `packages/coding-agent/src/setup/model-onboarding-guidance.ts` |

## Candidate slices

| Slice | Allowed future scope | Required evidence |
|---|---|---|
| `10.036-A` | Negative tests for credential resolution, project dotenv exclusion, runtime env precedence, and broker sentinel non-leak. | auth-storage/config override tests; no raw token logs. |
| `10.036-B` | Catalog/profile drift tests for JWC-supported providers. | model-manager/profile tests with explicit provider IDs. |
| `10.036-C` | Credential import/onboarding hardening if current JWC UX has a concrete gap. | setup/onboarding tests and docs using `jwc`. |

## Reject/defer

- Bulk `models.json` replacement from upstream.
- Adding upstream-only provider IDs without JWC support and tests.
- Reading project dotenv for provider credentials unless a separate security review explicitly approves it.

## Done-gate status

No `10.036` done-gate is closed by this split. The card remains active.
