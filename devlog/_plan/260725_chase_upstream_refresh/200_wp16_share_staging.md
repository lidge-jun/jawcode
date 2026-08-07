# 200 — wp16: the transcript was world-readable, and cancelling did not cancel

Anchor: GJC `0f0f2adf1` *"Prevent cancelled share uploads from publishing after UI cancellation"*.

| phase | evidence |
|---|---|
| P | live permission probe |
| A | **pass**, plus a second defect found in the cancel path |
| B | `6bd4691` |
| C | gates green; ablation-verified |

## Two defects, one of which I did not plan for

**Permissions.** `/share` exports the full session transcript to
`os.tmpdir()/<snowflake>.html` and `Bun.write` takes no mode, so the default `022` umask leaves it at
**0644** — measured, not assumed. On Linux `/tmp` is shared between users, so every local account could read
the entire conversation for as long as the share ran. The name is also predictable enough to pre-create and
have the export land in someone else's file.

**Cancellation.** This one I found while reading the cancel path, not while planning. `loader.onAbort` called
`restoreEditor()`, which ran `cleanupTempFile()`. But the abort does not stop `gh gist create` — deleting its
input file does not cancel a running upload. So pressing Escape restored the UI, said "Share cancelled", and
the gist could still be published. Worse, `gh` reads by path: if the inode were reused between the delete and
the read, it would publish whatever landed there.

A permissions-only patch would have shipped with this still broken, which is exactly why the anchor's own
title is about cancellation rather than about file modes.

## The fix

- `mkdtemp` staging directory at `0700`, file opened `wx` (O_EXCL) at `0600`, whole directory removed after.
- `onAbort` restores only the UI. Cleanup moved to the gist promise, which runs once the child has actually
  exited — including on the error path.

## Verification

The regression test observes the **real** staging from inside `exportToHtml`, which is the exact window an
attacker would race. Ablating back to the shared-tmpdir path turns it red.

A note on test technique: I first tried to stub `loadCustomShare` with `vi.spyOn`. That cannot work — it is a
static import, and `mock.module()` is banned by `AGENTS.md`. Observing from the export callback tests the
same contract without fighting the module system.

Gates: `check:ts` 0 errors, `check:schemas`, `verify-g002-gates`, `rebrand-inventory --strict`,
`check-visible-definitions`, `ci:test:smoke` all pass; 60 controller tests pass; chase gates unchanged.
