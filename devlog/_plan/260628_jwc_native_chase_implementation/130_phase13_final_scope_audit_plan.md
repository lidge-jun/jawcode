# 130 Phase 13 plan — final scope audit

## Goal

Prove whether the active goal still has unfinished work inside its approved scope after Phase 12.

This phase is documentation and verification only. It must not implement new runtime behavior, edit source code, move chase cards to `_fin`, or update upstream clone checkouts.

## Source of truth

| Source | Role |
|---|---|
| `00_goal_plan.md` | Goal constraints and done definition. |
| `01_scope_matrix.md` | The 27 immediate, 5 split-audit, and 4 held classifications. |
| `02_phase_map.md` | Approved work-phase map through Phase 10. |
| `11_phase1_notification_session_registry_plan.md` through `14_phase1_notification_session_registry_check.md` | Phase 1 continuation slice for notification session registry evidence. |
| `46_phase4_threaded_surface_local_plan.md` through `58_phase4_workspace_path_confinement_check.md` | Phase 4 implementation continuations after the initial split artifacts. |
| `59_phase4_lifecycle_command_parser_plan.md` | Superseded lifecycle parser draft that must be reconciled against canonical Phase 11. |
| `110_phase11_lifecycle_command_parser_plan.md` through `113_phase11_lifecycle_command_parser_check.md` | Canonical Phase 11 lifecycle command parser evidence. |
| `114_phase12_media_policy_docs_plan.md` through `117_phase12_media_policy_docs_check.md` | Canonical Phase 12 media policy docs/test evidence. |
| `struct_har/chase/002_gap_inventory.md` | Current upstream/JWC/OMP inventory. |
| `struct_har/chase/007_follow_index.md` | Current chase execution order and active-card index. |
| `struct_har/chase/008_gjc_jwc_naming_contract.md` | JWC naming contract and upstream citation boundary. |
| Phase 1-12 devlog artifacts | Evidence that implemented or split slices were planned, audited, built, checked, and committed. |

## Numbering legend

| Pattern | Meaning |
|---|---|
| `11_phase1_*` through `14_phase1_*` | Phase 1 continuation artifacts, not Phase 11. |
| `110_phase11_*` through `113_phase11_*` | Canonical Phase 11 artifacts. |
| `114_phase12_*` through `117_phase12_*` | Canonical Phase 12 artifacts. This intentionally uses the remaining `110` band after Phase 11 instead of creating a new `120` band. |
| `130_phase13_*` through `133_phase13_*` | Final scope audit artifacts. |

`02_phase_map.md` remains the original approved map through Phase 10. Phase 13 must add a supplemental record for Phase 11 and Phase 12 rather than pretending those rows were present in the original map.

## Planned files

### New files

| Path | Purpose |
|---|---|
| `130_phase13_final_scope_audit_plan.md` | This plan. |
| `131_phase13_final_scope_audit.md` | Independent reviewer verdicts and fixes. |
| `132_phase13_final_scope_audit_build.md` | Requirement-by-requirement evidence matrix. |
| `133_phase13_final_scope_audit_check.md` | Fresh local checks, reviewer result, commit evidence. |

### Modified files

None planned.

## Requirement audit method

Phase 13 must prove each goal requirement independently:

| Requirement | Evidence to gather | Pass rule |
|---|---|---|
| 27 immediate cards handled | `01_scope_matrix.md`, `02_phase_map.md`, Phase 1-9/11/12 artifacts, latest chase cards | Every card has either implementation evidence, split evidence, rejection/defer evidence, or an explicit still-active owner outside the approved goal. |
| 5 conditional OMP cards split-audited | Phase 10 artifacts `100-108`, OMP cards `20.010-20.014` | All five cards have split artifacts and remain reference-only without false closure. |
| JWC identity preserved | naming contract plus docs/source checks | User-facing names remain `jwc`, `.jwc`, `@jawcode-dev/*`; upstream names appear only as source citations. |
| No wholesale GJC/OMP logic copy | phase build docs and source diff surface | Implemented slices are JWC-native guards, tests, docs, or additive helpers. |
| Employee audits used | phase audit/check docs | Each risk-bearing phase has employee audit or verification evidence. |
| Focused verification exists | phase check docs and fresh local commands | Source-changing phases have focused tests/types/schema/diff checks; docs-only phases have diff/docs checks. |
| Atomic commits and git hygiene | `git log`, `git status`, phase check docs | Phase commits are distinct; unrelated dirty files are preserved. |
| Remaining work classification is honest | active chase cards and phase map | Remaining active cards are outside this goal, deferred by split, held, or require separate product/security decisions. |

## Card matrix schema

`132_phase13_final_scope_audit_build.md` must include one row for every card in `01_scope_matrix.md`.

Required columns:

| Column | Meaning |
|---|---|
| Card | Chase card id. |
| Scope class | immediate, split-audit first, or held. |
| Phase evidence | Exact devlog artifact path or paths. |
| Chase evidence | Exact chase card path and relevant evidence status. |
| Classification | implemented slice, split-only, reference-only, held, out-of-goal, or deferred-by-risk. |
| Residual owner | Remaining card/slice owner or `none in active goal`. |
| Goal status | `proven`, `unproven`, or `contradicted`. |

Any `unproven` or `contradicted` row means work remains and Phase 13 must not request a pause.

## Follow-index and MOC reconciliation

`007_follow_index.md` and MOC rows can intentionally remain `⬜` when a parent card remains active after a partial slice. Phase 13 must explicitly classify each apparent drift:

| Drift type | Allowed outcome |
|---|---|
| Parent card active after a verified sub-slice | Allowed only if the residual owner is named. |
| Reference-only OMP card after split evidence | Allowed if no implementation closure is claimed. |
| Held card listed as `⬜` | Allowed if `01_scope_matrix.md` hold reason still applies. |
| Index says `⬜` but card claims full closure | Not allowed without `_fin` movement or MOC update evidence. |
| Phase docs claim completion but card has no evidence | Not allowed; continue with docs hardening. |

## Stop, pause, or continue rubric

Phase 13 can end the active goal only if all rows in the evidence matrix are `proven` and both independent reviewers answer that no reasonable in-scope PABCD phase remains.

If all active-goal requirements are proven but non-goal active chase cards remain, Phase 13 should pause with an audit summary rather than call goal completion.

If any active-goal requirement is unproven, Phase 13 must start the next PABCD work-phase instead of pausing.

## Independent audit

Dispatch read-only reviewers:

1. `Backend` checks requirement coverage, security-sensitive residual work, and whether a viable implementation slice remains within this goal.
2. `Docs` checks traceability, phase numbering, false closure risk, and naming consistency.

If either reviewer finds a viable in-scope path, this phase must record the finding and start the next PABCD work-phase instead of pausing.

## Local verification

Run:

```text
git status --short --branch
git log --oneline -20
git diff --check -- devlog/_plan/260628_jwc_native_chase_implementation/130_phase13_final_scope_audit_plan.md devlog/_plan/260628_jwc_native_chase_implementation/131_phase13_final_scope_audit.md devlog/_plan/260628_jwc_native_chase_implementation/132_phase13_final_scope_audit_build.md devlog/_plan/260628_jwc_native_chase_implementation/133_phase13_final_scope_audit_check.md
```

No package typecheck is required unless source or tests change in this phase.

## Commit scope

Stage only Phase 13 devlog files. Preserve:

```text
devlog/.gitignore
devlog/_tmp/
```
