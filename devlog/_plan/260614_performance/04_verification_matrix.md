# 04 — verification matrix

> Priority is CPU first. RSS is tracked, but the first fixes must reduce repeated render/wrap/token/session work without changing scrollback UX.

## 1. Per-gap verification contracts

| Concern | Contract that must not regress | Focused verification |
|---|---|---|
| Minimized tool summary | Collapsed/minimized tool keeps the same visible status row and current live ctrl+o can still expand | Component test with a counting child: minimized render must not call full child render; expanded render must still render child |
| Collapsed preview cache | Same preview text, width, ANSI handling, and line budget as before | Golden test for long ANSI output across repeated renders at same width, changed width, and changed content |
| Bounded read preview | Read tool preview stays visually identical for short files and tail-focused long files | Read/group component test with short, long, ANSI, tabbed, and home-path examples |
| Box committed-child skip | Box follows the same committed-frame contract as Container without creating padding ghosts | Component test with committed child render counter, live child render counter, mixed committed/live output, all-committed `[]`, and `invalidate()` recursion through committed children |
| Prepared-line cache / text cache | Width/ANSI correctness stays intact after resize and streaming append | Text render tests for same width, changed width, ASCII, wide Unicode, combining marks, ANSI color spans, tabs |
| Assistant streaming block reuse | Markdown output is unchanged; streaming appends do not rebuild unaffected prior blocks | Assistant component test with paragraph/code/tool-status blocks and render counters/fingerprints |
| ctrl+o current-turn model | Previous committed jaw/tool cannot expand or collapse; current live turn can; submit commits current visual state | Existing ctrl+o regression plus one test that expanded live state is immutable after the next user submit |
| ctrl+t transcript pager | Opens at bottom/latest; navigation can move upward; no inline history mutation | Overlay test for initial bottom offset, page up/down, and last-line visibility |
| ctrl+t lazy rendering | Same transcript lines for visible region; opening does not materialize whole history | Large fake session test with line-builder counter bounded by viewport plus overscan |
| Session open double load | Opening a session preserves cwd/branch behavior and reads target JSONL once | Storage test double counting `readText()`/load calls for valid, missing, and invalid session files |
| Path-only session context | Startup flags/branch metadata are identical without full visible transcript materialization | SDK/session test comparing returned cwd, branch id, branch count, and compaction flags |
| MCP lifecycle cleanup | CLI-owned MCP child processes are disconnected on startup failure/error paths without tearing down externally owned managers | `runRootCommand` lifecycle tests with fake CLI-owned manager for `createSession` throw, success/no-double-disconnect, and ACP discovery-skip/isolation |
| Tool registry instrumentation | No prompt/tool availability change; only metrics are added | Snapshot active tool names before/after and assert metrics are absent unless debug flag is enabled |
| Token counting inventory | No prompt budget behavior changes during measurement | Counter-only test proving token-count instrumentation does not mutate context assembly |
| Resize cache invalidation | Terminal resize reflows only current live frame; committed scrollback stays immutable | Width 80→40→120 invalidates collapsed preview, prepared-line, Text, and ctrl+t overlay caches |
| Pending/streaming submit boundary | Submit commits only finalized prefix and never leaves later finalized siblings in an ambiguous toggle state | Integration test through real `commitFinalizedBacklog()` with pending tool in prefix |
| Instrumentation off by default | No runtime output, no perf file, no hot-path overhead when unset | `JWC_PERF` unset run asserts no perf JSONL and no stdout/stderr perf lines |
| P1.5.1 Input render priority | Keystrokes echo within one event-loop turn during streaming; no repaint storms | `input-render-latency.test.ts` + `input-render-redteam.test.ts` + existing TUI suite 477/477 |
| P1.5.2 Session resident cache | Resident blob lifecycle is fail-closed; image resolution ownership-safe; compaction hydration clamped to correct range | `session-resident-cache.test.ts` + `session-resident-lifecycle.test.ts` + `session-resident-ownership.test.ts` + `resident-materialization.test.ts` |
| P1.5.3 Digest-aware pruning | Digest-capable bash/search/grep pruned notices stay bounded and informative; staleness parity covers selector reads, Add File, Move to, failed per-file grouping, and search defaults | `pruning-redteam.test.ts` + `pruning-staleness.test.ts` + `pruning-staleness-redteam.test.ts` |
| P1.5.4 Serialization/diff | Clone equality and obfuscation paths correct; diff oracle matches LCS baseline | `secrets-obfuscator.test.ts` + `diff-oracle.test.ts` + `hindsight-mental-models-lcs.test.ts` |
| P1.5.5 Profiling corpus | Corpus schema/ledger/session-memory test passes; bench commands exit 0 and emit JSON; no additional TUI latency gate files are added in P1.5.5 | `perf-corpus.test.ts` + `perf-corpus.bench.ts` dry run + `session-memory.bench.ts` dry run |

## 2. CPU-focused acceptance criteria

A patch is not accepted as a performance fix unless it proves at least one of these:

1. Repeated render of the same collapsed/minimized tool avoids full child `render()` / full `wrapTextWithAnsi()` work.
2. Streaming append work is proportional to the changed live segment, not the whole current-turn transcript where correctness allows it.
3. ctrl+t opening cost is proportional to visible viewport plus bounded overscan, not full transcript line count.
4. Session resume removes a duplicated full JSONL read/materialization path.
5. Token counting or schema generation adds measurement first, then cache/reduction only after callsite evidence.

## 3. Focused commands to run when source patches are made

Use focused tests tied to touched files, then a package check only when behavior crosses module boundaries.

- TUI render/text changes: targeted `packages/tui` component/text tests plus affected coding-agent render tests.
- Tool preview changes: focused tests around `ToolExecutionComponent`, collapsed previews, read group preview, and ctrl+o input handling.
- Assistant markdown changes: focused assistant message/markdown streaming tests and ctrl+t overlay tests.
- Session resume changes: focused `SessionManager`/SDK resume tests with large synthetic JSONL fixtures.
- MCP lifecycle changes: focused MCP manager/CLI lifecycle tests with fake subprocess/server handles.

## 4. Measurement artifacts to capture during patches

Before/after artifacts should be attached to the plan folder or `artifacts/`:

- Bun CPU profile (`--cpu-prof-md`) for one long streaming/tool-output session.
- Render counters: number of component renders, `wrapTextWithAnsi` calls, visible width calls, and cache hit/miss counts.
- Session resume counters: JSONL read count, entries materialized, active branch entries materialized, elapsed open time.
- Token counters: number of token-count calls, input byte length, caller label.
- MCP counters: manager startup time, loaded server count, child process count, disconnect count.

## 5. Second-pass hardening tests

Add these before or alongside source patches:

- `truncate-cache-oracle`: same content/width hits cache; width, preview budget, padding, content revision, and fold state miss; ANSI/wide/tabs match full oracle.
- `box-committed-skip`: committed child render counter stays zero; live child renders; all-committed Box returns `[]`; `invalidate()` still recurses.
- `submit-freeze-integration`: ctrl+o expands a live tool, submit runs the real commit path, later ctrl+o does not mutate committed output.
- `ctrlt-live-tail-dedupe`: ctrl+t opened during streaming updates the tail once and does not duplicate session replay plus live item.
- `perf-opt-in`: `JWC_PERF=1` writes bounded JSONL postmortem counters; unset writes nothing and does not touch interactive output.
