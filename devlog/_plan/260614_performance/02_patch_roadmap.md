# 02 — performance patch roadmap

Authoritative post-audit sequencing and verification matrix: [68_p2_p3_external_audit_synthesis.md](./68_p2_p3_external_audit_synthesis.md).

## P0 — measurement and replay harness first

Safe patches:

1. Add opt-in debug counters around:
   - `Text.render`: cache hit/miss, input bytes, wrapped lines.
   - `wrapTextWithAnsi` / visible width helpers: call count, input size, output lines.
   - `TUI.#doRender`: frame line count, prepared-line cache hits, emitted bytes, render duration.
   - `ToolExecutionComponent.render`: minimized render count, full child render count avoided.
   - `SessionManager.setSessionFile`: file bytes, entry count, blob refs, resident blobs, phase durations.
   - `sdk.ts createAgentSession`: context build, deobfuscate, branch flags, tool registry size, prompt schema bytes.
   - MCP manager: connected/pending server count, tool count, schema bytes.

2. Add synthetic replay fixtures:
   - 10k-line tool output collapsed/minimized.
   - Assistant markdown with tables/code/wide Unicode and streaming appends.
   - Large JSONL session with active branch + abandoned large branch.
   - ctrl+t large transcript bottom-open and pageUp/top navigation.

3. Store artifacts under `artifacts/performance/` or referenced devlog evidence files.

Do not add per-frame expensive `process.memoryUsage()` calls; use RSS-only/few phase snapshots.

P0 is the initial harness/fixture layer. The mandatory post-P1.5 gate before P2/P3 source mutation is **P2.0 measurement checkpoint** below.

## P1 — safest hot-path code patches

### P1.1 Tool minimized summary must not full-render children

Target:

- `packages/coding-agent/src/modes/components/tool-execution.ts`

Current issue:

- Minimized render calls `super.render(width)` to compute `hiddenLines`, which renders all child trees just to show one status row.

Patch shape:

- Track collapsed/hidden-line metadata during `#updateDisplay()` or compute an approximate bounded summary.
- In `render(width)`, when `#minimized && !#expanded`, return the spacer + status row without `super.render(width)`.
- Make error summary extract only the first text line without joining/sanitizing every block.
- Add no-op guard in `setExpanded()` and `setMinimized()` when state is unchanged.

Verification:

- Fake renderer child increments counter; collapsed minimized render must not call child render.
- Expanded render still calls child render.
- ctrl+o can expand current live minimized tool before commit.

### P1.2 Collapsed preview cache / bounded wrap

Targets:

- `packages/coding-agent/src/modes/components/execution-shared.ts`
- `packages/coding-agent/src/modes/components/visual-truncate.ts`

Current issue:

- `createCollapsedPreview()` recomputes `truncateToVisualLines()` every render.
- `truncateToVisualLines()` renders the full text and slices the tail.

Patch shape:

- Add per-component cache in `createCollapsedPreview()` keyed by `width` and immutable `previewText`.
- For callsites that already pass bounded logical lines, keep behavior exact.
- Longer-term: add a bounded-tail visual truncation path that wraps only a safe suffix plus enough context; keep full path as fallback when skipped count must be exact.

Verification:

- Same preview rendered twice at same width computes once.
- Width change invalidates.
- ANSI/wide Unicode output remains width-safe.

### P1.3 Box should skip committed children like Container

Target:

- `packages/tui/src/components/box.ts`

Current issue:

- `Container.render()` skips direct committed children; `Box.render()` does not.
- Current main chat commit lane sets `committed` on `chatContainer` direct children, so most committed history is already skipped before nested Box rendering. P1.3 is therefore **contract hardening / future-proofing**, not the next large CPU win after P1.1/P1.2.
- If a future path marks nested children committed inside a live Box, the current Box loop would still call `child.render(contentWidth)`, duplicating scrollback-owned pixels and paying hidden child render cost.

Patch shape:

- In `Box.render()`, skip `child.committed` before `child.render(contentWidth)`, matching `Container.render()` semantics.
- Preserve `invalidate()` recursion through committed children; committed nodes stay in the tree for transcript/sweep/introspection paths.
- If every child is committed, `Box.render()` must return `[]`, not padding-only ghost rows.
- Do not change Box cache hashing, padding/background rendering, or commit sweep ownership.

