# 260614 — performance incident MOC

> Status: P1.5 upstream Optimization Suite v3 complete; P2.0a TUI metrics, P2.2 prepared-line cache, and P3.1 session open single-load complete. Post-P2.2 scroll follow-up: major unknown-viewport duplicate-row bug fixed; minor next-input self-healing repaint glitch intentionally deferred as not-an-active-blocker in [73_scroll_repaint_timing_followup.md](./73_scroll_repaint_timing_followup.md).
> Trigger: live Jawcode sessions showed multiple hot `bun.exe` processes with sustained high CPU, plus 500–800MB RSS and CUA still loading after managed-default removal.
> Fixed during incident: `/Users/jun/.jwc/agent/mcp.json` no longer contains `computer-use` or `cua-driver`; only `context7` remains.

## 1. Executive verdict

The incident has two separate layers:

1. **CUA eager startup was config-driven, not built-in `computer_use` behavior.**
   - Managed defaults already install only `context7`.
   - Built-in `computer_use` remains lazy and starts `cua-driver mcp` only on tool execution.
   - The live user MCP config still had `computer-use` and `cua-driver`, so normal MCP discovery started them eagerly. That config has now been cleaned.

2. **Remaining Bun CPU is the primary performance debt; RSS is secondary.**
   - Hot CPU samples point at TUI text wrapping/width work: `wrap_text_with_ansi_c_callback`, `visible_width_u16_up_to`, Unicode segmentation, and allocation churn.
   - One hot process also showed token-counting (`count_tokens_c_callback` / tiktoken / regex).
   - RSS still matters, but it is likely amplified by resume/session hydration: full JSONL load, blob resolution, resident externalization, `getEntries()` materialization, `buildSessionContext()`, `getBranch()`, and restored agent messages.
   - First patches should reduce repeated CPU work while merely instrumenting RSS until a source-specific leak/materialization path is proven.

## 2. Fixed UX/safety contract

Performance work must preserve the current scrollback-native model from `structure/31_scroll.md`:

```text
jaw/tool from previous committed turn  ← terminal scrollback pixels; cannot expand/collapse
user
jaw/tool/read/result from current turn  ← ctrl+o inline expand/collapse is allowed
next user submit                       ← current visual state commits; later immutable
ctrl+t                                 ← full transcript pager/script view, not inline history mutation
```

No performance patch may rewrite committed scrollback, re-enable 3J after committed history, or make historical committed components ctrl+o-toggleable.

Scroll/render terminology in this plan:

| Term | Meaning | Status |
| --- | --- | --- |
| Physical duplicate/pushed rows | Terminal bytes append/replay stale rows into visible scrollback, causing duplicated output or upward push | Fixed for unknown viewport via scroll PABCD |
| Logical re-render of scrollback-owned pixels | Component tree recomputes children that should be skipped/committed; CPU cost or future safety issue, not necessarily visible duplication | Performance optimization target |
| Next-input self-healing repaint glitch | Visual stale pixels until a later input-triggered render/compact repairs the display | Deferred low-severity timing edge |

## 3. Investigation lanes

| Lane | Verdict | Follow-up file |
|---|---|---|
| CUA / MCP startup | CUA incident config-fixed; generic eager MCP and cleanup ownership remain | `01_gap_analysis.md`, `02_patch_roadmap.md` |
| TUI render core | P2.0a TUI metrics and P2.2 content-keyed prepared-line cache landed; P2.1 assistant streaming child reuse remains the next CPU slice | `02_patch_roadmap.md`, `72.14_d_p2_2_p3_1_done_summary.md` |
| Tool preview / ctrl+o | UX mostly correct; minimized/collapsed paths still full-render to count hidden lines | `01_gap_analysis.md`, `02_patch_roadmap.md` |
| Assistant markdown / ctrl+t | Markdown has caches, but streaming rebuilds children; ctrl+t eager-materializes full transcript before slicing | `01_gap_analysis.md`, `02_patch_roadmap.md` |
| Session resume | P3.1 `SessionManager.open()` single-load landed; path-only context and startup `getBranch()` materialization remain | `02_patch_roadmap.md`, `72.14_d_p2_2_p3_1_done_summary.md` |
| Tool registry/schema | Built-ins/MCP schemas may be materialized before active-tool filtering; instrumentation missing | `01_gap_analysis.md`, `02_patch_roadmap.md` |
| TUI scroll/repaint safety | Unknown-viewport physical duplicate/pushed-row failure fixed in separate scroll PABCD; minor next-input self-healing repaint glitch is tracked but deferred, not a release blocker | `73_scroll_repaint_timing_followup.md`, `../260615_scroll_anchor_duplication/20.9_d_done_summary.md` |
| External runtime docs | Bun already provides CPU/heap profiling and memory probes; no new dependency needed | `05_external_research.md` |

