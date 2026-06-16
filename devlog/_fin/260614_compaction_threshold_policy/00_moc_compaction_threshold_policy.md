# 260614 — compaction threshold policy + gpt-5.x early compact fix

> Status: implemented, locally verified, subagent-reviewed CLEAR/APPROVE, ready for `_fin`. Scope: `packages/coding-agent/src/session/agent-session.ts`, `packages/coding-agent/test/agent-session-auto-compaction-queue.test.ts`.

## Trigger

User reported that interactive sessions still compacted around 50% even though earlier git history suggested the "compact too early" class had been fixed. The screenshot path was a terminal screenshot, but the actionable symptom was: large 5.x-context sessions still entered auto-compaction around the halfway mark.

## Prior related fixes

Relevant git history showed multiple compaction fixes:

- `8028cbf0 fix(agent): reserve max output budget in compaction threshold (#442) (#446)` — introduced output-budget reservation for threshold math.
- `16ce10d7 fix(081.7): auto-compact threshold falls back to content estimate when usage is under-reported` — fixed providers that under-report usage by comparing against content estimates.
- `534b4f0a fix(compaction): run pre-prompt context maintenance (#542)` — added pre-prompt maintenance so oversized next prompts compact before provider overflow.

The earlier 081.7 devlog (`phase1/081.7_issue_cursor_autocompact.md`) records the opposite failure mode: compact did not fire when provider usage was under-reported. The current issue was a separate path: compact fired too early in pre-prompt maintenance for large-output catalog models.

## Root cause

`AgentSession.#checkCompaction()` had already been corrected to reserve the request-effective output budget:

```ts
shouldCompact(contextTokens, contextWindow, compactionSettings, effectiveMaxOutputTokens(this.model))
```

That means catalog `model.maxTokens` is capped by the request default cap (`DEFAULT_MAX_OUTPUT_TOKENS_CAP = 32000`) unless a caller explicitly requests a larger output budget.

`AgentSession.#checkEstimatedContextBeforePromptOnce()` still used the raw catalog value:

```ts
const maxOutputTokens = model.maxTokens ?? 0;
```

For gpt-5.x/Codex-like models with a 272K context window and 128K catalog max output, this made the pre-prompt threshold:

```text
272K - max(15% of 272K = 40.8K, reserveTokens, raw maxOutputTokens = 128K)
= 144K
≈ 53%
```

So the post-turn path behaved like the earlier fix intended, but the pre-prompt path still compacted near the halfway point.

## Fix

Changed `#checkEstimatedContextBeforePromptOnce()` to use the same request-effective output budget as the post-turn path:

```ts
const maxOutputTokens = effectiveMaxOutputTokens(model);
```

This aligns both threshold callers with the actual request budget used by stream options when no explicit larger `maxTokens` is requested.

## Policy check: is Jawcode's large-model 85% behavior defensible?

External comparison found conservative defaults around 75%:

- ECA documents `autoCompactPercentage: 75` as the default auto-compact trigger.
- Vectara's compaction docs show `threshold_percent: 75` in the agent configuration example and describe lowering/raising the threshold as a cost-vs-risk tradeoff.
- Hermes uses a lower primary compressor default, but separately uses an 85% gateway safety net and explicitly auto-raises Codex gpt-5.5 to 85% because its 272K hard cap made 50% compaction too early.

Jawcode's current default formula is not a flat percentage setting. In default sentinel mode:

```text
thresholdTokens = contextWindow - max(15% of contextWindow, reserveTokens, effectiveMaxOutputTokens)
```

With the fixed effective output budget, this yields:

- 272K gpt-5.x/Codex-style model: `272K - 40.8K = 231.2K` → about 85%.
- 400K custom 5.x model: `400K - 60K = 340K` → 85%.
- 1M model: `1M - 150K = 850K` → 85%.
- 128K model: `128K - 32K = 96K` → 75% because the 32K request output cap dominates the 15% floor.
- 100K model: `100K - 32K = 68K` → 68%.

So "85%" is a large-window emergent behavior, not a universal default. Smaller windows remain more conservative because the output reserve dominates.

This is acceptable for Jawcode's current characteristics:

1. It already prunes stale tool outputs before heavier compaction.
2. It reserves output/headroom before threshold comparison rather than filling the whole advertised context window.
3. It offers explicit override knobs (`compaction.thresholdPercent`, `compaction.thresholdTokens`, `compaction.strategy`, `compaction.enabled`).
4. The main user complaint was premature compaction on large 5.x sessions, and Hermes has an analogous gpt-5.5/Codex 85% special-case rationale.

Caveat: 75% remains the more common conservative general default. If Jawcode later optimizes for maximum overflow avoidance rather than fewer lossy summaries on large coding sessions, `compaction.thresholdPercent: 75` should become the documented/product default. For now, the source formula is coherent and the bug was inconsistent use of raw catalog output budget in one path.

## Tests run

- `bun test packages/coding-agent/test/agent-session-auto-compaction-queue.test.ts` — pass (5 pass, 3 skip).
- `bun test packages/coding-agent/test/compaction.test.ts` — pass (31 pass, 2 skip).

## Regression coverage added

Added `uses the capped request output budget for pre-prompt threshold maintenance` to `agent-session-auto-compaction-queue.test.ts`.

The test constructs a 40K-window model with a 35K catalog output limit. Raw catalog reservation would trigger pre-prompt compaction prematurely; capped request output reservation keeps the prompt below threshold and avoids `compaction:start:threshold`.

## Subagent review

- Architect review: `CLEAR` / `APPROVE`.
- Severity summary: no CRITICAL, HIGH, MEDIUM, or LOW issues requiring changes before commit.
- Persisted receipt: `.jwc/plans/ralplan/2026-06-14-1245-4412/stage-01-architect.md` (`sha256: 3b759aae6c2427486d709d7f42957a3b8a101efa5e3d048457514cb66ea2850c`).
## Files changed

- `packages/coding-agent/src/session/agent-session.ts`
- `packages/coding-agent/test/agent-session-auto-compaction-queue.test.ts`
- this devlog entry

## Decision

Keep the current default reserve-based policy. The fix makes the implementation internally consistent and restores intended large-model behavior without changing user-facing configuration semantics.