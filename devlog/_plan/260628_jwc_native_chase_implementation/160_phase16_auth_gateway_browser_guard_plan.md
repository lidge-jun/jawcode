# 160 Phase 16 plan — auth-gateway browser guard

## Work-phase

Phase 16 implements a focused `10.047-C` security regression slice for the auth-gateway/browser-origin boundary.

## Goal slice

`10.047-C` allows browser-origin/auth-gateway no-auth guards only if JWC has a matching owner gap. Current inspection shows the gateway already answers CORS preflight before auth and gates real routes behind bearer auth, but there is no dedicated regression proving that browser-origin requests cannot use wildcard CORS to bypass auth.

## Source evidence

| Evidence | Path |
|---|---|
| security/privacy split | `devlog/_plan/260628_jwc_native_chase_implementation/74_phase7_security_privacy_split.md` |
| active chase card | `struct_har/chase/10.047_gjc_chase_security_privacy_guardrails.md` |
| gateway auth owner | `packages/ai/src/auth-gateway/server.ts` |
| gateway CORS owner | `packages/ai/src/auth-gateway/http.ts` |
| CLI owner with JWC-facing naming drift | `packages/coding-agent/src/commands/auth-gateway.ts`; `packages/coding-agent/src/cli/auth-gateway-cli.ts` |

## Planned changes

### NEW `packages/ai/test/auth-gateway-browser-origin.test.ts`

Add a dedicated auth-gateway HTTP integration regression:

```ts
test("browser preflight is allowed but real requests still require bearer auth", async () => {
  // Build a minimal AuthStorage with an in-memory AuthCredentialStore fixture.
  // startAuthGateway({ bind: "127.0.0.1:0", bearerTokens: ["secret"], ... })
  // OPTIONS with Origin succeeds and includes CORS headers.
  // GET /v1/models with Origin and no Authorization returns 401.
  // POST /v1/responses with Origin and no Authorization returns 401.
  // GET /v1/models with Origin and Authorization returns 200 and the model catalog.
  // Always await handle.close() and storage.close() in finally.
});
```

This is test-first hardening. It deliberately uses `GET /v1/models` for the authenticated success case so the test does not need to mock provider streaming. If the unauthenticated real-route checks fail because browser-origin requests bypass auth, fix only the existing `startAuthGateway` auth gate; do not introduce a new gateway architecture.

### MODIFY `packages/coding-agent/src/commands/auth-gateway.ts`

Translate JWC-facing command text from `gjc` to `jwc`:

- comment header: `` `gjc auth-gateway` `` -> `` `jwc auth-gateway` ``
- examples: `gjc auth-gateway ...` -> `jwc auth-gateway ...`

No command class, args, or flag behavior changes.

### MODIFY `packages/coding-agent/src/cli/auth-gateway-cli.ts`

Translate JWC-facing strings only:

- file header comment: `` `gjc auth-gateway` `` -> `` `jwc auth-gateway` ``
- missing broker errors: `GJC_AUTH_BROKER_URL` -> `JWC_AUTH_BROKER_URL`
- human status hint: `Set GJC_AUTH_BROKER_URL.` -> `Set JWC_AUTH_BROKER_URL.`
- token creation hint: `gjc auth-gateway ...` -> `jwc auth-gateway ...`
- check command comment/error: `gjc auth-gateway check` -> `jwc auth-gateway check`

Do not rename internal imports, types, storage paths, or env fallback behavior in this phase.

### MODIFY `struct_har/chase/10.047_gjc_chase_security_privacy_guardrails.md`

Append Phase 16 partial evidence:

- `10.047-C` browser-origin negative test added.
- auth-gateway JWC-facing naming drift fixed.
- card remains active because `10.047-B` env scrub and any broader no-auth policy decisions remain open.

### NEW `devlog/_plan/260628_jwc_native_chase_implementation/161_phase16_auth_gateway_browser_guard_audit.md`

Record A-phase employee audit results.

### NEW `devlog/_plan/260628_jwc_native_chase_implementation/162_phase16_auth_gateway_browser_guard_build.md`

Record implementation details and verifier result.

### NEW `devlog/_plan/260628_jwc_native_chase_implementation/163_phase16_auth_gateway_browser_guard_check.md`

Record C-phase focused checks and commit evidence.

## Boundaries

- No broad CORS policy redesign.
- No new auth-gateway endpoint.
- No broker credential behavior changes; those belong to `10.036`.
- No RPC/socket work; that belongs to `10.038`.
- No env scrub expansion; that remains `10.047-B` coordinated with `10.037-B`.
- No staging of pre-existing unrelated `devlog/.gitignore` or `devlog/_tmp/`.

## Verification plan

Run:

```bash
bun test packages/ai/test/auth-gateway-browser-origin.test.ts
bunx biome check packages/ai/test/auth-gateway-browser-origin.test.ts packages/coding-agent/src/commands/auth-gateway.ts packages/coding-agent/src/cli/auth-gateway-cli.ts
cd packages/ai && bun run check:types
cd packages/coding-agent && bun run check:types
git diff --check -- packages/ai/test/auth-gateway-browser-origin.test.ts packages/coding-agent/src/commands/auth-gateway.ts packages/coding-agent/src/cli/auth-gateway-cli.ts struct_har/chase/10.047_gjc_chase_security_privacy_guardrails.md devlog/_plan/260628_jwc_native_chase_implementation/160_phase16_auth_gateway_browser_guard_plan.md devlog/_plan/260628_jwc_native_chase_implementation/161_phase16_auth_gateway_browser_guard_audit.md devlog/_plan/260628_jwc_native_chase_implementation/162_phase16_auth_gateway_browser_guard_build.md devlog/_plan/260628_jwc_native_chase_implementation/163_phase16_auth_gateway_browser_guard_check.md
```

## Commit plan

Stage only the Phase 16 files and commit:

```bash
git commit -m "test(security): guard auth gateway browser requests"
```
