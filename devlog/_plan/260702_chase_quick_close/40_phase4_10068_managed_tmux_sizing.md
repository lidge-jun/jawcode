# Phase 40 — adapt 10.068-B managed tmux launch sizing

## Scope

Adapt only the `10.068` source fact anchored at GJC `0a604f6f`:

- When an interactive `jwc --tmux` launch creates a detached managed tmux session, preserve the caller terminal dimensions in the new session.
- Reassert the same dimensions before attach, after the managed window/profile setup, so tmux does not briefly keep a tiny default detached size.

This is a partial 10.068 sub-slice. Do not move `10.068` to `_fin` in this phase because owner fail-closed, cmux title sync, Telegram owner-race/internal-session/chunking, and TUI detach EIO facts remain open.

## Patch plan

Modify:

- `packages/coding-agent/src/jwc-runtime/launch-tmux.ts`
- `packages/coding-agent/test/jwc-runtime/launch-tmux.test.ts`
- `struct_har/chase/10.068_gjc_chase_tmux_telegram_session_resilience.md`

No `_fin` move or chase index update is planned for this phase.

## Implementation notes

- Extend the internal `TtyState` with optional `columns` and `rows`; keep existing tests using `{ stdin, stdout }` valid.
- Add a small exported or internal terminal-size type only if needed by existing public types; prefer internal helpers unless tests need to inspect `TmuxLaunchPlan.initialSize`.
- Include `-x <columns> -y <rows>` in `newSessionArgs` only when stdout is a TTY and both dimensions are positive safe integers.
- Add a `resize-window` control command before attach for newly created sessions only. Existing-session attach should not resize someone else's window.
- Reuse `buildJwcTmuxExactOptionTarget`/JWC target helpers and preserve psmux target behavior.

## Verification

Run:

```bash
bun test packages/coding-agent/test/jwc-runtime/launch-tmux.test.ts
bun run check:ts
git diff --check -- packages/coding-agent/src/jwc-runtime/launch-tmux.ts packages/coding-agent/test/jwc-runtime/launch-tmux.test.ts struct_har/chase/10.068_gjc_chase_tmux_telegram_session_resilience.md devlog/_plan/260702_chase_quick_close/40_phase4_10068_managed_tmux_sizing.md
```

Full `git diff --check` can still report unrelated pre-existing whitespace in `devlog/_plan/260702_tui_stabilization/12_gpt55_review.md`; use the target-file check for this phase.
