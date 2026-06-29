# 172 Phase 17 build — non-interactive env scrub

Phase 17 B-phase build record.

## Implementation

Phase 17 implements the coordinated `10.037-B` / `10.047-B` non-interactive bash env scrub subset.

Changed files:

| Path | Change |
|---|---|
| `packages/coding-agent/src/secrets/index.ts` | Added `isSecretEnvName()` so env scrub reuses the canonical secret env-name classifier. |
| `packages/coding-agent/src/exec/non-interactive-env.ts` | Added sensitive-name classification, SSH operational allowlist, scrub helper, and default-winning env builder. |
| `packages/coding-agent/src/exec/bash-executor.ts` | Scrubs shell config env before snapshot/session/session-key and uses default-winning non-interactive command env. |
| `packages/coding-agent/test/bash-executor.test.ts` | Added regressions for command env scrub, shell-config env scrub, safe env preservation, SSH auth socket preservation, and default precedence. |
| `struct_har/chase/10.037_gjc_chase_runtime_process_lifecycle_hardening.md` | Added Phase 17 partial `10.037-B` evidence; card remains active. |
| `struct_har/chase/10.047_gjc_chase_security_privacy_guardrails.md` | Added Phase 17 partial `10.047-B` evidence; card remains active. |

## Scope boundaries preserved

- No provider credential resolution changes (`10.036`).
- No auth-gateway/browser-origin changes (`10.047-C`).
- No RPC/socket changes (`10.038`).
- No DAP/LSP/process-wide lifecycle changes (`10.037-A/C`).

## Local verification during B

- `bun test packages/coding-agent/test/bash-executor.test.ts` — 33 pass / 0 fail / 99 expect() calls.
- `bunx biome check --write packages/coding-agent/src/secrets/index.ts packages/coding-agent/src/exec/non-interactive-env.ts packages/coding-agent/src/exec/bash-executor.ts packages/coding-agent/test/bash-executor.test.ts` — fixed formatting only.
- `cd packages/coding-agent && bun run check:types` — exit 0.

## Backend verification

Verdict: DONE.

Evidence:

- Verified `isSecretEnvName()` export and `collectEnvSecrets()` reuse the same classifier.
- Verified `non-interactive-env.ts` scrubs secret names, preserves `SSH_AUTH_SOCK` / `SSH_AGENT_PID`, and makes `NON_INTERACTIVE_ENV` win over user env.
- Verified `bash-executor.ts` scrubs raw shell env before snapshot/session/session-key and uses `buildNonInteractiveEnv` for command env.
- Ran `bun test test/bash-executor.test.ts` from `packages/coding-agent` — 33 pass / 0 fail.
- Ran `cd packages/coding-agent && bun run check:types`, scoped biome, and scoped `git diff --check` — all exit 0.
