# 74 Phase 7 split — 10.047 security and privacy guardrails

## Source card

`struct_har/chase/10.047_gjc_chase_security_privacy_guardrails.md`

## JWC posture

Adapt security/privacy guardrails only where JWC has a clear boundary owner and regression harness. This card overlaps `10.036`, `10.038`, and `10.043`; future code must avoid double-owning the same behavior.

## Existing JWC owners

| Surface | JWC owner |
|---|---|
| secrets obfuscation | `packages/coding-agent/src/secrets/**`; `packages/coding-agent/test/secrets-obfuscator.test.ts` |
| contribution/privacy redaction | `packages/coding-agent/src/session/contribution-prep.ts`; `docs/onboarding-receipt.md` |
| event envelope redaction | `packages/coding-agent/src/modes/shared/agent-wire/event-envelope.ts`; agent-wire redteam tests |
| non-interactive env scrub | `packages/coding-agent/src/exec/non-interactive-env.ts`; no dedicated env-scrub test yet, so `10.047-B` must add before/after fixture tests before code closes. |
| auth-gateway / bridge no-auth guard | `packages/coding-agent/src/commands/auth-gateway.ts`; `packages/coding-agent/src/cli/auth-gateway-cli.ts`; `packages/coding-agent/src/modes/bridge/**`; bridge/auth-gateway negative tests |
| environment docs | `docs/secrets.md`; `docs/environment-variables.md` |

## Candidate slices

| Slice | Allowed future scope | Required evidence |
|---|---|---|
| `10.047-A` | Secret/log redaction regression tests for contribution prep, agent-wire envelopes, and logs. | redteam tests with raw secret fixture absent from output. |
| `10.047-B` | Security-policy owner for non-interactive env scrub expansion if concrete risky variables are missing; coordinate with Phase 6 `10.037-B` runtime cleanup before code. | before/after env fixture tests plus `10.037-B` cross-check. |
| `10.047-C` | Browser-origin/auth-gateway no-auth guard if current JWC has a matching surface gap; gap is TBD because bridge token helper tests exist but dedicated auth-gateway no-auth negative tests are not yet proven. | auth-gateway/bridge negative tests before code closes. |

## Reject/defer

- Duplicating ownership already selected by `10.036`, `10.038`, or `10.043`.
- Logging raw provider/API/OAuth tokens in test output, docs, or chase evidence.
- Broad privacy policy docs without executable or source-evidence-backed constraints.

## Done-gate status

No `10.047` done-gate is closed by this split. The card remains active.
