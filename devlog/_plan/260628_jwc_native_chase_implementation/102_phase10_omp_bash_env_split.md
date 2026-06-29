# 102 Phase 10 split — 20.012 OMP bash snapshot and env security

## Source card

`struct_har/chase/20.012_omp_chase_bash_snapshot_env_security.md`

## JWC posture

Reference-only split with security review requirement. Bash snapshot/env behavior touches command execution, environment propagation, secrets, and token-bearing git operations; no code may land before a dedicated C4 PABCD cycle.

## Existing JWC owners

| Surface | JWC owner |
|---|---|
| bash execution | `packages/coding-agent/src/exec/bash-executor.ts`; `packages/coding-agent/src/tools/bash.ts`; bash tests |
| environment scrub | `packages/coding-agent/src/exec/non-interactive-env.ts`; env/security tests |
| command fixups/prefixes | `packages/coding-agent/src/tools/bash-command-fixup.ts`; `bash-allowed-prefixes.ts`; command tests |
| secrets/privacy | `packages/coding-agent/src/secrets/**`; `docs/secrets.md`; redaction tests |
| shell/native crates | `crates/pi-shell/**`; `crates/brush-core-vendored/**` |

## Split decisions

| Slice | Decision | Rationale | Required future evidence |
|---|---|---|---|
| `20.012-A` alias/filter/Windows wrapping | adapt only with shell tests | OMP brush behavior may not match JWC shell stack | bash executor/fixup tests |
| `20.012-B` background shell preservation | split with process-lifecycle review | can affect long-running tool semantics | bash detach/background tests |
| `20.012-C` env re-export/snapshot permissions | security review required | secret exposure risk | env scrub and permission negative tests |
| `20.012-D` token-bearing git op refusal | adapt only if JWC lacks equivalent guard | overlaps GJC `10.047` privacy/security | secrets/redaction/bash tests |

## Reject/defer

- Do not copy OMP env snapshot implementation.
- Do not expand environment propagation without denylist/allowlist tests.
- Do not modify shell/native crates in this docs-first split.

## Done-gate status

No `20.012` done-gate is closed by this split. The card remains reference-only and active.