Verification:

- Add a focused Box component test: committed child render counter stays zero, live child still renders, mixed committed/live output includes only live content, all-committed Box returns `[]`, and `invalidate()` still reaches committed children.
- Run the focused Box test plus commit-lane regressions.

### P1.4 Explicit MCP manager cleanup ownership

Targets:

- `packages/coding-agent/src/main.ts`
- maybe `packages/coding-agent/src/sdk.ts` only if ownership flag is needed.

Current issue:

- Post-config-cleanup scope is not CUA deletion. The remaining value is generic MCP stdio subprocess hygiene and ownership clarity for project/user/custom MCP entries.
- Happy-path interactive/print/RPC/ACP session teardown already usually reaches `AgentSession.dispose()`, and `AgentSession.dispose()` currently calls `MCPManager.instance()?.disconnectAll()`.
- The important current-code gap is failure before a session owns disposal: CLI discovery assigns `sessionOptions.mcpManager`, then `createSession(sessionOptions)` or later startup checks can throw/exit before `session.dispose()` runs.
- ACP mode should not receive the CLI-discovered manager: ACP has its own per-record MCP ownership/isolation path. CLI preload before ACP is redundant and can leave a global instance/preloaded subprocess if not explicitly skipped or disconnected.
- Externally supplied `CreateAgentSessionOptions.mcpManager` needs an explicit ownership rule. Do not disconnect embedder-owned long-lived managers from a CLI `finally` path unless the session explicitly owns them.

Patch shape:

- Track a `cliOwnedMcpManager` only when `runRootCommand` itself calls `discoverAndLoadMCPTools()` and the caller did not provide `sessionOptions.mcpManager`.
- Skip CLI MCP discovery entirely for `mode === "acp"` unless there is a documented reason to preload; ACP session records own their managers.
- Wrap non-ACP session creation/run in a narrow `try/finally`: if a CLI-owned manager has not been handed to a dispose path, call `disconnectAll()` and clear `MCPManager.instance()` only when it still points at that manager.
- Avoid double-disconnect on normal print/interactive/RPC paths that already call `session.dispose()`.
- If SDK embedders require reusable managers, add an explicit ownership flag rather than inferring ownership from presence of `options.mcpManager`.

Verification:

- Mock `discoverAndLoadMCPTools()` and `createSession()` failure: CLI-owned fake manager gets `disconnectAll()` exactly once.
- Mock successful session path: session disposal owns cleanup; the root `finally` does not double-disconnect.
- ACP isolation test: `runRootCommand` in ACP mode does not leave a CLI-preloaded `MCPManager.instance()` and does not attach project/user MCP servers to ACP base options.
- Keep existing `MCPManager.disconnectAll()` pending-connection abort tests green.

## P1.5 — upstream Optimization Suite v3 merge

> **Status: complete (verified).** Upstream Optimization Suite v3 merged per [23_p1_5_upstream_v3_merge_plan.md](./23_p1_5_upstream_v3_merge_plan.md) and [67_p1_5_goal_completion_audit.md](./67_p1_5_goal_completion_audit.md). Retain P1.5.1–P1.5.5 subsections as landed regression context, not a pending merge queue.

### P1.5.1 Input render priority (`19bba222` #593)

Target: `packages/tui/src/tui.ts`

- `#inputRenderPending` + `commitExpeditedRender()` — input keystroke renders via `process.nextTick`, superseding pending frame-budget timer.
- Fixes typing lag after v2 optimization suite. Coalesced: one expedited render per event-loop turn.
- Conflict risk: **low**. Must merge before P2.2 (prepared-line cache).

### P1.5.2 Session resident cache safeguards (`5283f4e6` #548)

Targets: `packages/coding-agent/src/session/session-manager.ts`, `blob-store.ts`

- `EphemeralBlobStore`, `ResidentBlobMissingError`, ownership-safe image resolution.
- `cloneSessionContext()` with `cloneJsonSemantic` deep copy.
- Compaction hydration clamp for stale `firstKeptEntryId`.
- Conflict risk: **high** (550 diff lines, overlaps jawcode compaction patches). Must merge before P3.

### P1.5.3 Compaction token estimation + staleness-aware pruning (`78ed07c3` #557)

