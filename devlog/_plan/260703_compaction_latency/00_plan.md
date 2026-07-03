# Compaction Latency Reduction — Plan

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
   (compaction.ts:780 main, :932 short, :1281 turn-prefix). On Anthropic this maps to a
   16,384-token thinking budget with interleaved thinking (`ANTHROPIC_THINKING`,
   packages/ai/src/stream.ts:477-484); on OpenAI it maps to `reasoning_effort: high`.
3. **Sequential LLM calls** — main summary → then `generateShortSummary` (display-only,
   ≤512 tok output) blocks the critical path (compaction.ts:1215).
4. **OpenAI remote compaction is additive, not a replacement** — on success the result is only
   stashed into `preserveData` (compaction.ts:1146-1154); local summary + short summary still run.

## Consumer-tracing facts (self-verified + codex cross-check 2026-07-03)

- `shortSummary` is optional everywhere: TUI collapsed view shows it only if present
  (`packages/coding-agent/src/modes/components/compaction-summary-message.ts:66-68`),
  session-list title fallback tolerates undefined
  (`packages/coding-agent/src/session/session-manager.ts:1957-1990`), persisted via
  `appendCompaction(summary, shortSummary, ...)` (`agent-session.ts:8103`, append-only JSONL —
  no post-hoc patch API).
- `generateShortSummary(recentMessages, historySummary, ...)` takes the fresh main summary only
  as auxiliary context (`<previous-summary>` block, compaction.ts:895-898); recentMessages
  dominate. Feeding the *previous* compaction summary instead makes it parallelizable.
- Remote compaction consumption: on rebuild, `session-manager.ts:666-690` attaches
  `providerPayload` (type `openaiResponsesHistory`) to the compactionSummary message and
  **skips hydrating kept messages** when `replacementHistory` exists (`:706-717`); the textual
  summary is only the cross-provider fallback + expanded display. The remote `compactionItem`
  may itself carry plaintext (`type: "compaction_summary"`, `summary?: string` —
  `packages/agent/src/compaction/openai.ts:39-43,510-514`).
- Effort support varies by model: `GEMINI_3_PRO_EFFORTS = [Low, High]`,
  `GPT_5_1_CODEX_MINI_EFFORTS = [Medium, High]` (packages/ai/src/model-thinking.ts:47,53).
  OpenAI path `resolveOpenAiReasoningEffort` uses `requireSupportedEffort` which **throws** on
  unsupported levels (stream.ts:560-567). Fixed literals below High are unsafe →
  use `clampThinkingLevelForModel(model, effort)` (model-thinking.ts:247-277, exported from
  `@jawcode-dev/ai` via packages/ai/src/index.ts:9).
- Anthropic path: `reasoning` omitted → thinking fully disabled (stream.ts:602-613).
- Codex cross-check additions: OpenAI Responses/Codex serializers replay `providerPayload`
  native items INSTEAD of the summary text when provider matches
  (openai-responses.ts:587-598, openai-codex-responses.ts:2604-2616) — confirms the text
  summary is cross-provider fallback only. Fork context seeds strip `providerPayload`
  (agent-session.ts:1480-1512) and therefore DO rely on the textual summary — the early-return
  path must always install a real summary text (remote plaintext qualifies). Existing test
  `packages/coding-agent/test/compaction.test.ts:511-524` asserts remote success still returns
  the LOCAL "History summary" — must be updated/extended for the plaintext early-return case.

## Work-phase map (one PABCD cycle each)

| WP | Scope | Class | Items |
|----|-------|-------|-------|
| WP1 (10-19) | `compact()` critical-path slimming | C3 | ① short summary parallelized + cheap, ② effort High→clamped Low/Minimal, ④ remote-success early return |
| WP2 (20-29) | Cache-friendly summarization request (session prefix reuse, codex-style) | C3 | ③ |

## WP1 diff-level plan

All changes in `packages/agent/src/compaction/compaction.ts` unless noted.

### ② Effort lowering (MODIFY)

- Import `clampThinkingLevelForModel` from `@jawcode-dev/ai` (compaction.ts:8-15 import block).
- `generateSummary` (:780): `reasoning: Effort.High` → `reasoning: clampThinkingLevelForModel(model, Effort.Low)`.
- `generateTurnPrefixSummary` (:1281): same → `Effort.Low` clamped.
- `generateShortSummary` (:932): same → `Effort.Minimal` clamped.
- `generateHandoff` (:864) intentionally unchanged (separate user-facing feature; follow-up).
- Rationale: summarization is extraction, not reasoning; codex-rs uses session effort with a
  "be concise" prompt, Claude Code disables tools/thinking for compact. Clamp keeps
  models with narrow effort lists (gemini-3-pro, codex-mini) from throwing.

### ① Short summary off the critical path (MODIFY)

