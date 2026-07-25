# 40 Phase 4 — 10.061 tmux/team Windows psmux titles

## Part 1 — outcome

Close chase card `10.061` by adapting the GJC v0.7.8 tmux title and Windows/psmux spawn reliability fixes into JWC runtime code. The visible behavior should be JWC-authored: `jwc --tmux` diagnostics and tmux titles use `JWC`/`jwc`, while existing compatibility state such as `GJC_*`, `@gjc-profile`, and `gajae_code_*` remains intact unless this card explicitly adds a dual-read. The implementation must not reopen the already closed `10.057` npm shim/update/worktree/coordinator hardening work.

## Current evidence

| area | current JWC fact | source |
|---|---|---|
| title gap | `launch-tmux.ts` has no exported tmux window-title builder, no managed-session `rename-window`, and no root terminal `set-titles-string` path. | `packages/coding-agent/src/jwc-runtime/launch-tmux.ts:1-301` |
| Windows root tmux gap | `buildDefaultTmuxLaunchPlan` still returns `undefined` on `win32`; native Windows `jwc --tmux` is not planned. | `packages/coding-agent/src/jwc-runtime/launch-tmux.ts:205-213` |
| psmux target gap | `tmux-common.ts` has exact target helpers but no psmux detection and always emits native tmux exact target forms. | `packages/coding-agent/src/jwc-runtime/tmux-common.ts:19-24` |
| team prompt gap | `buildWorkerCommand` still sends a multi-line prompt body; psmux/tmux `send-keys` can split embedded LF into premature Enter keypresses. | `packages/coding-agent/src/jwc-runtime/team-runtime.ts:1755-1795` |
| team split gap | `startTmuxSession` passes the whole worker command directly to `split-window`; upstream fixed psmux by creating the pane first, then `send-keys -l` body plus a second `Enter`. | `packages/coding-agent/src/jwc-runtime/team-runtime.ts:1885-1916` |
| prior closure | `10.057` intentionally deferred full psmux provider, Windows `--tmux`, and v0.7.8 follow-up scope into `10.061`. | `devlog/_plan/260701_clean_follow_tier1_impl/30_phase3_10057_windows_hardening.md:22-24` |

## Source decisions

| upstream anchor | decision | JWC adaptation |
|---|---|---|
| `beec1af0` tmux workspace titles | ADAPT | Add JWC title helpers that emit `JWC-<project>-<branch>` for tmux window names and `JWC: <project>-<branch>` for terminal titles. Preserve visible-width truncation, colon sanitization, dot-directory handling, `--` separator for dash-leading titles, `--no-title`, and `PI_NO_TITLE`. |
| `1d65050d` Windows/psmux `jwc --tmux` launch reliability | ADAPT | Add psmux-aware binary resolution, Windows PowerShell encoded inner command, `--tmux` stripping for the inner launch, captured stderr for diagnostics, `has-session` probe/retry, profile-tagging retry, psmux-aware target formatting, and attach-disconnect preservation. Translate user-visible diagnostics to `jwc`; preserve `GJC_TMUX_LAUNCHED` compatibility env. |
| `1d65050d` team worker prompt normalization | ADAPT | Normalize generated worker prompt to one line for all platforms, then keep PowerShell wrapping on Windows. Preserve existing JWC worker command resolution from `10.057`. |
| `1d65050d` psmux split-window execution | ADAPT | For psmux/Windows team panes, create the pane without the command, dispatch the command via `send-keys -l`, then submit with a separate `send-keys Enter`. Keep normal tmux behavior unchanged unless the same safer flow is already accepted by focused tests. |
| upstream docs/changelog | REJECT for product docs in this card | Do not update public docs beyond chase/devlog closure unless implementation exposes new documented env names. |

## Implementation plan

### New files

`packages/coding-agent/src/jwc-runtime/psmux-detect.ts`