## 4. Non-goals

- Do not change ctrl+o / ctrl+t product semantics while doing performance patches.
- Do not delete custom user MCP entries automatically beyond exact managed legacy cleanup without a product decision.
- Do not rewrite session storage format as a quick fix.
- Do not remove ANSI/Unicode width correctness globally.
- Do not simplify TUI visual design or scroll model.

## 5. CPU-first patch order summary

1. **P2.0a measurement checkpoint:** TUI metrics sink + `tui.frame` / `tui.preparedLine` / `tui.text` JSONL emission landed. Coding-agent/session/sdk counters remain P2.0b or bundle-local measurement work before stronger P2.1/P2.3/P3.2 claims.
2. **P1 safe CPU hot-path fixes:** cheap minimized tool summaries, collapsed preview cache/bounded wrap, Box committed-child skip, MCP cleanup ownership. **P1.1–P1.4 ✅ landed.**
3. **P1.5 upstream v3 merge:** upstream Optimization Suite v3 merge completed and verified. [23_p1_5_upstream_v3_merge_plan.md](./23_p1_5_upstream_v3_merge_plan.md), [67_p1_5_goal_completion_audit.md](./67_p1_5_goal_completion_audit.md)
   - P1.5.1 input render priority (`tui.ts` expedited render)
   - P1.5.2 session resident cache (`session-manager.ts` ownership safeguards)
   - P1.5.3 compaction staleness-aware pruning (`pruning.ts` digest/staleness)
   - P1.5.4 serialization/diff optimization
   - P1.5.5 profiling corpus + FFI policy
4. **P2 render/markdown reductions:** revised after external audit. [68_p2_p3_external_audit_synthesis.md](./68_p2_p3_external_audit_synthesis.md), [69_p2_p3_measured_execution_plan.md](./69_p2_p3_measured_execution_plan.md)
   - P2.2 content-keyed TUI prepared-line cache **✅ landed** in [72.14_d_p2_2_p3_1_done_summary.md](./72.14_d_p2_2_p3_1_done_summary.md).
   - P2.1 assistant streaming child reuse is now the next explicit CPU slice, but must split usage/footer updates and key thinking presentation modes explicitly.
   - P2.2 follow-up: the content-keyed cache is retained. A minor “next input repairs the display” repaint timing edge is tracked separately; do not use it as justification for wholesale tick/render rollback without direct evidence.
   - P2.3 ctrl+t lazy tail render remains deferred unless ctrl+t open latency is the measured pain.
5. **P3 resume RSS/startup reductions:** P3.1 `SessionManager.open()` single-load **✅ landed** in [72.14_d_p2_2_p3_1_done_summary.md](./72.14_d_p2_2_p3_1_done_summary.md). Remaining queue: P3.2 path-only `buildSessionContext()` + P3.3 startup flag dedupe together, then P3.4 visible transcript analog.
6. **P4 tool registry/schema:** discovery mode resolver unification, schema byte instrumentation, eventual lazy discoverable metadata. P1.5.3 선행 필수.

## 6. Evidence index

Executor investigation refs from this session:

- TUI render core: `agent://10-PerfTuiRenderCore`
- Tool preview / ctrl+o: `agent://11-PerfToolPreview`
- Assistant markdown / ctrl+t: `agent://12-PerfAssistantMarkdown`
- Session resume: `agent://13-PerfSessionResume`
- MCP lifecycle: `agent://14-PerfMcpLifecycle`
- Tool registry/schema: `agent://15-PerfToolRegistry`
- External research: `agent://16-PerfExternalResearch`
- Devlog shape: `agent://17-PerfDevlogShape`

Second-pass hardening refs:

- Resize/cache invariants: `agent://18-ResizeCacheHardening`
- Committed render side effects: `agent://19-CommittedSideEffectAudit`
- ctrl+o / ctrl+t race hardening: `agent://20-ToggleTranscriptHardening`
- Instrumentation guardrails: `agent://21-InstrumentationHardening`
Third-pass P2/P3 external audit refs:

- P2.2 TUI prepared-line cache: `agent://35-P22TuiLineCacheAudit`
- P2.1 assistant streaming child reuse: `agent://36-P21AssistantReuseAudit`
- P2.3 full transcript lazy tail render: `agent://37-P23TranscriptLazyAudit`
- P3 session resume/RSS reductions: `agent://38-P3SessionRssAudit`
Post-P2.2 scroll/repaint follow-up refs:

- Unknown-viewport scroll fix closure: `../260615_scroll_anchor_duplication/20.9_d_done_summary.md`
- Deferred next-input repaint timing note: `73_scroll_repaint_timing_followup.md`
- P2.2/P3.1 closure: `72.14_d_p2_2_p3_1_done_summary.md`
