# 280 Phase 28 plan — 10.040 compaction/pruning/resident memory final close

## Work-phase target

Close `10.040_gjc_chase_compaction_pruning_resident_memory.md` after independent audit verifies that its planned A/B/C sub-slices are all evidenced:

- `10.040-A` pruning cap/protected-output subset: Phase 21.
- `10.040-B` resident cache lifecycle subset: Phase 22.
- `10.040-C` token accounting subset: Phase 23.

This is a documentation/status close phase. No runtime code change is planned.

## Planned file changes

### MOVE `struct_har/chase/10.040_gjc_chase_compaction_pruning_resident_memory.md`

Move to:

`struct_har/chase/_fin/10/10.040_gjc_chase_compaction_pruning_resident_memory.md`

Before header/status fragments:

```md
> MOC: [10_gjc_chase_MOC](./10_gjc_chase_MOC.md) · G1 · ⬜ · **P1**
```

```md
Status: still active. Phase 6 records split boundaries only; it does not close compaction/memory done-gates.
...
Status: still active pending a separate final close audit. This records focused `10.040-C` evidence but does not move the whole card to `_fin`.
```

After header:

```md
> MOC: [10_gjc_chase_MOC](../../10_gjc_chase_MOC.md) · G1 · ✅ **_fin** · **P1**
```

After naming-contract citation retarget:

```md
> Naming: upstream `gjc`/`.gjc` → JWC `jwc`/`.jwc` per [008](../../008_gjc_jwc_naming_contract.md).
```

After final close block:

```md
## JWC Phase 28 Final Close — 2026-06-28

Phase 28 closes this card after A/B/C evidence was verified:

- `10.040-A`: Phase 21 pruning cap/protected-output evidence.
- `10.040-B`: Phase 22 resident cache lifecycle evidence.
- `10.040-C`: Phase 23 token accounting evidence.

Final verification:

- focused Phase 21/22/23 tests rechecked or independently audited.
- package typechecks remained green where relevant.
- scoped `git diff --check` passed.

Deferred/monitored source sub-features outside the A/B/C closure boundary:

- Broader active-provider auto-compaction, bounded blob-store policy, oversized tool IO caps, emergency compaction, and await-panel cache are not imported by this card unless they are already covered by the closed `10.004`/`10.014`/resident-cache surfaces or future new evidence proves a fresh JWC gap.
- OMP provider-concurrency overlap remains reference-only under `20.014`.

Status: closed. Preserve completed behavior and re-open only with new source evidence or a new JWC regression.
```

Also update earlier active status sentences to point at final close instead of saying the card remains active.

Done Gate update:

```md
- [x] Source facts checked against `a791d72a` or a newer explicitly recorded GJC head.
- [x] JWC owner files listed before implementation.
- [x] Naming translation checked against [008](../../008_gjc_jwc_naming_contract.md).
- [x] Import/adapt/reject/split decision recorded for each sub-feature.
- [x] Focused test or explicit manual evidence proves the chosen behavior.
- [x] `git diff --check` passes for the patch.
- [x] MOC/follow-index/gap inventory updated if priority or status changes.
```

Decision F update:

```md
| Decision F — residual risk | **closed / monitored** — A/B/C slices are evidenced; broader source items are deferred to existing closed overlap cards or future new evidence. |
```

### MODIFY `struct_har/chase/10_gjc_chase_MOC.md`

Change row 040 from active link to `_fin` link and mark done:

```md
| 040 | [10.040 compaction/pruning/resident memory](./_fin/10/10.040_gjc_chase_compaction_pruning_resident_memory.md) | compaction/pruning/resident memory | **P1** | ✅ _fin |
```

### MODIFY `struct_har/chase/_fin/INDEX.md`

Add GJC `_fin/10` row:

```md
| 10.040 | 10.040 — gjc chase: compaction pruning and resident memory | [10/10.040_gjc_chase_compaction_pruning_resident_memory](./10/10.040_gjc_chase_compaction_pruning_resident_memory.md) |
```

