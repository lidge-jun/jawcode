# 163 Phase 16 check — auth-gateway browser guard

Phase 16 C-phase check record.

## Commands

```bash
bun test packages/ai/test/auth-gateway-browser-origin.test.ts
bunx biome check packages/ai/test/auth-gateway-browser-origin.test.ts packages/coding-agent/src/commands/auth-gateway.ts packages/coding-agent/src/cli/auth-gateway-cli.ts
cd packages/ai && bun run check:types
cd packages/coding-agent && bun run check:types
git diff --check -- packages/ai/test/auth-gateway-browser-origin.test.ts packages/coding-agent/src/commands/auth-gateway.ts packages/coding-agent/src/cli/auth-gateway-cli.ts struct_har/chase/10.047_gjc_chase_security_privacy_guardrails.md devlog/_plan/260628_jwc_native_chase_implementation/160_phase16_auth_gateway_browser_guard_plan.md devlog/_plan/260628_jwc_native_chase_implementation/161_phase16_auth_gateway_browser_guard_audit.md devlog/_plan/260628_jwc_native_chase_implementation/162_phase16_auth_gateway_browser_guard_build.md devlog/_plan/260628_jwc_native_chase_implementation/163_phase16_auth_gateway_browser_guard_check.md
```

## Results

| Check | Result |
|---|---|
| Focused auth-gateway test | 1 pass / 0 fail / 12 expect() calls |
| Scoped biome check | clean |
| `packages/ai` typecheck | exit 0 |
| `packages/coding-agent` typecheck | exit 0 |
| scoped `git diff --check` | exit 0 |

## Scrutiny

- Browser-origin requests do not gain extra authority from wildcard CORS; only `OPTIONS` is unauthenticated.
- The authenticated success path uses `GET /v1/models`, avoiding hardcoded provider-stream mocks.
- The test binds to `127.0.0.1:0` and closes both gateway handle and storage in `finally`.
- Command text changes are JWC-facing only; runtime broker/env resolution is unchanged.
- Pre-existing `devlog/.gitignore` and `devlog/_tmp/` remain out of scope and must not be staged.

## Commit

`8a18718` — `test(security): guard auth gateway browser requests`