- Add a JWC-named adaptation of upstream psmux detection.
- Export `ResolvedTmuxBinary`, `resolveJwcTmuxBinary`, `detectPsmux`, `probePsmux`, `clearPsmuxDetectionCache`, and the test-only binary resolver seam.
- Keep existing `GJC_TMUX_COMMAND` / `GJC_TEAM_TMUX_COMMAND` compatibility and add JWC aliases only where the repo already uses public help wording:
  - read `JWC_PSMUX_COMMAND` before `GJC_PSMUX_COMMAND`;
  - read `JWC_PSMUX_DETECTION` before `GJC_PSMUX_DETECTION`;
  - read `JWC_PSMUX_FORCE_DETECT` before `GJC_PSMUX_FORCE_DETECT`.
- On native Windows without explicit tmux command, prefer `psmux`, then `pmux`, then `tmux`.

`packages/coding-agent/src/jwc-runtime/tmux-title.ts`

- Add `JWC_TMUX_WINDOW_LABEL_MAX_WIDTH = 48`.
- Export `buildJwcTmuxWindowTitle(cwd, branch)` for tests and launch use.
- Export helper commands for root terminal title setup:
  - sanitize control characters;
  - escape tmux format marker `#` to `##`;
  - build `set-option -t <target> set-titles on`;
  - build `set-option -t <target> set-titles-string <title>`.
- Keep this outside `launch-tmux.ts` so that file stays below the 500-line repository limit.

### Modified source

`packages/coding-agent/src/jwc-runtime/tmux-common.ts`

- Import `resolveJwcTmuxBinary` from `./psmux-detect`.
- Change `resolveJwcTmuxCommand(env)` to delegate to `resolveJwcTmuxBinary({ env, platform }).command`.
- Extend `buildJwcTmuxExactOptionTarget(sessionName, opts?)` and `buildJwcTmuxExactSessionTarget(sessionName, opts?)`:
  - native tmux keeps exact targets `=NAME:` and `=NAME`;
  - psmux uses bare `NAME` for option/session commands.
- Re-export psmux detection APIs for launch/session/team callers.

`packages/coding-agent/src/jwc-runtime/launch-tmux.ts`

- Add `fs` and `Buffer` imports only if needed by diagnostics and Windows encoded command.
- Add `captureStderr?: boolean` to `TmuxSpawnOptions` and make `defaultSpawnSync` pipe/forward/capture stderr when requested.
- Add Windows-aware command resolution:
  - `path.win32` for Windows-shaped entrypoints;
  - `pwsh` when available, falling back to `powershell` / `powershell.exe` for stock Windows PowerShell;
  - `-EncodedCommand` with BOM-less UTF-16LE for whichever PowerShell binary is selected;
  - strip outer `--tmux` before inner launch;
  - preserve `GJC_TMUX_LAUNCHED=1`.
- Remove the `platform === "win32" return undefined` block so native Windows can plan when psmux/pmux/tmux is available.
- Use `resolveJwcTmuxBinary` through `resolveJwcTmuxCommand`.
- Add unavailable diagnostics using `jwc --tmux` wording; native Windows diagnostic names psmux install path.
- Add `renameExistingTmuxWindowIfNeeded` for already-inside-tmux interactive root launches.
- After creating a managed session:
  - probe `has-session`;
  - on missing-session race, do not blindly issue the same `new-session` twice against a possibly slow-to-register session name; first re-probe with a short bounded wait, then retry profile/attach against the now-visible session or cleanup before recreating;
  - rename the managed window with `buildJwcTmuxWindowTitle`;
  - apply profile with captured stderr;
  - retry profile tagging with bounded re-probe/backoff when `@gjc-profile` failure is really a missing-session psmux race; cleanup before any recreated `new-session` attempt so duplicate-session errors are not introduced;
  - set root terminal title before attach when not opted out, but treat terminal title option failures as best-effort and non-fatal;
  - skip or best-effort terminal title options when psmux is detected because `set-titles` support can differ from native tmux;
  - preserve sessions on SIGHUP/EIO attach disconnect;
  - kill newly created sessions on ordinary attach failure.
- Keep public diagnostics as `jwc --tmux`; keep internal env/profile compatibility names.

`packages/coding-agent/src/jwc-runtime/tmux-sessions.ts`

