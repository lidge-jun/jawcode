# WP1 — compact() Critical-Path Slimming (DONE 2026-07-03)

One full PABCD cycle. Plan/audit trail: `00_plan.md` (P), codex gpt-5.5 xhigh audit round 1
FAIL → plan revision → delta re-audit PASS (A), boss-implemented + codex verify DONE 5/5 (B),
fresh gates (C).

## Files changed

- `packages/agent/src/compaction/compaction.ts`
  - ② `reasoning: Effort.High` → `clampThinkingLevelForModel(model, Effort.Low)` for the
    history summary and turn-prefix summary; `Effort.Minimal` (clamped) for the short summary.
    On Anthropic this cuts the per-call thinking budget 16,384 → 4,096/1,024
    (`ANTHROPIC_THINKING`, packages/ai/src/stream.ts:477); on OpenAI it lowers
    `reasoning_effort`. Clamping (not literals) because `requireSupportedEffort` throws on
    models with narrow effort lists (gemini-3-pro Low/High, gpt-5.1-codex-mini Medium/High).
    `generateHandoff` intentionally stays High (separate feature; follow-up candidate).
  - ① Short summary parallelized via `startShortSummary()`: input switched from the fresh
    summary to `previousSummary` (aux context only), `.catch` attached at creation (failure →
    `shortSummary: undefined`, never fails compaction, no unhandled-rejection window),
    `onProgress` omitted to avoid the short_summary(82%)/local_summary(hold 81) presenter
    interleave. Main-summary promise created before the short promise in every branch to keep
    the synchronous completeSimple call order stable (history → turn prefix → short).
  - ④ `MIN_REMOTE_SUMMARY_CHARS = 80` (exported): when OpenAI remote compaction returns a
    `compaction_summary` item with plaintext ≥ floor, that text becomes the summary and local
    `generateSummary` is skipped entirely (short summary still runs, parallel). Encrypted
    `compaction` items keep the local-summary fallback (cross-provider text). Common tail
    (upsertFileOperations, details, firstKeptEntryId, tokensBefore, preserveData) unchanged
    on all paths.
- `packages/coding-agent/test/compaction.test.ts` — 3 new cases: remote plaintext skips local
  summarization (1 completeSimple call), below-floor falls back (2 calls), short-summary
  failure isolation (compaction succeeds, `shortSummary === undefined`).

## Verification

- `npx tsc --noEmit` clean in `packages/agent` and `packages/coding-agent`.
- `bun test` compaction-telemetry + remote-compaction + compaction + build-context:
  **69 pass / 2 skip / 0 fail** (baseline before change: 12 pass in the two agent suites).

## Expected impact (Anthropic local path)

Serial [16k-thinking summary → 16k-thinking short] → parallel [4k-thinking summary ∥
1k-thinking short]. OpenAI with plaintext remote: remote call only. Remaining big lever:
WP2 ③ prompt-cache reuse (uncached prefill of the whole context is still paid once per
compaction).

## Follow-ups

- Consider lowering `generateHandoff` effort or making both configurable.
- Telemetry on how often remote `compaction_summary` plaintext occurs vs encrypted items —
  revisit the encrypted-path local fallback if plaintext dominates.
- `generateShortSummary` call site omits `convertToLlm` (pre-existing; custom app messages
  fall back to the default converter) — flag for a separate fix if intended otherwise.
