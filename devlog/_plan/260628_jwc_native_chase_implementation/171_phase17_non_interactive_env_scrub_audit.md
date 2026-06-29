# 171 Phase 17 audit — non-interactive env scrub

Phase 17 A-phase audit record.

## Backend audit 1

Verdict: NEEDS_FIX.

Findings:

- Planned helpers are feasible, but the regex duplicated the canonical secret env-name pattern in `packages/coding-agent/src/secrets/index.ts`.
- `SSH_AUTH_SOCK` would be a false positive because the proposed pattern included `AUTH`; Python runtime already preserves `SSH_AUTH_SOCK` / `SSH_AGENT_PID` as operational env.
- `scrubNonInteractiveEnv` can return `undefined`, but `buildSessionKey` expects a record, so `bash-executor.ts` must use `?? {}` at the assignment site.
- Scrub must happen immediately after `Settings.getShellConfig()`, before `getOrCreateSnapshot`, session construction, and `buildSessionKey`.
- Tests need to prove operational env preservation, not only secret removal.

Plan fixes applied:

- Add `isSecretEnvName()` export in `packages/coding-agent/src/secrets/index.ts` and reuse it from `non-interactive-env.ts`.
- Add operational allowlist for `SSH_AUTH_SOCK` and `SSH_AGENT_PID`.
- Require `const shellEnv = scrubNonInteractiveEnv(rawShellEnv) ?? {}` before snapshot/session/session-key.
- Add tests for `SSH_AUTH_SOCK` preservation and helper classification.

## Backend audit 2

Verdict: NEEDS_FIX.

Findings:

- Reuse/export `isSecretEnvName`, operational allowlist, scrub-before-snapshot ordering, `?? {}`, and scope boundaries all passed.
- The plan still stated the wrong `buildNonInteractiveEnv` merge order: `{ ...NON_INTERACTIVE_ENV, ...scrubbedEnv }` lets user env override `GIT_TERMINAL_PROMPT=0`, contradicting the planned default-wins regression.

Plan fix applied:

- `buildNonInteractiveEnv(env)` now returns `{ ...(scrubNonInteractiveEnv(env) ?? {}), ...NON_INTERACTIVE_ENV }` so `NON_INTERACTIVE_ENV` wins on collisions.
- Helper tests now also include `SSH_AGENT_PID` as non-sensitive.

## Backend audit 3

Verdict: PASS.

Final re-audit confirmed:

- `buildNonInteractiveEnv` merge order now makes `NON_INTERACTIVE_ENV` win over scrubbed user env.
- The `GIT_TERMINAL_PROMPT=1` -> `0` test aligns with the helper spec.
- `isSecretEnvName` reuse, SSH operational allowlist, scrub-before-snapshot ordering, `?? {}`, and scope boundaries remain valid.
- No new blockers were introduced.
