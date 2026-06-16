Inspects, waits, or cancels async jobs.

Background job results are delivered automatically when complete. Reach for this tool only when you need to intervene.

`job` is the legacy low-level async job polling/cancel surface. Prefer the `background` tool for canonical background row list/detail/follow/settings after footer-panel background UI is available; use `job` only when you specifically need raw async job polling/cancel compatibility.
Never mix `job` and `background` claims without reading current state.

# Operations

## `list: true`
Use to inspect what's running.

## `poll: [id, …]`
Block until the specified jobs finish or the wait window elapses.
- Use when you are genuinely blocked on a result and have no other work to do.
- Returns the current snapshot when the timer elapses; running jobs remain running.
- Completed jobs include their final output in the returned snapshot.

## `cancel: [id, …]`
Stop running jobs.
- Use when a job is stalled, hung, or no longer needed.
- Returns immediately after cancelling.
