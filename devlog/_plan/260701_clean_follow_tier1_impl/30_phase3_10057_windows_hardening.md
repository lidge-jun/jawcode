# 30 Phase 3 — 10.057 Windows hardening

## Classification

Class: C3. This card crosses the update CLI, team worker launch, worktree launch diagnostics, coordinator session-state recovery, and focused tests. It is platform/runtime hardening, not a product/identity decision.

## Part 1 — plain-language outcome

Close `struct_har/chase/10.057_gjc_chase_windows_hardening.md` by making JWC more tolerant on Windows and npm-managed installs. The update command should recognize npm shims and verify package-manager updates, team workers should launch with PowerShell-safe quoting on Windows, and launch/worktree failures should be preserved in coordinator state instead of being masked later as tmux or liveness noise.

Keep JWC naming public-facing: `jwc`, `.jwc`, `jawcode`, and `@jawcode-dev/*`. Internal `GJC_*` team env names remain unless a file already exposes a JWC dual-read path; broad env renaming is out of scope.

## Source classification

| upstream commit | JWC decision | reason |
|---|---|---|
| `6eafcde7` Windows npm-managed update shims | Adopt/adapt now | JWC update path has `jawcode` package naming but no Windows npm `.cmd`/`.ps1` shim detection. |
| `56ffa73e` backup cleanup tolerance | Adopt/adapt now | JWC `replaceBinaryForUpdate()` currently treats backup cleanup failure as fatal after successful binary replacement. |
| `fa995807` package-manager update-state verification | Adopt/adapt now | JWC `updateViaBun()` throws on nonzero install without checking whether the requested runtime now verifies. |
| `7b5fd99b` safe team workers on Windows | Adopt/adapt now | JWC worker command construction is POSIX-only and uses plain env-prefix syntax. |
| `97672024` preserve worktree launch failures | Adopt/adapt now | JWC has bare `worktree_target_mismatch:<path>` errors and does not persist `prepareLaunchWorktree()` failures for coordinator reads. |
| `365e1633` psmux tmux session attach target | Adopt tiny helper only if audit agrees | Exact tmux target quoting is small and platform-safe; full psmux behavior belongs to `10.061`/`10.050`. |
| `9618c21f` keep psmux pane alive | Defer | Full psmux detection/provider and Windows `--tmux` enablement overlap later cards. |
| `1d65050d` v0.7.8 corrected follow-up | Defer | Belongs to `10.061` psmux/tmux title follow-up, not this hardening card. |
| `beec1af0` tmux workspace titles | Defer | Belongs to `10.061`. |

## Current JWC facts checked

- `packages/coding-agent/src/cli/update-cli.ts` uses `PACKAGE = "jawcode"`, preserves `jwc setup defaults`, but lacks npm shim detection, cleanup warnings, and package-manager verification fallback.
- `packages/coding-agent/src/jwc-runtime/team-runtime.ts` has `shellQuote()` only; `resolveJwcWorkerCommand()` depends on `process.argv` and `process.execPath`; `buildWorkerCommand()` is POSIX-only and not exported.
- `packages/coding-agent/src/jwc-runtime/launch-worktree.ts` throws bare `worktree_target_mismatch:<path>` and already uses `.jawcode-worktrees`, which must remain unchanged.
- `packages/coding-agent/src/jwc-runtime/session-state-sidecar.ts` already exports JWC coordinator env constants and deprecated GJC fallbacks.
- `packages/coding-agent/src/coordinator-mcp/server.ts` can mark session-state terminal turns, but currently drops the session state's final response and requires `current_turn_id` to match for errored/completed state recovery.

## Part 2 — diff-level plan

### MODIFY `packages/coding-agent/src/cli/update-cli.ts`

- Add Windows npm shim detection for `.cmd` and `.ps1` wrappers that point at the npm-managed `jawcode` package.
- Route npm-managed Windows shims through `npm install -g jawcode@<version>` rather than binary replacement.
- Add a package-manager update helper used by Bun/npm install paths:
  - run the package-manager install command;
  - if the command exits nonzero, verify the installed `jwc --version` state before failing;
  - return success when the expected runtime version verifies.
- Make `replaceBinaryForUpdate()` tolerate backup cleanup failure after successful replacement by returning a cleanup warning instead of rolling back a verified update.
- Preserve the current post-update `jwc setup defaults` propagation.

### MODIFY `packages/coding-agent/test/update-cli.test.ts`

- Add npm-shim detection tests for Windows `.cmd` and `.ps1` wrappers with JWC `jawcode` package naming.
- Add package-manager install fallback tests: nonzero install plus verified expected version succeeds; nonzero install plus wrong version fails.
- Add backup cleanup tolerance test asserting the replacement result can carry a warning while the target binary remains updated.

### MODIFY `packages/coding-agent/src/jwc-runtime/team-runtime.ts`

