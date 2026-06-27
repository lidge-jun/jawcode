# 231 Phase 23 audit — token accounting edge

## Backend audit

Verdict: PASS.

Backend audited the Phase 23 plan against the current compaction implementation and test suite.

## Confirmed implementation contract

`packages/agent/src/compaction/compaction.ts` uses:

```ts
export function calculateContextTokens(usage: Usage): number {
	return usage.totalTokens || usage.input + usage.output + usage.cacheRead + usage.cacheWrite;
}
```

The planned tests pin two previously untested edges:

| Edge | Expected behavior |
|---|---|
| non-zero provider `totalTokens` differs from component sum | trust provider `totalTokens` |
| provider `totalTokens` is zero but components are non-zero | fall back to `input + output + cacheRead + cacheWrite` |

## Existing coverage reviewed

- `packages/coding-agent/test/compaction.test.ts` covered aligned totals and all-zero usage only.
- `packages/coding-agent/test/task/executor-wall-clock.test.ts` covered task executor propagation of `totalTokens`, not the compaction helper.
- Other status/task tests cover adjacent reporting surfaces but not this helper's fallback contract.

## Auditor guidance

- Add the two planned tests after the existing `Token calculation` cases.
- Do not alter `calculatePromptTokens`; it has a different prompt-component-first contract.
- Keep the chase update partial. This phase records `10.040-C` evidence but does not move the whole card to `_fin`.

## Audit command evidence

Baseline compaction tests before the new cases:

```text
32 pass
0 fail
```
