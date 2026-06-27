# 210 Phase 21 plan — pruning cap/protected output evidence

## Work-phase

Phase 21 audits and hardens the `10.040-A` compaction/pruning slice. Initial inspection shows JWC already has strong pruning regression coverage in `@jawcode-dev/agent-core` and session compaction integration tests, so this phase starts as evidence-hardening: verify the current tests, record exact coverage, and append partial `10.040-A` evidence to the chase card.

If A/B verification finds a concrete missing edge inside `10.040-A`, this phase may add a focused regression test before closing the slice. Do not rewrite pruning strategy from upstream commit count alone.

## Source evidence

| Source | Evidence |
|---|---|
| `struct_har/chase/10.040_gjc_chase_compaction_pruning_resident_memory.md` | `10.040-A` remains open for pruning cap/protected output regression tests. |
| `devlog/_plan/260628_jwc_native_chase_implementation/62_phase6_compaction_memory_split.md` | Allows focused `agent-core`/agent-session compaction tests, not a broad rewrite. |
| `packages/agent/src/compaction/pruning.ts` | Current owner for `DEFAULT_PRUNE_CONFIG`, protected tools, stale overrides, digest notices, and pruning savings. |
| `packages/agent/test/pruning-staleness.test.ts` | Existing stale/protected read/search/edit regression suite. |
| `packages/agent/test/pruning-redteam.test.ts` | Existing protect-window/minimum-savings/protected-tool/digest red-team suite. |
| `packages/coding-agent/test/pruning-cache-epoch.test.ts` | Existing session-level guard: pruning only at compaction maintenance boundary. |

## Planned files

### MODIFY `struct_har/chase/10.040_gjc_chase_compaction_pruning_resident_memory.md`

Append Phase 21 partial evidence:

- `10.040-A` pruning cap/protected output subset is covered by existing focused tests if A/B verification confirms them.
- Keep `10.040` active because resident lifecycle `10.040-B` and token-accounting `10.040-C` remain open unless separately proven.

### NEW `devlog/_plan/260628_jwc_native_chase_implementation/211_phase21_pruning_cap_evidence_audit.md`

Record A-phase audit of whether existing tests genuinely prove `10.040-A`.

### NEW `devlog/_plan/260628_jwc_native_chase_implementation/212_phase21_pruning_cap_evidence_build.md`

Record B-phase evidence, focused test output, and any test additions if needed.

### NEW `devlog/_plan/260628_jwc_native_chase_implementation/213_phase21_pruning_cap_evidence_check.md`

Record final check output and commit evidence.

### CONDITIONAL MODIFY `packages/agent/test/pruning-redteam.test.ts` or `packages/agent/test/pruning-staleness.test.ts`

Only if audit finds a concrete missing `10.040-A` edge. Candidate acceptable additions:

- Boundary test proving `DEFAULT_PRUNE_CONFIG` protects newest outputs and protected read/skill behavior together.
- Test proving stale read override remains bounded and does not prune the newest read for the same file.

## Verification plan

Run:

```bash
bun test packages/agent/test/pruning-staleness.test.ts packages/agent/test/pruning-redteam.test.ts packages/agent/test/pruning-staleness-redteam.test.ts packages/coding-agent/test/pruning-cache-epoch.test.ts
cd packages/agent && bun run check:types
cd packages/coding-agent && bun run check:types
git diff --check -- struct_har/chase/10.040_gjc_chase_compaction_pruning_resident_memory.md devlog/_plan/260628_jwc_native_chase_implementation/210_phase21_pruning_cap_evidence_plan.md devlog/_plan/260628_jwc_native_chase_implementation/211_phase21_pruning_cap_evidence_audit.md devlog/_plan/260628_jwc_native_chase_implementation/212_phase21_pruning_cap_evidence_build.md devlog/_plan/260628_jwc_native_chase_implementation/213_phase21_pruning_cap_evidence_check.md packages/agent/test/pruning-redteam.test.ts packages/agent/test/pruning-staleness.test.ts
```

If no test file changes occur, omit test files from the final staged diff and note `no-code/test-existing evidence` in build/check docs.

## Boundaries

- Do not change pruning runtime code unless a red test proves a real `10.040-A` bug.
- Do not touch resident cache/lifecycle (`10.040-B`) in this phase.
- Do not touch token accounting (`10.040-C`) in this phase.
- Do not close full `10.040`.
- Do not stage unrelated `devlog/.gitignore` or `devlog/_tmp/`.
