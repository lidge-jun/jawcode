# P1.5.3 — pruning digest-aware notices plan

> Status: PABCD P-stage draft (260615)
> Parent: `23_p1_5_upstream_v3_merge_plan.md`
> Scope: implement only the targeted P1.5.3 digest/staleness parity slice. P1.5.5 and P1.5.4 are complete; P1.5.2 remains follow-up.

## 1. Objective

Port the upstream Optimization Suite v3 digest-aware truncated notices and selected staleness parity without wholesale replacing Jawcode's current pruning implementation. Current Jawcode already has native token counting (`Encoding` + `countMessageTokensNative`) and staleness-aware pruning; this cycle must preserve those contracts while making pruned bash/search/grep results more informative and covering the parity edge cases with focused tests.

## 2. Non-goals

- Do not replace `packages/agent/src/compaction/pruning.ts` wholesale with upstream; upstream uses `estimateEntryTokens(entry)` and would regress Jawcode's optional native token-counting path.
- Do not change P1.5.1/P1.5.4/P1.5.5 files.
- Do not implement P1.5.2 resident cache lifecycle.
- Do not add hard perf thresholds.
- Do not modify `packages/agent/src/compaction/openai.ts`; the parent-listed token-estimation cache / `compaction-estimate-cache.test.ts` item is deferred to P4 or a later dedicated slice because the local test file does not exist.

## 3. File-level plan

### MODIFY `packages/agent/src/compaction/pruning.ts`

Targeted source deltas:

- Add `DIGEST_NOTICE_TOKEN_CAP_MULTIPLIER = 1.25`.
- Split current `createPrunedNotice(tokens)` into:
  - `createGenericPrunedNotice(tokens)` returning the existing `[Output truncated - N tokens]` text;
  - `createPrunedNotice(tokens, message?)` that appends a bounded digest only when `resultDigest(message)` returns content.
- Add digest helpers from upstream, adapted to current imports/types:
  - `firstTextContent(message: ToolResultMessage)`;
  - `firstErrorLine(text)`;
  - `truncateField(value, maxLength)`;
  - `resultDigest(message)` for `bash`, `search`, and `grep`.
- Preserve current native token-counting path:
  - keep `pruneToolOutputs(entries, config, encoding?)` signature;
  - keep `countMessageTokensNative(message as AgentMessage, encoding)` when encoding is supplied;
  - do not introduce upstream `estimateEntryTokens(entry)`.
- Update savings/candidate flow so savings accounts for the actual digest notice length:
  - `estimatePrunedSavings(tokens, notice)` instead of `estimatePrunedSavings(tokens)`;
  - candidate records carry `notice` and `savings`;
  - mutation writes `candidate.notice` into the tool result.
- Mandatory staleness source deltas from upstream `devlog/_upstream_gjc/packages/agent/src/compaction/pruning.ts`, adapted to current Jawcode structure:
  - Add File patch headers must count as touched paths.
  - `Move to` destinations must remain grouped with the current hunk.
  - failed per-file rename/grouping must not stale reads unless a same-path result succeeded.
- Preserve current Jawcode staleness behavior and edge fixes while applying those mandatory deltas: selector-stripped read paths, successful-file details, failed per-file results, `resolve`/`ast_edit`, and search-key defaults.

### MODIFY `packages/agent/test/pruning-redteam.test.ts`

Port reference for this test file: upstream `resultDigest()`, digest notice sizing, and candidate `notice`/`savings` flow in `devlog/_upstream_gjc/packages/agent/src/compaction/pruning.ts`. Staleness envelope grouping belongs to `pruning.ts` plus staleness tests, not this redteam file.
Add digest notice assertions:

- Bash result with exit code/tail/error line prunes to a notice containing `exit=`, `tail=`, and `error=` when available.
- Search/grep result prunes to a notice containing match/file counts or `search digest unavailable`.
- Digest notice remains bounded relative to generic notice; it must not grow into a large output.
- Add an explicit `tokensSaved` assertion for digest-capable pruning: expected savings must subtract the actual digest notice token estimate, not the generic notice token estimate.
- Update any inline `savedByPruning()` / generic notice helper in this test file so digest-capable and non-digest cases compute expectations separately.
- Add one focused `pruneToolOutputs(..., encoding)` regression fixture if a real test `Encoding` utility is available. If no runtime-safe fixture exists, the B summary must explicitly name the waived runtime path and C-stage must cite that artifact; typecheck alone is not sufficient without the named waiver.
- Existing generic notice assertions that depend on exact text should be adjusted only when the tool is digest-capable; non-digest tools keep exact old notice text.