- Pass `env` into `buildJwcTmuxExactOptionTarget` / `buildJwcTmuxExactSessionTarget` so psmux uses bare target forms.
- Preserve current session command surface and `.jwc` state behavior.

`packages/coding-agent/src/jwc-runtime/team-runtime.ts`

- Use the shared `resolveJwcTmuxCommand(env)` imported from `tmux-common` rather than a local duplicate if practical without widening the diff.
- Normalize the generated worker prompt before quoting:
  - strip `U+FEFF` and zero-width space;
  - replace CRLF/LF runs with one space;
  - trim;
  - keep a deterministic fallback prompt containing the worker id.
- Keep the current Windows PowerShell invocation wrapper from `10.057`; update it only enough to pass the normalized prompt.
- For psmux/Windows pane spawning, split without worker command, then send literal command body and a separate Enter keypress. Keep rollback semantics and pane id extraction unchanged.

### Modified tests

`packages/coding-agent/test/jwc-runtime/psmux-detect.test.ts` (new)

- Verify explicit command resolution, Windows candidate order, cache behavior, force/detection-off envs, and psmux marker detection.
- Assert JWC alias envs and legacy `GJC_*` envs both work where added.

`packages/coding-agent/test/jwc-runtime/launch-tmux.test.ts`

- Add/import `buildJwcTmuxWindowTitle`.
- Assert `JWC-` window titles, `JWC:` root terminal titles, visible-width truncation, colon sanitization, dot-directory handling, `--` separator, title opt-outs, and `#` escaping.
- Assert Windows plans no longer return undefined when psmux is available and that the encoded command is BOM-less, uses direct `&`, and strips the outer `--tmux`.
- Assert captured stderr appears in new-session/profile/attach diagnostics.
- Assert psmux session registration races use bounded re-probe/backoff and do not create duplicate same-name sessions.
- Assert terminal-title failures are non-fatal, especially on detected psmux.
- Assert attach EIO/SIGHUP is treated as disconnect and does not kill the created session.

`packages/coding-agent/test/jwc-runtime/team-runtime.test.ts`

- Add prompt-normalization tests for LF/CRLF/BOM.
- Add psmux/Windows split-window test proving the pane is created first, then command is sent with `send-keys -l`, then submitted with `Enter`.
- Preserve existing 10.057 Windows worker command tests.

`packages/coding-agent/test/jwc-runtime/tmux-sessions.test.ts`

- Add or update target-format expectations for psmux bare target vs native tmux exact target if the existing suite covers tmux sessions.

## Documentation closure plan

After code verification:

- Move `struct_har/chase/10.061_gjc_chase_tmux_team_windows_psmux_titles.md` to `struct_har/chase/_fin/10/10.061_gjc_chase_tmux_team_windows_psmux_titles.md`.
- Update:
  - `struct_har/chase/10_gjc_chase_MOC.md`;
  - `struct_har/chase/007_follow_index.md`;
  - `struct_har/chase/002_gap_inventory.md`;
  - `struct_har/chase/10.001_gjc_chase_cycle.md`;
  - `struct_har/chase/_fin/INDEX.md`.
- Record source decisions and verification evidence in the moved card.

## Verification plan

Focused commands:

```sh
bun test packages/coding-agent/test/jwc-runtime/psmux-detect.test.ts
bun test packages/coding-agent/test/jwc-runtime/launch-tmux.test.ts
bun test packages/coding-agent/test/jwc-runtime/team-runtime.test.ts --test-name-pattern "tmux|psmux|worker command|prompt normalization|Windows"
bun test packages/coding-agent/test/jwc-runtime/tmux-sessions.test.ts
```

Broad gates:

```sh
bun run check:ts
git diff --check
```

Review gate:

- Dispatch Backend as a read-only A-phase plan auditor before implementation.
- Dispatch Backend again after implementation for integration verification before C.

## Residual exclusions

- Do not implement unrelated `10.050` tmux/session registry lifecycle or GC work.
- Do not alter public workflow skills or role-agent prompts.
- Do not change TUI rendering, welcome visuals, or scroll behavior.
- Do not rename compatibility env/profile identifiers wholesale; this card is not a rebrand sweep.