In `compact()` (:1165-1230):
- Build `shortSummaryPromise = generateShortSummary(recentMessages, previousSummary, ...)`
  (NOTE: `previousSummary`, not the fresh summary) BEFORE awaiting the main summary work.
  Promise creation order (main first, short second) preserves the synchronous
  `completeSimple` call order that `mockResolvedValueOnce` chains in existing tests depend on.
- **Failure policy (audit fix):** attach `.catch(err => { logger.warn(...); return undefined })
  ` to `shortSummaryPromise` AT CREATION — this (a) isolates short-summary failure
  (compaction returns `shortSummary: undefined`), and (b) prevents an unhandled rejection
  when the MAIN summary throws first and `compact()` rethrows without awaiting the short
  promise. Main-summary failure semantics unchanged: it propagates; the in-flight short call
  is left to settle harmlessly (same `signal` aborts both on user cancel; a non-abort main
  failure does not cancel it — accepted, it is a ≤512-token call).
- **Progress (audit fix):** the parallel short-summary call gets `onProgress: undefined` so
  `generateShortSummary`'s internal `short_summary`(82%) emit (compaction.ts:902-909) never
  interleaves with `local_summary` (hold 81) — avoiding the presenter percent-cap regression
  (compaction-progress.ts:153-161). Instead `compact()` emits one
  `parallel_local_summaries` update before awaiting. The `short_summary` segment remains only
  where short summary runs alone (remote early-return path).

### ④ Remote-success skip of local summarization (MODIFY)

In `compact()` remote branch (:1124-1163) — restructured as a BRANCH into the common
finalization tail, NOT a literal early return (audit fix: `upsertFileOperations`, `details`,
`firstKeptEntryId`, `tokensBefore` in :1232-1247 must run on every path):
- On `requestOpenAiRemoteCompaction` success where
  `remote.compactionItem.type === "compaction_summary"` and
  `remote.compactionItem.summary.trim().length >= MIN_REMOTE_SUMMARY_CHARS` (new named
  constant, 80 — sanity floor against degenerate/empty server summaries):
  set `summary = remote.compactionItem.summary` and SKIP local `generateSummary`; flow
  continues into the shared tail (await parallel short summary → `upsertFileOperations` →
  return full `CompactionResult` incl. `preserveData`).
- **Residual risk (audit finding, accepted with mitigation):** repo code cannot prove the
  server plaintext matches the structured local summary shape. Exposure is limited to
  cross-provider switch + fork seeds (same-provider replay uses native items, never the text
  — openai-responses.ts:587-598, openai-codex-responses.ts:2604-2616). Mitigations: the
  length floor above, plus the summary text is wrapped by `renderCompactionSummaryContext`
  exactly like local summaries. Below-floor or non-plaintext results fall through to local
  summarization (behavior unchanged).
- Encrypted-only success (`type: "compaction"`): behavior unchanged (local summary still
  generated as cross-provider fallback) — conservative; revisit after telemetry.
- Remote failure: unchanged fallback to local summarization.

### Tests (NEW cases in existing suites)

- `packages/agent/test/remote-compaction.test.ts`: early-return on compaction_summary item
  (asserts no local completeSimple call), encrypted-item still summarizes locally.
- New/extended unit test for parallel short summary: main-summary failure still surfaces;
  short-summary failure yields `shortSummary === undefined` without throwing.
- `packages/coding-agent/test/compaction.test.ts`: verify integration expectations still hold.

### Verification gate

- `bun test packages/agent/test/compaction-telemetry.test.ts packages/agent/test/remote-compaction.test.ts`
  (baseline 12 pass / 0 fail, 2026-07-03) + `bun test packages/coding-agent/test/compaction.test.ts`
- `npx tsc --noEmit` (package gate) — run locally; codex workers cannot run bun test (sandbox EPERM).

## WP2 sketch (separate cycle after WP1-D)

Codex-style cache reuse: pass live session system prompt + structured messages verbatim
(as `generateHandoff` does) with the summarization instruction appended as the final user
message; drop `serializeConversation` for providers with prefix caching. Needs
`SummaryOptions` extension (systemPrompt/tools plumbed from agent-session, which already
passes `remoteInstructions: this.#baseSystemPrompt.join("\n\n")` at agent-session.ts:8023).
Detailed in `20_wp2_cache_prefix.md` when WP1 closes.

## Expected impact

| Path | Before | After WP1 |
|------|--------|-----------|
| Anthropic local | uncached prefill + 16k-thinking summary → 16k-thinking short (serial) | low-thinking summary ∥ minimal-thinking short (parallel) — thinking budget 16384→4096/1024, one serial hop removed |
| OpenAI w/ plaintext remote | remote + full local summary + short (serial) | remote only (+ parallel short) |
| OpenAI w/ encrypted remote | remote + full local + short | remote + low-effort local ∥ short |
