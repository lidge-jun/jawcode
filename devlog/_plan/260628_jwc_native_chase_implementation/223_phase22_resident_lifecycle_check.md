# 223 Phase 22 check — resident lifecycle evidence

## Status

Phase 22 build verification completed. Backend verifier initially returned `NEEDS_FIX` because this file still contained placeholders; the underlying evidence and runtime checks were already passing. This file records the completed evidence.

## Focused resident lifecycle tests

```sh
bun test packages/coding-agent/test/session-manager/resident-retention.test.ts packages/coding-agent/test/session-resident-cache.test.ts packages/coding-agent/test/session-resident-lifecycle.test.ts packages/coding-agent/test/resident-materialization.test.ts packages/coding-agent/test/session-resident-ownership.test.ts
```

```text
28 pass
0 fail
171 expect() calls
Ran 28 tests across 5 files.
```

## Package typecheck

```sh
cd packages/coding-agent && bun run check:types
```

```text
$ tsgo -p tsconfig.json --noEmit
exit 0
```

## Scoped whitespace check

```sh
git diff --check -- struct_har/chase/10.040_gjc_chase_compaction_pruning_resident_memory.md devlog/_plan/260628_jwc_native_chase_implementation/220_phase22_resident_lifecycle_evidence_plan.md devlog/_plan/260628_jwc_native_chase_implementation/221_phase22_resident_lifecycle_audit.md devlog/_plan/260628_jwc_native_chase_implementation/222_phase22_resident_lifecycle_build.md devlog/_plan/260628_jwc_native_chase_implementation/223_phase22_resident_lifecycle_check.md
```

```text
exit 0
```

## Backend verification

Initial verifier result: NEEDS_FIX.

Reason:

- `223_phase22_resident_lifecycle_check.md` still contained placeholders.

Verified passing areas:

- Devlog files `220`, `221`, and `222` matched the plan.
- `struct_har/chase/10.040_gjc_chase_compaction_pruning_resident_memory.md` contains the Phase 22 evidence, keeps the card active, and leaves `10.040-C` open.
- No runtime/source/test files under `packages/`, `docs/`, or `structure/` changed.
- Focused resident lifecycle tests passed: 28 pass / 0 fail.
- `packages/coding-agent` typecheck exited 0.
- Scoped `git diff --check` exited 0.
- Unrelated `devlog/.gitignore` and `devlog/_tmp/` remained outside the Phase 22 slice.

## Final evidence before commit

The Phase 22 evidence slice is docs-only and commit-ready after this check artifact update, pending final C-phase rerun and atomic commit of only:

- `struct_har/chase/10.040_gjc_chase_compaction_pruning_resident_memory.md`
- `devlog/_plan/260628_jwc_native_chase_implementation/220_phase22_resident_lifecycle_evidence_plan.md`
- `devlog/_plan/260628_jwc_native_chase_implementation/221_phase22_resident_lifecycle_audit.md`
- `devlog/_plan/260628_jwc_native_chase_implementation/222_phase22_resident_lifecycle_build.md`
- `devlog/_plan/260628_jwc_native_chase_implementation/223_phase22_resident_lifecycle_check.md`
