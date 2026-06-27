# 142 Phase 14 build — security auth and redaction regressions

## Build summary

Phase 14 implements a small C4 security regression slice for `10.036-A` and `10.047-A`.

## Files changed

| File | Change |
|---|---|
| `packages/ai/test/auth-storage-project-dotenv.test.ts` | Added negative test proving project `.env` provider credentials are not loaded into env fallback or auth storage. |
| `packages/ai/test/auth-storage-config-override.test.ts` | Added runtime override/env fallback attribution regression tests. |
| `packages/ai/test/auth-storage-broker-no-sentinel.test.ts` | Added direct `AuthStorage.exportSnapshot()` raw-refresh non-leak assertion. |
| `packages/coding-agent/test/contribution-prep.test.ts` | Added OAuth client secret, refresh token, and provider cookie redaction fixtures. |
| `packages/coding-agent/src/session/contribution-prep.ts` | Extended provider-env redaction to `OAUTH_*` secret names after the new red test exposed a leak. |
| `packages/coding-agent/test/agent-wire/event-observation.redteam.test.ts` | Added shaped authorization/env/private-endpoint payloads to red-team secret markers. |
| `struct_har/chase/10.036_gjc_chase_ai_provider_auth_model_catalog.md` | Added Phase 14 partial `10.036-A` evidence; card remains active. |
| `struct_har/chase/10.047_gjc_chase_security_privacy_guardrails.md` | Added Phase 14 partial `10.047-A` evidence; card remains active. |

## Red/green note

The new contribution-prep fixture initially failed because `OAUTH_CLIENT_SECRET=client-secret-provider-value` was not redacted. The production change is limited to adding `OAUTH` to the existing provider-secret env-name allowlist.

## Residual risk

This phase does not close `10.036` or `10.047`.

- `10.036-B/C` remain open for model catalog/profile drift and onboarding/import hardening.
- `10.047-B` remains open for env scrub expansion with `10.037-B` coordination.
- `10.047-C` remains open for auth-gateway/browser-origin negative tests.
