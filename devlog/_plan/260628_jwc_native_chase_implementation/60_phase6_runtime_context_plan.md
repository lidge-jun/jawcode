# 60 Phase 6 plan — runtime and context integrity

## Scope

Split and harden evidence for cards `10.037`, `10.040`, `10.051`, and `20.009`.

This phase is docs-first. These cards span process lifecycle, compaction memory, tool-call integrity, and append-only context guarantees. JWC already has several native guard surfaces, so this phase records exact ownership and safe future slices before any code change.

## Source anchors

| Card | Source | Local head |
|---|---|---|
| `10.037` | GJC runtime/process lifecycle cluster | `devlog/_gjc_chase/gajae-code` @ `a791d72a` |
| `10.040` | GJC compaction/pruning/resident memory cluster | `devlog/_gjc_chase/gajae-code` @ `a791d72a` |
| `10.051` | GJC agent composer/toolcall integrity cluster | `devlog/_gjc_chase/gajae-code` @ `a791d72a` |
| `20.009` | OMP append-only context integrity range | `devlog/_omp_chase/oh-my-pi` @ `0fc6d136c` |

## Existing JWC evidence

| Surface | Evidence |
|---|---|
| append-only session model | `docs/session.md`; `packages/coding-agent/src/session/session-manager.ts`; session-manager tests |
| compaction/pruning model | `docs/compaction.md`; `@jawcode-dev/agent-core/compaction`; `agent-session-compaction*.test.ts`; compaction tests |
| retry vs compaction separation | `docs/non-compaction-retry-policy.md`; `agent-session.ts` retry/compaction paths |
| tool-choice queue integrity | `packages/coding-agent/src/session/tool-choice-queue.ts`; `packages/coding-agent/test/tool-choice-queue.test.ts`; `docs/resolve-tool-runtime.md` |
| process/eval cleanup | `packages/coding-agent/src/eval/**`; `packages/coding-agent/src/exec/**`; python/js executor tests |

## New artifacts

| File | Purpose |
|---|---|
| `60_phase6_runtime_context_plan.md` | This plan. |
| `61_phase6_runtime_process_split.md` | Split `10.037` into runtime process lifecycle candidates. |
| `62_phase6_compaction_memory_split.md` | Split `10.040` into compaction/pruning/resident memory candidates. |
| `63_phase6_toolcall_context_split.md` | Split `10.051` and `20.009` overlap into tool-call/context integrity candidates. |
| `64_phase6_runtime_context_audit.md` | Record employee audit and fixes. |
| `65_phase6_runtime_context_build.md` | Record docs-only build output. |
| `66_phase6_runtime_context_check.md` | Record verification and commit evidence. |

## Chase docs to update

| File | Planned change |
|---|---|
| `struct_har/chase/10.037_gjc_chase_runtime_process_lifecycle_hardening.md` | Add Phase 6 split evidence, keep active. |
| `struct_har/chase/10.040_gjc_chase_compaction_pruning_resident_memory.md` | Add Phase 6 split evidence, keep active. |
| `struct_har/chase/10.051_gjc_chase_agent_composer_toolcall_integrity.md` | Add Phase 6 split evidence and `20.009` overlap, keep active. |
| `struct_har/chase/20.009_omp_chase_append_only_context_integrity.md` | Add Phase 6 source recheck and `10.051` overlap, keep reference-only. |

## Candidate slices after this phase

Each future slice requires its own PABCD cycle.

| Candidate | Owner card | Scope |
|---|---|---|
| `10.037-A` | `10.037` | Subprocess/eval cleanup audit tests for abort/timeout paths. |
| `10.037-B` | `10.037` | Non-interactive env scrub expansion if a concrete leak is found. |
| `10.037-C` | `10.037` | DAP/LSP cleanup split if concrete owner/test gaps appear. |
| `10.040-A` | `10.040` | Tool-output pruning cap regression tests against current prune policy. |
| `10.040-B` | `10.040` | Resident cache lifecycle docs/tests if gaps remain after audit. |
| `10.040-C` | `10.040` | Token accounting docs/test if a concrete mismatch appears. |
| `10.051-A` | `10.051` | Tool-choice queue lost-yield/requeue regression tests. |
| `10.051-B` | `10.051` | Agent-wire tool event digest/correlation tests if owner files show a gap. |
| `20.009-A` | `20.009` + `10.051` | Append-only context digest/reference evidence; implementation owner remains `10.051`. |

## Explicit non-changes

- Do not patch GJC or OMP source clones under `devlog/_gjc_chase` or `devlog/_omp_chase`.
- Do not rewrite `agent-session.ts` in this docs-first phase.
- Do not close any of the four cards.
- Do not add broad snapshot parity tests copied from upstream.
- Do not run full package test suites unless audit finds a code gap; use focused smoke checks for existing JWC surfaces.

## Verification plan

Docs and smoke checks:

```sh
git diff --check -- devlog/_plan/260628_jwc_native_chase_implementation/60_phase6_runtime_context_plan.md devlog/_plan/260628_jwc_native_chase_implementation/61_phase6_runtime_process_split.md devlog/_plan/260628_jwc_native_chase_implementation/62_phase6_compaction_memory_split.md devlog/_plan/260628_jwc_native_chase_implementation/63_phase6_toolcall_context_split.md struct_har/chase/10.037_gjc_chase_runtime_process_lifecycle_hardening.md struct_har/chase/10.040_gjc_chase_compaction_pruning_resident_memory.md struct_har/chase/10.051_gjc_chase_agent_composer_toolcall_integrity.md struct_har/chase/20.009_omp_chase_append_only_context_integrity.md
```

Focused tests:

```sh
bun test packages/coding-agent/test/tool-choice-queue.test.ts packages/coding-agent/test/agent-session-compaction.test.ts packages/coding-agent/test/session-manager/save-entry.test.ts
```

Package typecheck is optional for docs-only, but run `cd packages/coding-agent && bun run check:types` if any source/test code changes.
