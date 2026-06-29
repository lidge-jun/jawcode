# 220 Phase 22 plan — resident lifecycle evidence

## Scope

Close the evidenced `10.040-B` resident cache lifecycle subset without changing runtime behavior unless audit finds a concrete missing regression.

This is a JWC-native evidence-hardening slice. It must preserve JWC's current `SessionManager`, resident blob, and session storage logic; it must not port GJC compaction/resident implementation wholesale.

## Source card

- `struct_har/chase/10.040_gjc_chase_compaction_pruning_resident_memory.md`

## Owner surfaces

| Path | Action |
|---|---|
| `packages/coding-agent/test/session-manager/resident-retention.test.ts` | READ/VERIFY existing coverage for bounded resident entries, reload/fork/branch, historical blob refs, persist failure, in-memory resident isolation, large custom payloads, and decode-mode preservation. |
| `packages/coding-agent/test/session-resident-cache.test.ts` | READ/VERIFY existing coverage for bounded resident state with materialized reader APIs and identical text/image bytes. |
| `packages/coding-agent/test/session-resident-lifecycle.test.ts` | READ/VERIFY existing coverage for reopen, close disposal, compaction hydration clamp, fork/branch transitions, session-file switching, and `moveTo`. |
| `packages/coding-agent/test/resident-materialization.test.ts` | READ/VERIFY existing coverage for sentinel-free reader/context output and detached JSON snapshots. |
| `packages/coding-agent/test/session-resident-ownership.test.ts` | READ/VERIFY existing fail-closed resident ownership coverage. |
| `struct_har/chase/10.040_gjc_chase_compaction_pruning_resident_memory.md` | MODIFY by appending Phase 22 partial evidence for `10.040-B`; keep `10.040-C` active. |
| `devlog/_plan/260628_jwc_native_chase_implementation/221_phase22_resident_lifecycle_audit.md` | NEW audit record. |
| `devlog/_plan/260628_jwc_native_chase_implementation/222_phase22_resident_lifecycle_build.md` | NEW build/evidence record. |
| `devlog/_plan/260628_jwc_native_chase_implementation/223_phase22_resident_lifecycle_check.md` | NEW check record. |

## Planned diff

### MODIFY `struct_har/chase/10.040_gjc_chase_compaction_pruning_resident_memory.md`

Append a new section after the Phase 21 evidence:

```md
## JWC Phase 22 Partial Evidence — 2026-06-28

Phase 22 verifies and records the `10.040-B` resident cache lifecycle subset using existing JWC-native tests.

Artifacts:

- `devlog/_plan/260628_jwc_native_chase_implementation/220_phase22_resident_lifecycle_evidence_plan.md`
- `devlog/_plan/260628_jwc_native_chase_implementation/221_phase22_resident_lifecycle_audit.md`
- `devlog/_plan/260628_jwc_native_chase_implementation/222_phase22_resident_lifecycle_build.md`
- `devlog/_plan/260628_jwc_native_chase_implementation/223_phase22_resident_lifecycle_check.md`

JWC evidence:

- `packages/coding-agent/test/session-manager/resident-retention.test.ts` covers bounded resident entries while reader/context APIs materialize full content; branch/reload/fork flows; historical blob refs; sync persistence failure safety; in-memory resident isolation; large custom payloads; and text-vs-image decode mode preservation.
- `packages/coding-agent/test/session-resident-cache.test.ts` covers bounded resident state with materialized reader APIs and identical resident bytes decoded independently as text and image data.
- `packages/coding-agent/test/session-resident-lifecycle.test.ts` covers reopen, temp-dir disposal on close, compaction hydration clamp, fork/branch lifecycle transitions, session-file switching, and moving the session cwd.
- `packages/coding-agent/test/resident-materialization.test.ts` covers sentinel-free reader/context output and detached JSON-semantic snapshots.
- `packages/coding-agent/test/session-resident-ownership.test.ts` covers missing resident sentinel fail-closed behavior and stale-store restore rejection.

Verification:

- `bun test packages/coding-agent/test/session-manager/resident-retention.test.ts packages/coding-agent/test/session-resident-cache.test.ts packages/coding-agent/test/session-resident-lifecycle.test.ts packages/coding-agent/test/resident-materialization.test.ts packages/coding-agent/test/session-resident-ownership.test.ts`
- `cd packages/coding-agent && bun run check:types`

Status: still active. This closes only the evidenced `10.040-B` resident cache lifecycle subset; `10.040-C` token accounting remains open.
```

### NEW `221_phase22_resident_lifecycle_audit.md`

Record Backend audit verdict, required fixes if any, and final decision whether existing tests are sufficient.

### NEW `222_phase22_resident_lifecycle_build.md`

Record the resident lifecycle evidence matrix, changed paths, no-runtime-code rationale, and residual risk.

### NEW `223_phase22_resident_lifecycle_check.md`

Record focused test output, package typecheck output, scoped `git diff --check`, commit hash, and reviewer verdict.

## Verification plan

1. Run focused resident lifecycle tests:

```sh
bun test packages/coding-agent/test/session-manager/resident-retention.test.ts packages/coding-agent/test/session-resident-cache.test.ts packages/coding-agent/test/session-resident-lifecycle.test.ts packages/coding-agent/test/resident-materialization.test.ts packages/coding-agent/test/session-resident-ownership.test.ts
```

2. Run package typecheck:

```sh
cd packages/coding-agent && bun run check:types
```

3. Run scoped whitespace check:

```sh
git diff --check -- struct_har/chase/10.040_gjc_chase_compaction_pruning_resident_memory.md devlog/_plan/260628_jwc_native_chase_implementation/220_phase22_resident_lifecycle_evidence_plan.md devlog/_plan/260628_jwc_native_chase_implementation/221_phase22_resident_lifecycle_audit.md devlog/_plan/260628_jwc_native_chase_implementation/222_phase22_resident_lifecycle_build.md devlog/_plan/260628_jwc_native_chase_implementation/223_phase22_resident_lifecycle_check.md
```

## Done criteria

- Backend audit confirms existing tests are enough for `10.040-B`, or a concrete missing regression is added.
- Chase card records Phase 22 partial evidence without over-closing the whole card.
- Focused resident lifecycle tests pass.
- `packages/coding-agent` typecheck passes.
- Scoped `git diff --check` passes.
- Only Phase 22 files are committed; unrelated `devlog/.gitignore` and `devlog/_tmp/` remain untouched.
