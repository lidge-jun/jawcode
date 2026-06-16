# 68 — P2/P3 external audit synthesis

Date: 2026-06-15

## Scope

External executor audits reviewed the next performance plan after completed P1.5:

- P2.2 TUI prepared-line cache: `agent://35-P22TuiLineCacheAudit`
- P2.1 assistant streaming child reuse: `agent://36-P21AssistantReuseAudit`
- P2.3 full transcript lazy tail render: `agent://37-P23TranscriptLazyAudit`
- P3 session resume/RSS reductions: `agent://38-P3SessionRssAudit`

All four audits returned **REVISE**: the roadmap targets are valid, but each needs tighter cache keys, invalidation, oracle tests, or sequencing before source work.
> **Status update:** P2.0a, P2.2, and P3.1 have since landed. This synthesis remains the origin of the constraints, but current work should use `02_patch_roadmap.md`, `69_p2_p3_measured_execution_plan.md`, and `72.14_d_p2_2_p3_1_done_summary.md` for completed-vs-pending status.

## Revised sequencing

1. **P2.0 measurement checkpoint**
   - Add opt-in `JWC_PERF=1` counters only.
   - Capture `#doRender` duration, prepared-line hit/miss, Markdown construction/rebuild count, ctrl+t entry/line render counts, session open load/materialize counts, and cheap RSS checkpoints.
   - No interactive stdout/stderr noise; write JSONL to a log/artifact path.

2. **P2.2 revised TUI prepared-line cache**
   - Primary CPU candidate for live typing/streaming frames.
   - Use content-keyed caches, not index-keyed caches.
   - Port/adapt the upstream shape: raw line normalization cache, `width + normalizedLine` truncation cache, ASCII fast path, bounded cache trim, and cache clear on forced render/width change.
   - Unify `#doRender` and `commitLines` through one line-preparation path.

3. **P2.1 assistant streaming child reuse**
   - Split usage/footer updates from content-block rebuilds.
   - Reuse unchanged prefix `Markdown`/`Text` children within the current segment.
   - Key thinking presentation by derived mode, not raw text alone: expanded, collapsed summary, streaming tail, hidden label.

4. **P3.1–P3.3 session resume/RSS reductions**
   - Status after later cycles: P3.1 single-load is complete; P3.2 path-only context and P3.3 startup flag dedupe remain and should still ship together.
   - Independent of P2 render work and may run in parallel after measurement.
   - Remove `SessionManager.open()` double load.
   - Make instance `buildSessionContext()` / startup flags path-only and avoid abandoned-branch materialization.
   - Preserve P1.5.2 resident-cache fail-closed ownership invariants.

5. **P2.3 full transcript lazy tail render**
   - Prioritize earlier only if ctrl+t open latency is the measured user pain.
   - Lazy-render by transcript entry/component, tail-first to viewport + overscan.
   - Address both overlay line rendering and eager `showFullTranscript()` component construction before claiming open-latency wins.

## Blockers converted into plan constraints

### P2.2

- Do **not** implement index/width prepared-line cache.
- Cache key must be content/width based:
  - normalization: raw component line string
  - truncation: width plus normalized/terminated line
- `commitLines` and `#doRender` must share the same preparation function.
- Preserve image-line skip, OSC 8 terminator policy, `#hasCommittedHistory` / no-3J behavior, P1.5.1 expedited input render scheduling, and `structure/31_scroll.md` sticky gap semantics.
- Tests must cover byte parity for ASCII, ANSI, OSC 8, wide Unicode, combining marks, tabs, resize invalidation, commit-lane preparation, and bounded cache growth.

### P2.1

- `updateContent()` full rebuild is the hotspot, but `setUsageInfo()` also currently triggers full rebuild and must be split.
- Cache identity must be per current segment and local block index/fingerprint, not global message index or object identity.
- Spacers/header visibility may depend on neighboring blocks, so the sync layer must reconcile structural children, not only body children.
- `invalidate()` should invalidate reused children instead of always rebuilding the tree.

### P2.3

- Current overlay is eager: it renders all historical/live items to a flat line cache before slicing viewport.
- Lazy rendering must happen at entry/component granularity using `renderFullTranscript(width)` where available.
- Bottom-open, per-instance scroll preservation, fresh-open bottom re-pin, pageUp/pageDown, `g`/`G`, close keys, live-tail dedupe, and width invalidation are frozen behavior.
- Overlay-internal lazy rendering alone does not remove all open cost if `InputController.showFullTranscript()` still eagerly builds every replay component.

### P3
> Status after later cycles: the first bullet is resolved by P3.1; the remaining bullets are still pending.

- Historical finding, now resolved by P3.1: `SessionManager.open()` loaded/parsed the session file twice.
- Instance `buildSessionContext()` currently materializes all entries via `getEntries()` before the pure builder walks the active path.
- `createAgentSession()` startup currently materializes again for branch flags via `getBranch()`.
- P3.2 path-only context and P3.3 startup flag dedupe should ship together; otherwise startup still pays the second pass.
- Full-tree APIs such as `getEntries()`, `getTree()`, usage statistics, and persist/rewrite paths remain intentionally expensive until separately scoped.

## Verification matrix

| Lane | Hard proof before done |
|---|---|
| P2.0 | `JWC_PERF` unset produces unchanged output; enabled mode writes bounded JSONL counters with no interactive noise. |
| P2.2 | Render goldens unchanged; input latency/redteam unchanged; viewport/commit-lane tests unchanged; new prepared-line oracle and cache-bound tests pass. |
| P2.1 | Streaming updates create/rebuild only changed tail children; usage row update does not rebuild markdown prefix; thinking collapsed/expanded/live-tail outputs unchanged. |
| P2.3 | Eager reference vs lazy viewport byte parity at bottom, pageUp, top, and mid offsets; render counters prove tail-only initial render. |
| P3 | Single file load on open; active-path context equals full-materialization oracle; abandoned branch resident blobs are not hydrated; P1.5.2 resident tests stay green. |

## Recommended next PABCD objective

**P2/P3 measured performance pass:** land opt-in measurement first, then implement the revised content-keyed TUI prepared-line cache as the first CPU patch, while preparing P3 single-load/path-only context as an independent RSS/startup slice. Do not start source mutation until the P2.0 evidence shape and revised P2.2/P3 acceptance tests are explicit in the plan.
