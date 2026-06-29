# 283 Phase 28 check — 10.040 final close

## Verification results

### Link/reference scan

Command:

```bash
rg -n "10\.040|10\.040-A|10\.040-B|10\.040-C|10\.040-D" \
  struct_har/chase/10_gjc_chase_MOC.md \
  struct_har/chase/007_follow_index.md \
  struct_har/chase/002_gap_inventory.md \
  struct_har/chase/20.014_omp_chase_goal_compaction_provider_concurrency.md \
  struct_har/chase/_fin/INDEX.md \
  struct_har/chase/_fin/10/10.040_gjc_chase_compaction_pruning_resident_memory.md
```

Result:

- `10_gjc_chase_MOC.md` points 10.040 to `./_fin/10/...` and marks it `_fin`.
- `007_follow_index.md` points U5/040 to `./_fin/10/...` and records phases 21-23.
- `002_gap_inventory.md` points compaction/memory to `_fin/10.040`.
- `20.014_omp_chase_goal_compaction_provider_concurrency.md` keeps its reference-only active status and retargets both 10.040 links to `_fin/10`.
- `_fin/INDEX.md` lists 10.040 under `10/`.
- The moved card uses `../../10_gjc_chase_MOC.md` and `../../008_gjc_jwc_naming_contract.md` links appropriate for `_fin/10/`.

### Runtime evidence recheck

Command:

```bash
bun test packages/coding-agent/test/compaction.test.ts
```

Result:

```text
34 pass
2 skip
0 fail
67 expect() calls
Ran 36 tests across 1 file. [2.15s]
```

Command:

```bash
bun test packages/agent/test/pruning-staleness.test.ts \
  packages/agent/test/pruning-redteam.test.ts \
  packages/agent/test/pruning-staleness-redteam.test.ts \
  packages/coding-agent/test/pruning-cache-epoch.test.ts
```

Result:

```text
47 pass
0 fail
174 expect() calls
Ran 47 tests across 4 files. [1092.00ms]
```

Command:

```bash
bun test packages/coding-agent/test/session-manager/resident-retention.test.ts \
  packages/coding-agent/test/session-resident-cache.test.ts \
  packages/coding-agent/test/session-resident-lifecycle.test.ts \
  packages/coding-agent/test/resident-materialization.test.ts \
  packages/coding-agent/test/session-resident-ownership.test.ts
```

Result:

```text
28 pass
0 fail
171 expect() calls
Ran 28 tests across 5 files. [403.00ms]
```

### Type and diff checks

Command:

```bash
cd packages/agent && bun run check:types
```

Result: exit 0 (`tsgo -p tsconfig.json --noEmit`).

Command:

```bash
cd packages/coding-agent && bun run check:types
```

Result: exit 0 (`tsgo -p tsconfig.json --noEmit`).

Command:

```bash
git diff --check -- \
  struct_har/chase/10_gjc_chase_MOC.md \
  struct_har/chase/007_follow_index.md \
  struct_har/chase/002_gap_inventory.md \
  struct_har/chase/20.014_omp_chase_goal_compaction_provider_concurrency.md \
  struct_har/chase/_fin/INDEX.md \
  struct_har/chase/_fin/10/10.040_gjc_chase_compaction_pruning_resident_memory.md \
  devlog/_plan/260628_jwc_native_chase_implementation/280_phase28_compaction_memory_final_close_plan.md \
  devlog/_plan/260628_jwc_native_chase_implementation/281_phase28_compaction_memory_final_close_audit.md \
  devlog/_plan/260628_jwc_native_chase_implementation/282_phase28_compaction_memory_final_close_build.md \
  devlog/_plan/260628_jwc_native_chase_implementation/283_phase28_compaction_memory_final_close_check.md
```

Result: exit 0.

## Status

Phase 28 is ready for independent read-only verification.