Targets: `packages/agent/src/compaction/openai.ts`, `pruning.ts`

- Staleness-aware pruning: superseded tool results (re-read files, re-run searches) pruned first.
- `resultDigest()`, `ToolResultMeta`, `createPrunedNotice()` restructure.
- Conflict risk: **medium**. Must merge before P4 (token counting cache).

### P1.5.4 Serialization/diff optimization (`f40f0d66` #558)

- New: `secrets-obfuscator.ts`, diff oracle, LCS-based hindsight models.
- Conflict risk: **low**. Mostly new files.

### P1.5.5 Profiling corpus + FFI policy (`94c563d3` #584)

- New: `perf-corpus-schema.ts`, `perf-corpus.bench.ts`, `session-memory.bench.ts`, `perf-threshold.ledger.ts`, corpus validation test, FFI optimization policy doc.
- P1.5.5 hard gate is `bun test packages/coding-agent/test/perf-corpus.test.ts`; bench JSON smoke gates are `bun packages/coding-agent/bench/perf-corpus.bench.ts` and `bun --smol --expose-gc packages/coding-agent/bench/session-memory.bench.ts`.
- TUI input/latency gates belong to P1.5.1 and are not newly introduced by this slice.
- Conflict risk: **none**. Additive only. Provides measurement baseline for P2–P4.

### Landed merge order

```text
P1.5.5 → P1.5.1 → P1.5.4 → P1.5.3 → P1.5.2
(no conflict → low → low → medium → high)
```

## P2.0 — post-P1.5 measurement checkpoint

> **Status:** P2.0a landed for the TUI metrics sink and real `tui.frame` / `tui.preparedLine` / `tui.text` JSONL emission. Coding-agent/session/sdk counters remain P2.0b or bundle-local instrumentation before stronger P2.1/P2.3/P3.2 claims.

Patch shape:

- Enable opt-in `JWC_PERF=1` counters without interactive stdout/stderr noise.
- Export bounded JSONL to `~/.jwc/logs/perf.jsonl` or an explicit artifact path.
- Record frame duration, prepared-line cache hit/miss, wrap/visible-width call counts, Markdown construction/rebuild count, ctrl+t entry/line render count, session open load/materialize count, and cheap RSS checkpoints.
- Keep `PI_TUI_METRICS` only as a compatibility alias resolved by the same metrics enable helper, or remove it from the P2 path; do not leave two independent undocumented enable switches.
- Keep `JWC_PERF` unset behavior and output byte-identical.
- Use stable `jwc.perf-events/1` JSONL rows with `{ schema, ts, source, counters }`.
- Add or extend `packages/tui/test/metrics.test.ts` and `packages/tui/test/metrics-redteam.test.ts` for resolver, off-by-default, JSONL, and no-interactive-noise coverage.

Verification:

- `packages/tui/test/metrics.test.ts`: `JWC_PERF` unset keeps metrics disabled/no-op and `JWC_PERF=1` enables the shared resolver.
- `packages/tui/test/metrics-redteam.test.ts`: no interactive stdout/stderr output and bounded label/event cardinality.
- Enabled mode writes `jwc.perf-events/1` rows containing the expected bounded counter fields.
- Counter collection avoids per-frame full `process.memoryUsage()`.

## P2 — render/markdown reductions

> Current sequencing after P2.0a/P2.2/P3.1: P2.2 prepared-line cache is complete; the next CPU slice is P2.1 assistant streaming child reuse. Defer P2.3 unless ctrl+t open latency is the measured pain.
>
> **Post-P2.2 note:** P2.2 has now landed and is retained. The follow-up unknown-viewport duplicate/pushed-row scroll bug was fixed in the separate scroll PABCD cycle (`../260615_scroll_anchor_duplication/20.9_d_done_summary.md`). A smaller “next input repairs the display” repaint timing edge remains deferred by user decision and is tracked in `73_scroll_repaint_timing_followup.md`; do not treat it as evidence for wholesale tick/render rollback.

### P2.1 Assistant streaming child reuse

Target:

- `packages/coding-agent/src/modes/components/assistant-message.ts`

Current issue:

