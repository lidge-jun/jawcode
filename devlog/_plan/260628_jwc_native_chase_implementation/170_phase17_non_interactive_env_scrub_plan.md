# 170 Phase 17 plan — non-interactive env scrub

## Work-phase

Phase 17 implements the coordinated `10.037-B` / `10.047-B` non-interactive environment scrub slice.

## Goal slice

`10.037-B` allows env scrub expansion only when current JWC misses concrete risky variables. `10.047-B` owns the security policy for that same scrub. Current inspection found:

- `packages/coding-agent/src/exec/non-interactive-env.ts` only adds non-interactive defaults such as `GIT_TERMINAL_PROMPT=0`, pager disables, and CI flags.
- `packages/coding-agent/src/exec/bash-executor.ts` passes `Settings.getShellConfig().env` into the persistent shell `sessionEnv`, and passes `{ ...NON_INTERACTIVE_ENV, ...options.env }` into each command run.
- There is no dedicated before/after fixture proving credential-like inherited env keys are removed from non-interactive bash execution.

Concrete risky variables already documented by JWC include provider/API/OAuth tokens and broker/bridge tokens in `docs/environment-variables.md` and `docs/secrets.md`.

## Planned changes

### MODIFY `packages/coding-agent/src/exec/non-interactive-env.ts`

Add exported helpers next to `NON_INTERACTIVE_ENV`:

```ts
export function isSensitiveNonInteractiveEnvName(name: string): boolean;

export function scrubNonInteractiveEnv(
  env: Record<string, string | undefined> | undefined,
): Record<string, string> | undefined;

export function buildNonInteractiveEnv(
  env: Record<string, string | undefined> | undefined,
): Record<string, string>;
```

Behavior:

- Reuse the shared secret-name classifier from `packages/coding-agent/src/secrets/index.ts` instead of forking the regex.
- Drop keys whose names match the sensitive pattern unless they are in a narrow operational allowlist.
- Preserve operational auth-socket variables that are not credential material, at minimum `SSH_AUTH_SOCK` and `SSH_AGENT_PID`, because git/ssh over agent must keep working in non-interactive shells.
- Preserve non-sensitive values.
- Return `undefined` from `scrubNonInteractiveEnv` if nothing remains.
- `buildNonInteractiveEnv(env)` returns `{ ...(scrubNonInteractiveEnv(env) ?? {}), ...NON_INTERACTIVE_ENV }` so non-interactive safety defaults win over user-command env on key collisions.

### MODIFY `packages/coding-agent/src/secrets/index.ts`

Export the existing secret env-name pattern through a small predicate:

```ts
export function isSecretEnvName(name: string): boolean;
```

This keeps the env scrub policy aligned with secret obfuscation without importing the full obfuscator.

### MODIFY `packages/coding-agent/src/exec/bash-executor.ts`

Use the helper in both env paths:

- `shellEnv` from settings becomes `scrubNonInteractiveEnv(rawShellEnv) ?? {}` immediately after `Settings.getShellConfig()`.
- The scrubbed `shellEnv` is used before `getOrCreateSnapshot(shell, shellEnv)`, before constructing/reusing persistent shell sessions, and before `buildSessionKey(...)`.
- per-command `options.env` becomes `buildNonInteractiveEnv(options?.env)` instead of `{ ...NON_INTERACTIVE_ENV, ...options.env }`.
- session key construction must use the scrubbed shell env so secret-only differences do not create separate persistent shell sessions.

No command output redaction behavior changes.

### MODIFY `packages/coding-agent/test/bash-executor.test.ts`

Add focused regression tests:

1. `executeBash` does not expose sensitive per-command env:
   - pass `OPENAI_API_KEY`, `JWC_BRIDGE_TOKEN`, `UNSAFE_TOKEN`, and `SAFE_VALUE`.
   - command prints those values.
   - assert secret values are absent and `SAFE_VALUE` remains.

2. `executeBash` does not expose sensitive shell config env:
   - mock `Settings.prototype.getShellConfig()` with `OPENAI_API_KEY`, `JWC_AUTH_BROKER_TOKEN`, safe `PI_TEST_ENV`, and operational `SSH_AUTH_SOCK`.
   - command prints values.
   - assert secret values are absent while safe shell env and `SSH_AUTH_SOCK` remain.

3. existing non-interactive defaults still win:
   - pass `GIT_TERMINAL_PROMPT: "1"` and assert output still shows `0`.

4. helper-level tests prove `isSensitiveNonInteractiveEnvName("SSH_AUTH_SOCK")` is false while `OPENAI_API_KEY` and `JWC_AUTH_BROKER_TOKEN` are true.
   - also assert `isSensitiveNonInteractiveEnvName("SSH_AGENT_PID")` is false.

### MODIFY `struct_har/chase/10.037_gjc_chase_runtime_process_lifecycle_hardening.md`

Append Phase 17 partial evidence for `10.037-B`; keep card active.

### MODIFY `struct_har/chase/10.047_gjc_chase_security_privacy_guardrails.md`

Append Phase 17 partial evidence for `10.047-B`; keep card active unless all remaining `10.047` slices are proven closed.

### NEW `171_phase17_non_interactive_env_scrub_audit.md`

Record plan audit.

### NEW `172_phase17_non_interactive_env_scrub_build.md`

Record implementation and verifier result.

### NEW `173_phase17_non_interactive_env_scrub_check.md`

Record final checks and commit evidence.

## Boundaries

- No provider credential resolution changes (`10.036`).
- No auth-gateway/browser-origin changes (`10.047-C`, already covered by Phase 16).
- No RPC/socket changes (`10.038`).
- No broad process lifecycle/DAP/LSP cleanup (`10.037-A/C`).
- No user-visible docs promotion in this phase; chase/devlog evidence only.
- Do not stage pre-existing `devlog/.gitignore` or `devlog/_tmp/`.

## Verification plan

```bash
bun test packages/coding-agent/test/bash-executor.test.ts
bunx biome check packages/coding-agent/src/secrets/index.ts packages/coding-agent/src/exec/non-interactive-env.ts packages/coding-agent/src/exec/bash-executor.ts packages/coding-agent/test/bash-executor.test.ts
cd packages/coding-agent && bun run check:types
git diff --check -- packages/coding-agent/src/secrets/index.ts packages/coding-agent/src/exec/non-interactive-env.ts packages/coding-agent/src/exec/bash-executor.ts packages/coding-agent/test/bash-executor.test.ts struct_har/chase/10.037_gjc_chase_runtime_process_lifecycle_hardening.md struct_har/chase/10.047_gjc_chase_security_privacy_guardrails.md devlog/_plan/260628_jwc_native_chase_implementation/170_phase17_non_interactive_env_scrub_plan.md devlog/_plan/260628_jwc_native_chase_implementation/171_phase17_non_interactive_env_scrub_audit.md devlog/_plan/260628_jwc_native_chase_implementation/172_phase17_non_interactive_env_scrub_build.md devlog/_plan/260628_jwc_native_chase_implementation/173_phase17_non_interactive_env_scrub_check.md
```

## Commit plan

```bash
git commit -m "fix(security): scrub non-interactive bash env"
```
