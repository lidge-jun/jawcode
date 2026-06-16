# 07 — hardening addendum

> Added after the second parallel architect pass. This file tightens the CPU-first roadmap around resize, cache invalidation, committed-render side effects, ctrl+o/ctrl+t races, and instrumentation safety.

## 1. Second-pass lanes

| Lane | Agent ref | Verdict |
|---|---|---|
| Resize/cache hardening | `agent://18-ResizeCacheHardening` | WATCH: caches are safe only with full width/content/state keys and resize invalidation |
| Committed side-effect audit | `agent://19-CommittedSideEffectAudit` | WATCH: Box committed-child skip matches Container, but all-committed Box must return no ghost rows |
| ctrl+o / ctrl+t hardening | `agent://20-ToggleTranscriptHardening` | WATCH: live-turn gating is sound; submit/pending-tool prefix and ctrl+t live cache need explicit tests |
| Instrumentation hardening | `agent://21-InstrumentationHardening` | WATCH: add opt-in counters only; no interactive stdout, no per-frame full memory probes |

## 2. Resize and cache invariants

All P1/P2 caches must define an explicit cache key before implementation. Minimum key dimensions:

- `width`: authoritative render width; any terminal resize is a miss.
- content revision/fingerprint: full logical preview text or immutable revision id.
- fold state: expanded/minimized/collapsed/renderCommitted mode.
- preview budget: `previewLines`, padding/margin, and truncation mode.
- renderer environment when applicable: theme/custom background generation.

Hard rules:

- Do not use byte slicing for text that may contain ANSI, tabs, wide Unicode, combining marks, or OSC/hyperlink spans.
- Do not introduce a module-global visual-truncate result cache keyed only by width or padding.
- A bounded-tail truncation path is not P1-safe unless an oracle proves equality with full `truncateToVisualLines()`; otherwise keep full-path fallback.
- Prepared terminal-line caches must flush on width change and must reproduce the exact bytes after line reset/truncate that feed terminal diffing.

## 3. Committed-render side-effect contract

`Container.render()` already skips direct committed children. `Box.render()` can match that policy only under this contract:

- `committed` means terminal scrollback owns those pixels; the live frame must not duplicate them.
- Committed nodes remain in component trees for transcript overlays and sweep/introspection paths.
- `render()` must stay side-effect-free. State updates belong in events, update methods, or invalidation, not committed per-frame render calls.
- `invalidate()` must still recurse through committed children; only frame rendering skips them.
- If every child in a Box is committed, `Box.render()` should return `[]`, not padding-only ghost rows.

This makes the Box patch safe but still secondary to P1.1, because live minimized tools are not fixed by committed-child skipping. Current chat commits mark `chatContainer` direct children, which `Container.render()` already skips; P1.3 is mainly a policy-gap closure for nested/future committed children plus a guard against duplicate live-frame pixels.

## 4. ctrl+o / ctrl+t race hardening

Required edge cases before/with source patches:

- Submit path must test real `commitFinalizedBacklog()`, not manual flag flipping.
- Expanded live tool commits via `renderCommitted()` and becomes immutable after submit.
- Pending/streaming tool prefix behavior must be documented and tested: a pending item can stop a commit sweep; later finalized siblings must not silently violate the freeze contract.
- Tool focus lists only non-committed tools.
- Read tool groups toggle only while current-turn live; replayed groups are ineligible.
- ctrl+t overlay must not mutate inline component expanded state.
- ctrl+t opened during streaming must update live tail without duplicating the same assistant block from session replay and live items.
- ctrl+t resize must invalidate width-only caches.

## 5. Instrumentation contract

Use opt-in instrumentation only:

- Enable flag: `JWC_PERF=1`.
- Export: JSONL postmortem file under `~/.jwc/logs/perf.jsonl` or explicit artifact path; no interactive stdout/stderr noise.
- Memory: default to cheap RSS checkpoints; never call full `process.memoryUsage()` per frame.
- Render counters: frame count/duration, prepared-line cache hit/miss, wrap calls/duration, visible-width calls.
- Session counters: JSONL bytes, entry count, active-path entries materialized, load/materialize/branch/persist timings.
- Token counters: count calls, caller label, input byte length, model id where relevant.
- Tool/MCP counters: built-in tool count, active tool count, MCP tool count, schema bytes, instruction bytes, startup/disconnect timing.

Tests must prove `JWC_PERF` unset leaves runtime behavior and output unchanged.

## 6. MCP lifecycle ownership contract

P1.4 is worthwhile, but it must be narrower than "disconnect MCP everywhere":

- CLI discovery owns only managers created by `runRootCommand` itself. Externally supplied `CreateAgentSessionOptions.mcpManager` may belong to an embedder or parent runtime and must not be disconnected by a generic CLI `finally`.
- Happy-path cleanup already exists through `AgentSession.dispose()` calling `MCPManager.instance()?.disconnectAll()`. P1.4 should close gaps before that handoff: `createSession()` throw, early startup exits after discovery, and ACP preloading.
- ACP mode should skip normal CLI MCP discovery unless a future product decision says otherwise; ACP record/session code owns per-client MCP managers and disposal.
- Cleanup code must avoid double-disconnect on success paths and must clear `MCPManager.instance()` only when the instance still equals the CLI-owned manager being disconnected.
- Focused tests must mock the manager and startup path; manager-only `disconnectAll()` tests are insufficient for this lifecycle contract.


## 7. Hardened patch order update

1. P0 / P2.0 instrumentation skeleton and focused regression fixtures.
2. P1.1 minimized tool summary without hidden full child render.
3. P1.2 collapsed preview cache using existing exact truncate output; bounded-tail remains off.
4. P1.3 Box committed-child skip with all-committed-empty behavior tested.
5. P1.4 CLI-owned MCP cleanup/ACP discovery skip with ownership tests; process hygiene, not primary CPU reduction.
6. P1.5 upstream Optimization Suite v3 merge complete; keep its focused gates as regression coverage.
7. P2.2 prepared-line cache only as a content-keyed normalization/truncation cache with width/forced-render invalidation, byte-output golden tests, and bounded cache growth tests. Index-keyed line caches are forbidden.
8. P2.1 assistant streaming child reuse only after usage/footer rows are split from content rebuilds and thinking presentation modes are explicit cache dimensions.
9. P3 session resume materialization reductions may proceed independently after counters confirm duplicated load/materialization; P3.2 path-only context and P3.3 startup flag dedupe should ship together.
10. P2.3 ctrl+t lazy render only after bottom-pin/live-tail/dedupe tests and an eager-vs-lazy viewport oracle.