### MODIFY `packages/agent/test/pruning-staleness.test.ts` and `packages/agent/test/pruning-staleness-redteam.test.ts`

Add or verify parity tests for:

- read selector stripping (`:raw`, `:50-100`, stacked selectors) when a later edit touches the base file;
- `*** Add File:` headers in patch envelopes invalidating earlier reads;
- `*** Move to:` destinations grouped with the current hunk;
- failed per-file results do not stale reads unless another same-path edit succeeded;
- search key defaults keep `skip`, `i`, and `gitignore` behavior stable.
Coverage placement:
- Existing selector, Move to, failed per-file, resolve/ast_edit, and search-default tests live in `pruning-staleness.test.ts`; keep them there.
- Add new Add File coverage to `pruning-staleness.test.ts` beside the existing Update/Delete File envelope tests.
- Use `pruning-staleness-redteam.test.ts` only for adversarial cases already housed there; do not duplicate existing non-redteam coverage.

If these cases already exist and pass, do not duplicate them; leave the existing coverage unchanged and document that the gap was already closed.
`packages/agent/test/compaction-estimate-cache.test.ts` is listed in the parent plan but is not present in this repo; it remains out of scope for this cycle until that file exists.

## 4. Verification plan

Focused gates:

```bash
bun test packages/agent/test/pruning-redteam.test.ts packages/agent/test/pruning-staleness.test.ts packages/agent/test/pruning-staleness-redteam.test.ts
bun biome check packages/agent/src/compaction/pruning.ts packages/agent/test/pruning-redteam.test.ts packages/agent/test/pruning-staleness.test.ts packages/agent/test/pruning-staleness-redteam.test.ts devlog/_plan/260614_performance/41_p1_5_3_pruning_digest_plan.md devlog/_plan/260614_performance/04_verification_matrix.md devlog/_plan/260614_performance/23_p1_5_upstream_v3_merge_plan.md
```

Package gate (blocking when run; expected to pass after focused gates):

```bash
bun --cwd=packages/agent run check
```

Parent-doc alignment:
- Update `devlog/_plan/260614_performance/04_verification_matrix.md` P1.5.3 wording so this slice owns pruning digest/staleness parity, not the absent token-estimation-cache test.
- Update `devlog/_plan/260614_performance/23_p1_5_upstream_v3_merge_plan.md` P1.5.3 verification row to remove absent `compaction-estimate-cache.test.ts` from this slice and list the three pruning tests instead.
- B summary must enumerate each staleness parity case as existing vs newly added and cite the concrete test file/fixture: selector stripping, Add File, Move to, failed per-file grouping, and search defaults.

## 5. Acceptance criteria

- Digest-capable pruned bash/search/grep outputs include bounded summary fields instead of only generic truncation text.
- Non-digest tool truncation notices remain the existing generic `[Output truncated - N tokens]` format.
- `tokensSaved` accounts for the actual digest notice length.
- Optional native token-counting via `Encoding` is preserved.
- Existing staleness protections and Jawcode edge fixes are not regressed.
- `*** Add File:` patch envelopes stale earlier reads of the added path, covered in `pruning-staleness.test.ts`.
- B summary documents each staleness parity case as existing vs newly added with test-file evidence.
- Focused pruning tests and package check pass.
- Parent matrix/plan wording is aligned so absent `compaction-estimate-cache.test.ts` / `openai.ts` cache work is not silently claimed by this slice.

## 6. Risk controls

- Targeted edit only; no wholesale upstream `pruning.ts` replacement.
- Digest text is bounded by the generic notice token estimate multiplier.
- Tests must cover both digest-capable and non-digest tools to avoid hidden behavior drift.

## 7. Follow-up after this cycle

Continue the active goal with P1.5.2 resident cache lifecycle/manual session-manager merge.