- Add `powershellQuote()` for PowerShell single-quoted literals.
- Make `resolveJwcWorkerCommand()` accept optional platform/argv/execPath inputs while keeping current defaults for callers.
- On Windows, invoke `.ts`, `.js`, and `.mjs` entrypoints through the current runtime executable and quote the executable/script with PowerShell-safe literals.
- Export `buildWorkerCommand()` for tests.
- Make `buildWorkerCommand()` platform-aware:
  - POSIX keeps current `KEY=value command prompt` form.
  - Windows emits `$env:KEY = 'value'; ...; & 'command' 'prompt'` form.
- Preserve existing `GJC_TEAM_*` internal env names in this card.

### MODIFY `packages/coding-agent/test/jwc-runtime/team-runtime.test.ts`

- Import `buildWorkerCommand` and the existing worker/config types needed by the test.
- Add Windows-specific tests for:
  - `.ts`/`.js` entrypoint resolution through the runtime executable;
  - PowerShell env assignment quoting;
  - command invocation with `&`;
  - prompts containing quotes/spaces.

### MODIFY `packages/coding-agent/src/jwc-runtime/launch-worktree.ts`

- Replace `worktree_target_mismatch:<path>` with an actionable diagnostic that includes:
  - requested worktree path;
  - existing registered target path;
  - safe remediation direction.
- Keep `.jawcode-worktrees` path derivation exactly as-is.

### MODIFY `packages/coding-agent/test/jwc-runtime/launch-worktree.test.ts`

- Add/adjust mismatch assertions to expect the actionable diagnostic and `.jawcode-worktrees` naming.

### MODIFY `packages/coding-agent/src/commands/launch.ts`

- Import `node:fs/promises`, `node:path`, and coordinator sidecar env constants.
- When `prepareLaunchWorktree()` throws, persist an errored coordinator session-state payload when a session state file is configured.
- Prefer `JWC_COORDINATOR_SESSION_STATE_FILE` and `JWC_COORDINATOR_SESSION_ID`; keep legacy `GJC_*` fallbacks through the sidecar constants.
- Re-throw after persistence so the CLI still exits with the real launch failure.

### MODIFY `packages/coding-agent/src/coordinator-mcp/server.ts`

- Preserve `sessionState.final_response` when terminalizing from session state.
- Allow `readTurnPayload()` to terminalize an active turn from an errored/completed `agent_session_event` state even when `current_turn_id` is `null`, as long as the requested session matches and the turn is active.
- Keep existing completed matching behavior intact.

### MODIFY `packages/coding-agent/test/coordinator-mcp-server.test.ts`

- Add a regression where an errored session-state file with `current_turn_id: null` terminalizes the active turn and exposes the real final response text.

### OPTIONAL SMALL TMUX TARGET HELPER — only if A audit agrees

Potentially modify:

- `packages/coding-agent/src/jwc-runtime/tmux-common.ts`
- `packages/coding-agent/src/jwc-runtime/launch-tmux.ts`
- `packages/coding-agent/src/jwc-runtime/tmux-sessions.ts`
- `packages/coding-agent/test/jwc-runtime/launch-tmux.test.ts`
- `packages/coding-agent/test/jwc-runtime/tmux-sessions.test.ts`

Plan if included:

- Add `buildJwcTmuxExactSessionTarget(sessionName: string): string`.
- Use it for `attach-session` and `kill-session` targets that currently hand-roll `=${sessionName}`.
- Do not import psmux provider detection, encoded PowerShell launch, or Windows `--tmux` enablement in this card.

## Explicit out of scope

- Full psmux detection/provider support from `9618c21f`.
- Windows native `--tmux` enablement.
- v0.7.8 psmux correction follow-up (`1d65050d`).
- tmux/team title work (`10.061`).
- prompt/identity text cleanup outside lines directly touched by tests.
- broad rename from internal `GJC_TEAM_*` env/options to JWC names.

## Documentation closure plan

After code and checks pass:

- Move `struct_har/chase/10.057_gjc_chase_windows_hardening.md` to `struct_har/chase/_fin/10/10.057_gjc_chase_windows_hardening.md`.
- Mark `10.057` done in `struct_har/chase/10_gjc_chase_MOC.md`.
- Mark the matching follow-index row done in `struct_har/chase/007_follow_index.md`.
- Update `struct_har/chase/002_gap_inventory.md` only if it still lists `10.057` as open.
- Add a `10.057` cycle note in `struct_har/chase/10.001_gjc_chase_cycle.md`.
- Add the `_fin` entry in `struct_har/chase/_fin/INDEX.md`.

## Verification plan

Focused tests:

```sh
bun test packages/coding-agent/test/update-cli.test.ts packages/coding-agent/test/jwc-runtime/team-runtime.test.ts packages/coding-agent/test/jwc-runtime/launch-worktree.test.ts packages/coding-agent/test/coordinator-mcp-server.test.ts
```

Optional tmux helper tests if included:

```sh
bun test packages/coding-agent/test/jwc-runtime/launch-tmux.test.ts packages/coding-agent/test/jwc-runtime/tmux-sessions.test.ts
```

Full gates:

```sh
bun run check:ts
git diff --check
```

Review gates:

- A phase: Backend/platform read-only audit of this plan, with special attention to psmux helper scope, JWC naming, source mappings, and coordinator-state risk.
- B phase: read-only verifier after implementation before C.
