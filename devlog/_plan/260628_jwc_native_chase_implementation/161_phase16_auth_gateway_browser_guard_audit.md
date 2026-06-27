# 161 Phase 16 audit — auth-gateway browser guard

Phase 16 A-phase audit record.

## Backend audit 1

Verdict: NEEDS_FIX.

Findings:

- The real APIs exist: `startAuthGateway` gates all non-`OPTIONS`/`/healthz` routes through `isAuthorized`, and `corsHeaders` emits wildcard CORS headers.
- The original plan incorrectly targeted `packages/ai/test/auth-gateway-openai-responses.test.ts`; that file is a wire-format unit test file and has no HTTP integration harness.
- The authenticated `POST /v1/responses` success path would require mocking `streamSimple`, which is unnecessary for this security slice.
- The plan needed an explicit ephemeral bind (`127.0.0.1:0`) plus close teardown to avoid port collisions.
- JWC-facing naming cleanup and ownership boundaries passed.

Fix applied to plan:

- New dedicated test file: `packages/ai/test/auth-gateway-browser-origin.test.ts`.
- Use a minimal in-memory `AuthStorage` fixture and `startAuthGateway({ bind: "127.0.0.1:0" })`.
- Keep negative checks on unauthenticated real routes (`GET /v1/models`, `POST /v1/responses`) and use authenticated `GET /v1/models` for success.
- Update verification commands to the new focused test path.

## Backend audit 2

Verdict: PASS.

Re-audit confirmed:

- Dedicated HTTP integration test file and harness are feasible.
- `AuthCredentialStore` in-memory fixture, `127.0.0.1:0`, gateway `handle.close()`, and `AuthStorage.close()` match existing test patterns.
- Origin negative checks exercise the real auth gate, and authenticated `GET /v1/models` avoids provider stream mocking.
- Verification paths now target `packages/ai/test/auth-gateway-browser-origin.test.ts`.

Decision: proceed to B implementation.
