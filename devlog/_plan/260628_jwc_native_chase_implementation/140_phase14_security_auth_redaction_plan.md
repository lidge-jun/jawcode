# 140 Phase 14 plan — security auth and redaction regressions

## Goal

Implement a small JWC-native security hardening slice from `10.036-A` and `10.047-A`.

This phase adds regression coverage and only minimal production changes if the red tests prove a concrete gap. It must not bulk-port GJC provider catalog changes, add upstream-only providers, alter Telegram runtime control, or change public product naming.

## Source evidence

| Source | Evidence |
|---|---|
| `10.036` card | Provider credential resolution, project dotenv exclusion, runtime env precedence, broker sentinel non-leak. |
| `10.047` card | Secret/log redaction regression tests for contribution prep, agent-wire envelopes, and logs. |
| `71_phase7_provider_auth_catalog_split.md` | Allows `10.036-A` negative tests only. |
| `74_phase7_security_privacy_split.md` | Allows `10.047-A` redaction regression tests only. |
| GJC upstream | `git -C devlog/_gjc_chase/gajae-code log --oneline --reverse 498d86bb..HEAD -- packages/ai/src packages/ai/test` confirms auth/security commits through `a791d72a`. |

## Threat boundary

| Boundary | Protected asset |
|---|---|
| Config/env/credential resolution | API keys, OAuth access/refresh tokens, account attribution, broker sentinels. |
| Contribution prep artifacts | Recent transcript, git diff, local paths, auth headers, provider env vars. |
| Agent-wire observations | Owner evidence and red-team observations emitted to control surfaces. |

## Planned files

### New files

| Path | Planned change |
|---|---|
| `packages/ai/test/auth-storage-project-dotenv.test.ts` | Add a focused negative test proving project `.env` provider credentials are not loaded into provider credential resolution. |

### Modified files

| Path | Planned change |
|---|---|
| `packages/ai/test/auth-storage-config-override.test.ts` | Add negative tests for runtime override precedence over env/config/storage and env fallback suppression of stale OAuth account attribution. |
| `packages/ai/test/auth-storage-broker-no-sentinel.test.ts` | Add assertion that exported/serialized broker sentinel snapshots never expose raw refresh tokens. |
| `packages/coding-agent/test/contribution-prep.test.ts` | Add provider secret patterns not currently covered by the test fixture, especially OAuth/client-secret style values and common provider cookies. |
| `packages/coding-agent/test/agent-wire/event-observation.redteam.test.ts` | Add bearer/env/private-endpoint shaped payloads to red-team markers and ensure observations remain bounded/redacted. |
| `packages/coding-agent/src/session/contribution-prep.ts` | Modify only if the new contribution-prep red test proves a missing pattern. |
| `packages/coding-agent/src/modes/shared/agent-wire/event-observation.ts` | Modify only if the new agent-wire red test proves a missing redaction/bounding gap. |
| `struct_har/chase/10.036_gjc_chase_ai_provider_auth_model_catalog.md` | Add Phase 14 partial evidence for `10.036-A`; keep card active. |
| `struct_har/chase/10.047_gjc_chase_security_privacy_guardrails.md` | Add Phase 14 partial evidence for `10.047-A`; keep card active. |
| `devlog/_plan/260628_jwc_native_chase_implementation/141_phase14_security_auth_redaction_audit.md` | Audit results and fixes. |
| `devlog/_plan/260628_jwc_native_chase_implementation/142_phase14_security_auth_redaction_build.md` | Files changed, red/green evidence, residual risk. |
| `devlog/_plan/260628_jwc_native_chase_implementation/143_phase14_security_auth_redaction_check.md` | Focused test/type/diff check output and commit evidence. |

## Non-goals

1. No model catalog replacement.
2. No provider additions.
3. No project dotenv provider-credential loading.
4. No auth-gateway browser-origin code in this phase; `10.047-C` remains separate.
5. No env scrub expansion; `10.047-B` remains coordinated with `10.037-B`.
6. No full closure of `10.036` or `10.047`.

## Implementation plan

1. Add focused failing tests first:
   - runtime override beats config, stored OAuth/API keys, and env;
   - project `.env` API keys do not win provider credential resolution and do not populate auth storage;
   - env fallback clears stale OAuth account attribution;
   - broker sentinel paths do not leak raw refresh values;
   - contribution prep redacts additional provider secret fixtures;
   - agent-wire red-team observations redact shaped auth/private endpoint payloads.
2. Run only focused tests to see whether production gaps exist.
3. If tests fail due to real redaction gaps, add the smallest shared redaction helper or pattern in the owner module.
4. Re-run focused tests.
5. Run package typecheck for changed packages:
   - `cd packages/ai && bun run check:types`
   - `cd packages/coding-agent && bun run check:types`
6. Update chase cards with partial Phase 14 evidence and keep both active.

## Verification

Required checks:

```text
bun test packages/ai/test/auth-storage-config-override.test.ts packages/ai/test/auth-storage-broker-no-sentinel.test.ts
bun test packages/ai/test/auth-storage-project-dotenv.test.ts
bun test packages/coding-agent/test/contribution-prep.test.ts packages/coding-agent/test/agent-wire/event-observation.redteam.test.ts
cd packages/ai && bun run check:types
cd packages/coding-agent && bun run check:types
git diff --check -- <changed files>
```

## Reviewer requirements

Because this is C4 security hardening, A phase requires Backend/security audit. B phase requires Backend verification after implementation.
