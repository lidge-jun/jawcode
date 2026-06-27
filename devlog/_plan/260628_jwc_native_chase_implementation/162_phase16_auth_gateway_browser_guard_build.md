# 162 Phase 16 build — auth-gateway browser guard

Phase 16 B-phase build record.

## Implementation

Phase 16 implements a focused `10.047-C` security regression slice and narrow naming cleanup.

Changed files:

| Path | Change |
|---|---|
| `packages/ai/test/auth-gateway-browser-origin.test.ts` | Added dedicated HTTP integration regression for browser-origin auth-gateway behavior. |
| `packages/coding-agent/src/commands/auth-gateway.ts` | Updated JWC-facing command examples/help prefix from `gjc` to `jwc`. |
| `packages/coding-agent/src/cli/auth-gateway-cli.ts` | Updated JWC-facing auth-gateway help/error text to `jwc` and `JWC_AUTH_BROKER_URL`; runtime env fallback behavior unchanged. |
| `struct_har/chase/10.047_gjc_chase_security_privacy_guardrails.md` | Added Phase 16 partial evidence and kept card active. |

## Behavior covered

- Browser-origin `OPTIONS /v1/responses` receives CORS headers without bearer auth.
- Browser-origin real routes (`GET /v1/models`, `POST /v1/responses`) return 401 without bearer auth.
- Browser-origin `GET /v1/models` succeeds with bearer auth and does not require provider streaming mocks.

## Scope boundaries preserved

- No provider credential behavior changes (`10.036`).
- No RPC/socket behavior changes (`10.038`).
- No env scrub expansion (`10.047-B`).
- No auth-gateway endpoint or CORS policy redesign.

## Local verification during B

- `bun test packages/ai/test/auth-gateway-browser-origin.test.ts` — 1 pass / 0 fail / 12 expect() calls.
- `bunx biome check --write packages/ai/test/auth-gateway-browser-origin.test.ts packages/coding-agent/src/commands/auth-gateway.ts packages/coding-agent/src/cli/auth-gateway-cli.ts` — fixed import ordering only.

## Backend verification

Verdict: DONE.

Evidence:

- `packages/ai/test/auth-gateway-browser-origin.test.ts` covers OPTIONS preflight CORS, unauthenticated browser-origin `GET /v1/models` 401, unauthenticated browser-origin `POST /v1/responses` 401, authenticated browser-origin `GET /v1/models` 200, `127.0.0.1:0`, and teardown.
- Backend ran `bun test packages/ai/test/auth-gateway-browser-origin.test.ts` — 1 pass / 0 fail / 12 expect() calls.
- Backend ran scoped `biome check`, `packages/ai` `check:types`, and `git diff --check` — clean.
- Backend verified auth-gateway CLI changes are text-only and do not touch provider credential behavior, RPC/socket behavior, or env scrub.
