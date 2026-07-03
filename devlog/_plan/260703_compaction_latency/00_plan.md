# Compaction Latency Reduction — Plan (DRAFT)

> Goal: cut wall-clock time of `/compact` + auto-compaction to well under half of current.
> Reference baseline: codex-rs compaction (single concise-summary call, session-prefix cache reuse,
> remote compaction replaces local work entirely).

## Root causes (verified 2026-07-03, packages/agent/src/compaction/compaction.ts)

1. **Prompt-cache bypass** — `generateSummary()` serializes the whole conversation into one
   `<conversation>` text blob with a separate `SUMMARIZATION_SYSTEM_PROMPT` (compaction.ts:726-743).
   Zero provider prefix-cache hits → full uncached prefill of the entire context.
   (The handoff path already avoids this: `HandoffOptions.systemPrompt` "passed verbatim so
   providers hit the cached prefix", compaction.ts:803-807.)
2. **`reasoning: Effort.High` hardcoded** on all three summarization calls
   (compaction.ts:780 main, :932 short, :1281 turn-prefix).
3. **Sequential LLM calls** — main summary → then `generateShortSummary` (display-only,
   ≤512 tok output) blocks the critical path (compaction.ts:1215).
4. **OpenAI remote compaction is additive, not a replacement** — on success the result is only
   stashed into `preserveData` (compaction.ts:1146-1154); local summary + short summary still run.

## Work-phase map (one PABCD cycle each)

| WP | Scope | Class | Items |
|----|-------|-------|-------|
| WP1 (10-19) | `compact()` critical-path slimming | C3 | ① short summary off critical path, ② effort High→lower, ④ remote-success early return |
| WP2 (20-29) | Cache-friendly summarization request (session prefix reuse, codex-style) | C3 | ③ |

## WP1 diff-level plan

PENDING — being finalized from consumer-tracing investigation:
- [ ] shortSummary consumers → safe deferral strategy (background patch vs cheap fallback)
- [ ] openai remote `preserveData`/`replacementHistory` consumption → early-return safety
- [ ] Effort enum semantics per provider → target effort per call

## Verification

- `bun test packages/agent/test/compaction-telemetry.test.ts packages/agent/test/remote-compaction.test.ts` (local — codex workers cannot run bun test)
- `npx tsc --noEmit` scoped per package gate
- New unit tests for changed behavior (early return, deferred short summary)
