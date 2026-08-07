# 350 — wp31: a black window for a process nobody asked to see

Source: named residual in the wp10 `_fin` card for `20.088` — *"daemon spawns without `windowsHide` in
`commands/harness.ts`"*.

| phase | evidence |
|---|---|
| P | source trace of the detached owner spawn |
| A | **pass**, after scanning instead of trusting the name |
| B | `6201ed6` |
| C | gates green; ablation-verified |

## The named site

`#spawnDetachedOwner` launches the harness owner with `stdout`, `stderr` and `stdin` all `ignore`, then
`unref()`s it — a pure background daemon. Without `windowsHide`, Windows attaches a console window to it.
Nothing in that process is meant to be visible.

Every other background spawn in the tree already set the flag: `lsp/index.ts`, `lspmux.ts`, the lsp clients,
`utils/git.ts`, the plugin installer. The daemon was the outlier.

## Fixing only the named site would have repeated a recorded mistake

This same card's review record contains: *"**C1** — I had fixed the two callers I looked at and left the same
bug class in four others."* Taking the residual at its word would have reproduced that exactly.

So I scanned every `Bun.spawn`/`spawnSync` in `packages/coding-agent/src` for blocks with **both** stdout and
stderr discarded and no `windowsHide`. Fifteen hits — the residual named one.

Then triaged rather than bulk-patched:

| sites | disposition |
|---|---|
| 11 tmux invocations in `team-runtime` | **exempt** — tmux does not run on Windows, so the flag is inert |
| `openPath` (`rundll32`), shell-snapshot, `branchExists`, 2× `git worktree remove`, 1× `git show-ref`, browser launcher | **fixed** |

The exemption is expressed **by command name** (`tmux_command` / `tmuxCommand`) rather than by line number, so
it states its own reason and does not rot when the file moves.

## The test scans rather than enumerates

An enumerated list of known sites cannot catch the actual failure mode: someone adds a *new* background spawn
and forgets the flag. So the test re-runs the scan and asserts the offender list is empty.

Ablation removing the flag from the harness daemon turns both tests red.

## Not mine

`test/jwc-runtime` has 26 failures (goal-runtime snapshots, a handoff key matrix). Verified pre-existing by
stashing every change and getting the identical count. Recorded rather than absorbed.
