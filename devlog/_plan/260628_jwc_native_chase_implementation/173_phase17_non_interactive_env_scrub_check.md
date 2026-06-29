# 173 Phase 17 check — non-interactive env scrub

Phase 17 C-phase check record.

## Commands

```bash
bun test packages/coding-agent/test/bash-executor.test.ts
bunx biome check packages/coding-agent/src/secrets/index.ts packages/coding-agent/src/exec/non-interactive-env.ts packages/coding-agent/src/exec/bash-executor.ts packages/coding-agent/test/bash-executor.test.ts
cd packages/coding-agent && bun run check:types
git diff --check -- packages/coding-agent/src/secrets/index.ts packages/coding-agent/src/exec/non-interactive-env.ts packages/coding-agent/src/exec/bash-executor.ts packages/coding-agent/test/bash-executor.test.ts struct_har/chase/10.037_gjc_chase_runtime_process_lifecycle_hardening.md struct_har/chase/10.047_gjc_chase_security_privacy_guardrails.md devlog/_plan/260628_jwc_native_chase_implementation/170_phase17_non_interactive_env_scrub_plan.md devlog/_plan/260628_jwc_native_chase_implementation/171_phase17_non_interactive_env_scrub_audit.md devlog/_plan/260628_jwc_native_chase_implementation/172_phase17_non_interactive_env_scrub_build.md devlog/_plan/260628_jwc_native_chase_implementation/173_phase17_non_interactive_env_scrub_check.md
```

## Results

| Check | Result |
|---|---|
| Focused bash-executor suite | 33 pass / 0 fail / 99 expect() calls |
| Scoped biome check | clean |
| `packages/coding-agent` typecheck | exit 0 |
| scoped `git diff --check` | exit 0 |
| Backend verifier | DONE |

## Scrutiny

- Secret-name policy is shared with obfuscation through `isSecretEnvName`; no duplicate regex.
- `SSH_AUTH_SOCK` and `SSH_AGENT_PID` are preserved as operational auth-agent env, matching Python runtime precedent.
- Scrubbed shell env is used before snapshot, session construction, and session-key build.
- `NON_INTERACTIVE_ENV` wins over user env on key collisions, so prompt-disabling defaults cannot be overridden through bash tool env.
- Phase 17 intentionally does not touch interactive bash, DAP/LSP, provider credential resolution, auth-gateway, or RPC/socket behavior.
- Pre-existing `devlog/.gitignore` and `devlog/_tmp/` remain out of scope and must not be staged.

## Commit

Pending.
