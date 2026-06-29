# 230 Phase 23 plan — compaction token accounting edge

## Scope

Add a focused JWC-native regression for `10.040-C` token accounting around compaction usage totals. This is not a GJC logic port; it pins JWC's existing `calculateContextTokens` contract.

## Source card

- `struct_har/chase/10.040_gjc_chase_compaction_pruning_resident_memory.md`

## Why code/test work is needed

Phase 21 closed pruning token-savings evidence and Phase 22 closed resident lifecycle evidence. The remaining `10.040-C` slice says token accounting docs/test should be added only if a concrete mismatch appears.

Audit found a concrete unpinned edge in `packages/agent/src/compaction/compaction.ts`:

```ts
export function calculateContextTokens(usage: Usage): number {
	return usage.totalTokens || usage.input + usage.output + usage.cacheRead + usage.cacheWrite;
}
```

The implementation intentionally:

1. trusts non-zero provider `totalTokens` even when it differs from local component sums;
2. falls back to `input + output + cacheRead + cacheWrite` when `totalTokens` is zero.

Existing tests cover normal totals and all-zero usage, but not this provider-total-vs-component edge.

## Planned diff

### MODIFY `packages/coding-agent/test/compaction.test.ts`

Add two tests inside `describe("Token calculation", ...)`:

```ts
it("should trust non-zero provider totalTokens over local component sums", () => {
	const usage = {
		...createMockUsage(1000, 500, 200, 100),
		totalTokens: 1234,
	};
	expect(calculateContextTokens(usage)).toBe(1234);
});

it("should fall back to component sums when provider totalTokens is zero", () => {
	const usage = {
		...createMockUsage(1000, 500, 200, 100),
		totalTokens: 0,
	};
	expect(calculateContextTokens(usage)).toBe(1800);
});
```

### MODIFY `struct_har/chase/10.040_gjc_chase_compaction_pruning_resident_memory.md`

Append Phase 23 partial evidence for `10.040-C`, noting:

- `packages/coding-agent/test/compaction.test.ts` now pins provider `totalTokens` trust and zero-total fallback.
- Existing run-summary/task/status tests continue to cover broader cache-read/cache-write reporting surfaces.
- `10.040-A`, `10.040-B`, and `10.040-C` are evidenced, but the overall card remains active unless a final card-wide close audit confirms all done-gates and MOC/index updates.

### NEW devlog artifacts

| Path | Purpose |
|---|---|
| `devlog/_plan/260628_jwc_native_chase_implementation/231_phase23_token_accounting_audit.md` | Backend plan audit result. |
| `devlog/_plan/260628_jwc_native_chase_implementation/232_phase23_token_accounting_build.md` | Build/test evidence and residual risk. |
| `devlog/_plan/260628_jwc_native_chase_implementation/233_phase23_token_accounting_check.md` | Final focused test/typecheck/diff-check evidence and commit hash. |

## Verification plan

```sh
bun test packages/coding-agent/test/compaction.test.ts
```

```sh
cd packages/coding-agent && bun run check:types
```

```sh
git diff --check -- packages/coding-agent/test/compaction.test.ts struct_har/chase/10.040_gjc_chase_compaction_pruning_resident_memory.md devlog/_plan/260628_jwc_native_chase_implementation/230_phase23_token_accounting_plan.md devlog/_plan/260628_jwc_native_chase_implementation/231_phase23_token_accounting_audit.md devlog/_plan/260628_jwc_native_chase_implementation/232_phase23_token_accounting_build.md devlog/_plan/260628_jwc_native_chase_implementation/233_phase23_token_accounting_check.md
```

## Done criteria

- Backend audit confirms the tests match current implementation intent and do not overfit.
- Focused compaction tests pass.
- `packages/coding-agent` typecheck passes.
- Scoped `git diff --check` passes.
- Chase card records Phase 23 evidence without moving the whole card to `_fin` unless a separate final close audit is performed.
- Only Phase 23 files are committed; unrelated `devlog/.gitignore` and `devlog/_tmp/` remain untouched.
