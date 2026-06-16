# 03 — safety boundaries for performance patches

## 1. UX invariants

Performance patches must preserve:

```text
previous committed jaw/tool/read/result  → immutable terminal scrollback pixels
current live user→jaw/tool/read/result   → ctrl+o inline expand/collapse eligible
next user submit                         → current visual state commits
ctrl+t                                   → full transcript pager/script view
```

Implications:

- Previous committed content must not become ctrl+o-expandable.
- Current live turn must remain ctrl+o-expandable until next submit.
- If current turn is expanded when next user submits, the expanded pixels commit and cannot later collapse.
- ctrl+t may render full/rich transcript, but does not mutate committed scrollback.

## 2. Scrollback-native constraints

From `structure/31_scroll.md`:

- Terminal scrollback is canonical history.
- Terminal cannot un-scroll; committed rows cannot be reclaimed except by clearing/rebuilding entire screen in controlled cases.
- CSI 3J is forbidden after committed history exists.
- ViewportFill sticky gap must not be consumed during growth; doing so shifts rows and causes redraw storms.
- Commit lane is an optimization boundary; committed components remain in containers for transcript/sweeps but are skipped during frame render.

## 3. Safe optimization classes

Allowed without UX change:

- Cache derived layout for immutable committed or unchanged live content.
- Avoid full child render when collapsed/minimized output is a fixed status row.
- Cache preview renders by width/content/fold state.
- Add ASCII fast paths that prove no ANSI/wide/control characters are present.
- Add debug-only counters/timers.
- Cache keys for render/layout previews must include width, content revision/fingerprint, fold state, preview budget, and renderer environment when applicable.
- Terminal resize must invalidate every width-dependent cache for the current live frame.
- Lazily render ctrl+t transcript entries while keeping all content reachable.
- Remove duplicate session materialization when output context is byte-equivalent.
- Explicitly clean up owned MCP managers.

## 4. Risky changes requiring separate product decision

Avoid in this performance series:

- Mutating committed scrollback to support historical ctrl+o.
- Re-enabling 3J after committed history.
- Removing ANSI/Unicode width correctness globally.
- Removing current commit-time folding defaults.
- Deleting custom user MCP entries automatically.
- Replacing JSONL session storage as an incident hotfix.
- Disabling read/tool previews instead of making collapsed preview bounded/cached.
- Making `computer_use` eager again through managed MCP config.

## 5. Instrumentation guardrails

- Frequent memory probes should use cheap RSS snapshots (`process.memoryUsage.rss()` where available) rather than full memory walks.
- Full `process.memoryUsage()`, JSC heap stats, heap snapshots, and forced GC belong in diagnostic harnesses or phase boundaries, not per-frame render paths.
- Profiling artifacts should be written under `artifacts/performance/` or cited from devlog evidence files.
- Do not stringify session entries or tool outputs just for logging.
- Instrumentation must be opt-in (`JWC_PERF=1`) and must not write interactive stdout/stderr during TUI mode.
- Per-frame instrumentation must count cheap events/timers only; write JSONL postmortem records outside the render hot path.

## 6. Test boundaries

Focused tests should cover exact contracts:

- ctrl+o live-only toggle and post-submit immutability.
- ctrl+t full transcript bottom-open and lazy navigation parity.
- committed children skipped by Container and Box.
- minimized tool render does not call full child render.
- width/ANSI/Unicode correctness preserved.
- session context output equivalent after path-only materialization.
- MCP manager cleanup on owned manager success/failure.
- resize invalidation for collapsed previews, prepared terminal lines, ctrl+t overlays, and streaming live tails.
- all-committed `Box.render()` returns no ghost rows while `invalidate()` still recurses through committed children.

Project-wide gates are execution-phase work, not part of this read-only analysis.