Update inventory count from 25 to 26 if the header still says 25.

### MODIFY `struct_har/chase/_fin/10/README.md`

Add the same completed-file reference if this README contains the `_fin/10` per-card listing.

### MODIFY `struct_har/chase/007_follow_index.md`

Change U5 / 040 row from active `⬜` to `_fin` done evidence:

```md
| U5 | 040 | [10.040 compaction/pruning/resident memory](./_fin/10/10.040_gjc_chase_compaction_pruning_resident_memory.md) | **P1** | ✅ _fin · phases 21–23 |
```

### MODIFY `struct_har/chase/002_gap_inventory.md`

Change the non-Telegram backlog row:

```md
| compaction/memory | active provider compaction, blob bounds, tool IO caps, await cache | 높음 — session survivability | [_fin/10.040](./_fin/10/10.040_gjc_chase_compaction_pruning_resident_memory.md) |
```

### MODIFY `struct_har/chase/20.014_omp_chase_goal_compaction_provider_concurrency.md`

Retarget inbound cross-links so the move does not create broken links:

```md
> Cross-link: related GJC card [10.040](./_fin/10/10.040_gjc_chase_compaction_pruning_resident_memory.md).
...
| GJC overlap | Check [10.040](./_fin/10/10.040_gjc_chase_compaction_pruning_resident_memory.md) before implementation to avoid duplicate chase work. |
```

Also update any later same-file `10.040` relative link to the `_fin/10` target.

### NEW `devlog/_plan/260628_jwc_native_chase_implementation/281_phase28_compaction_memory_final_close_audit.md`

Record read-only audit result.

### NEW `devlog/_plan/260628_jwc_native_chase_implementation/282_phase28_compaction_memory_final_close_build.md`

Record docs-only build result.

### NEW `devlog/_plan/260628_jwc_native_chase_implementation/283_phase28_compaction_memory_final_close_check.md`

Record final checks.

## Verification plan

Run focused tests used by the final evidence, unless audit confirms recent pass output is sufficient:

```bash
bun test packages/agent/test/pruning-staleness.test.ts packages/agent/test/pruning-redteam.test.ts packages/agent/test/pruning-staleness-redteam.test.ts packages/coding-agent/test/pruning-cache-epoch.test.ts
bun test packages/coding-agent/test/session-manager/resident-retention.test.ts packages/coding-agent/test/session-resident-cache.test.ts packages/coding-agent/test/session-resident-lifecycle.test.ts packages/coding-agent/test/resident-materialization.test.ts packages/coding-agent/test/session-resident-ownership.test.ts
bun test packages/coding-agent/test/compaction.test.ts
```

Run typechecks:

```bash
cd packages/agent && bun run check:types
cd packages/coding-agent && bun run check:types
```

Run docs whitespace:

```bash
git diff --check -- struct_har/chase/10_gjc_chase_MOC.md struct_har/chase/007_follow_index.md struct_har/chase/002_gap_inventory.md struct_har/chase/20.014_omp_chase_goal_compaction_provider_concurrency.md struct_har/chase/_fin/INDEX.md struct_har/chase/_fin/10/README.md struct_har/chase/_fin/10/10.040_gjc_chase_compaction_pruning_resident_memory.md devlog/_plan/260628_jwc_native_chase_implementation/280_phase28_compaction_memory_final_close_plan.md devlog/_plan/260628_jwc_native_chase_implementation/281_phase28_compaction_memory_final_close_audit.md devlog/_plan/260628_jwc_native_chase_implementation/282_phase28_compaction_memory_final_close_build.md devlog/_plan/260628_jwc_native_chase_implementation/283_phase28_compaction_memory_final_close_check.md
```

## Commit plan

One docs/status commit:

```text
docs(chase): close compaction memory card
```