- Every streaming `message_update` calls `AssistantMessageComponent.updateContent()`, which clears `#contentContainer` and recreates visible `Markdown` / `Text` children.
- `setUsageInfo()` currently routes through the same full rebuild path, so token usage updates can erase reuse wins even when content blocks are unchanged.

Patch shape:

- Add an incremental sync layer inside `assistant-message.ts` that reuses unchanged prefix block children within the current segment.
- Key reuse by local segment index, block kind, trimmed payload/fingerprint, markdown style profile, and derived presentation mode.
- Thinking presentation mode must distinguish expanded body, collapsed summary, streaming tail, and hidden label; raw `content.thinking` alone is not a safe key.
- Split usage/footer/error/abort/tool-image rows from content block rebuilds so `setUsageInfo()` does not recreate stable Markdown children.
- `invalidate()` should invalidate reused children instead of unconditionally rebuilding the whole child tree.
- Preserve post-tool segment boundaries; P2.1 optimizes within-segment streaming, not EventController's segment split behavior.

Verification:

- Streaming append where only the last text block grows creates/rebuilds O(1) tail children, not all prefix children.
- Usage row update with `display.showTokenUsage` does not recreate existing Markdown children.
- Thinking collapsed/expanded/streaming-tail/hidden-label outputs remain byte-stable against current tests.
- Width change renders correctly through reused children.
- `renderCommitted()` and `renderFullTranscript()` semantics remain unchanged.
- Block insert/remove at the prefix updates spacer/header structural children without full Markdown prefix rebuild.
- Reuse keys use current-segment local block index/fingerprint only, not global message index.

### P2.2 TUI prepared-line cache
> **Status:** complete (verified) in [72.14_d_p2_2_p3_1_done_summary.md](./72.14_d_p2_2_p3_1_done_summary.md). Keep this subsection as landed regression context, not a pending implementation queue.

Target:

- `packages/tui/src/tui.ts`
- `packages/tui/src/utils.ts` if the printable-ASCII helper is missing

Problem addressed:

- `#doRender` and `commitLines` repeatedly normalize/reset/truncate the same terminal lines every frame.
- The old roadmap idea of an index/width cache is unsafe: insert/delete, viewport fill, commit scrollout, and shrink/gap changes can move stable raw lines to different indices.

Patch shape:

- Port/adapt the upstream content-keyed shape rather than inventing an index cache:
  - raw line string → normalized/terminated line cache
  - `width + normalizedLine` → truncated line cache
  - printable ASCII fast path
  - bounded cache trimming based on current render line count
  - cache clear on forced render, stop, and width change
- Unify line preparation for `#doRender` and `commitLines` through a single internal path such as `#applyLineResetsAndTruncate()` / `#prepareLineForTerminal()`.
- Preserve image-line skip, OSC 8 terminator policy, no-3J-after-committed-history behavior, and P1.5.1 expedited input render scheduling.
- Do not touch `#expandViewportFill`, `compactViewportFill()`, sticky gap, composer pin, or scroll/fill/gap behavior from `structure/31_scroll.md`.
- Post-landing follow-up: if a display glitch self-heals on the next chat input, first compare the missing immediate repaint/compact trigger against the next-input repair path. Do not disable the content-keyed cache or restore tick-wide rendering without direct stale-cache evidence.

Verification:

- Golden mixed-frame terminal bytes unchanged for ASCII, ANSI, OSC 8, wide Unicode, combining marks, tabs, and normalized scripts.
- Cache invalidates on width change and forced render.
- Cache growth stays bounded under streaming unique lines.
- `commitLines` output remains byte-aligned with `#doRender` prepared lines.
- Existing input latency/redteam, viewport-fill, commit-lane, and above-viewport repaint tests stay green.

### P2.3 ctrl+t lazy tail render

Targets:

- `packages/coding-agent/src/modes/components/full-transcript-overlay.ts`
- `packages/coding-agent/src/modes/controllers/input-controller.ts`

Current issue:

- FullTranscriptOverlay currently renders all historical/live transcript items into one flat line cache, then slices the viewport.
- `InputController.showFullTranscript()` can also eagerly build replay components before the overlay opens, so overlay-only lazy rendering does not prove open-latency improvement by itself.

Patch shape:

- Preserve bottom-open UX and the existing navigation contract.
- Lazy-render at transcript entry/component granularity using `renderFullTranscript(width)` where available and `render(width)` only as fallback.
- On initial open, render tail-first until viewport rows plus overscan are available.
- Render older entries only when pageUp, `g`, or upward scroll crosses uncached ranges.
- Keep chronological order and live-item / streaming-component dedupe from the current `showFullTranscript()` path.
- Track per-entry rendered line spans or prefix sums; invalidate on width change, entry identity/content change, and live tail append.
- Treat deferring/memoizing `buildSessionTranscriptComponents()` as a related open-latency follow-up, not proof of overlay lazy rendering alone.

Verification:

- Eager reference output equals lazy viewport output at bottom-open, pageUp, top, and a mid-scroll offset.
- Initial bottom-open renders only tail entries needed for viewport plus overscan.
- Live tail append updates without historical full rerender or duplicate assistant blocks.
- Width change invalidates line spans and reclamps scroll.
- Existing full-transcript overlay and session transcript replay tests stay green.
- Bottom-open re-pin, pageUp/pageDown, `g`/`G`, and close keys behave unchanged against the eager reference.

## P3 — resume/session RSS reductions

Targets:

- `packages/coding-agent/src/session/session-manager.ts`
- `packages/coding-agent/src/sdk.ts`

Resolved and remaining issues:

1. **P3.1 resolved:** `SessionManager.open()` no longer performs the earlier double full-load; see [72.14_d_p2_2_p3_1_done_summary.md](./72.14_d_p2_2_p3_1_done_summary.md).
2. Instance `buildSessionContext()` still calls `getEntries()`, which materializes all non-header file entries before the pure builder walks the active path.
3. `createAgentSession()` resume startup builds/deobfuscates context and then calls `getBranch()` for startup flags, causing another materialization pass.
4. Full-tree APIs (`getEntries()`, `getTree()`, usage statistics, rewrite/persist paths) remain legitimately expensive and are not P3's first target.

Patch sequence:

1. **P3.1 — eliminate `SessionManager.open()` double full-load. ✅ Landed**
   - Retained as regression context for migration/blob resolution order and single-load tests.

2. **P3.2 — path-only `buildSessionContext()`.**
   - Instance method should walk `#byId` from `#leafId` and materialize only active branch entries with one materialize cache per build.
   - Preserve the exported pure helper API.
   - Keep P1.5.2 resident fail-closed context (`sessionId`, `sessionFile`) and externalized fileEntries invariants.

3. **P3.3 — remove startup `getBranch()` materialization.**
   - Derive thinking/service-tier/MCP/TTSR flags from the built context or from a lightweight active-path scan.
   - Ship with path-only context; otherwise resume startup still pays the second materialization pass.

4. **P3.4 — apply visible transcript analog carefully.**
   - `buildVisibleTranscriptContext()` can use the same path-only materialization, but compaction transcript semantics need separate oracle tests.

Verification:

- `SessionManager.open(path)` reads/parses the target once.
- Active-path context equals a full-materialization oracle for branch, compaction, model, thinking, service tier, MCP selection, and TTSR cases.
- A huge abandoned branch does not materialize resident blobs for LLM context or startup flags.
- P1.5.2 resident cache/lifecycle/ownership tests stay green.
- `packages/coding-agent/bench/session-memory.bench.ts` adds or uses an abandoned-branch fixture for before/after RSS evidence.

## P4 — tool registry/schema and token counting

### Tool registry/schema

Targets:

- `packages/coding-agent/src/tools/index.ts`
- `packages/coding-agent/src/sdk.ts`
- `packages/coding-agent/src/runtime-mcp/tool-bridge.ts`
- `packages/coding-agent/src/runtime-mcp/tool-cache.ts`

Patch shape:

- Instrument registry tool count, active tool count, MCP tool count, schema byte top-N.
- Unify effective discovery mode resolver between `createTools()` and SDK selection.
- Later: static discoverable metadata so hidden/discoverable tools do not require full construction.

### Token counting

Patch shape:

- Create separate inventory for token-count callsites.
- Cache per-message/per-model token counts with explicit invalidation on content/model changes.
- Debounce/batch counts during streaming and resume rebuild.

Do not mix token counting with TUI render caches; correctness and invalidation rules differ.
