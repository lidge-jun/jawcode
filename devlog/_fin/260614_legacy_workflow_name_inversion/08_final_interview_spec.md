# Jaw Interview Spec: Legacy workflow name inversion

## Metadata
- Interview ID: legacy-name-inversion-260614
- Rounds: 6
- Final Ambiguity Score: 8%
- Type: brownfield
- Generated: 2026-06-14
- Threshold: 0.05
- Threshold Source: default
- Initial Context Summarized: yes
- Status: BELOW_THRESHOLD_EARLY_EXIT

## Topology

| Component | Status | Description | Coverage / Decision |
|---|---|---|---|
| Plan contract flip | active | Flip ralplan internal TS/state/manifest/plan-writer contracts | Public workflow remains `plan`; internal P-stage artifact contract becomes `planphase`; canonical writer is `jwc planphase --write`. |
| Goal contract flip | active | Flip ultragoal internal TS/state/manifest/goal-engine contracts | Canonical goal workflow/ledger name becomes `goal`; legacy `ultragoal` user-facing appearances are bugs after migration. |
| Storage/state migration policy | active | Physical storage path rename | New plan artifact path is `.jwc/plans/planphase/`; new goal ledger path is `.jwc/goal/`; no public migration burden because this is pre-release. |
| CLI/API/RPC compatibility | active | Commands, RPC enums, approval gates, aliases | Fully flip names through phased PABCD cycles; legacy names may exist only as internal/deprecated aliases during transition. |
| Prompt/skill/documentation cleanup | active | Remove user-facing legacy terms | `ralplan`/`ultragoal` visible in normal prompts/help/docs is a bug, except explicit deprecation diagnostics. |
| Tests/gates migration | active | Prove new canonical contracts | Update fixtures/gates to new canonical write-side contracts; keep only targeted local read-compat where useful. |

## Goal

Fully invert the legacy workflow names across Jawcode so `ralplan` becomes the public `plan` workflow plus internal `planphase` artifact contract, and `ultragoal` becomes `goal`, including TypeScript contracts, workflow state, CLI/API surfaces, storage paths, RPC/wire values, prompts, tests, and generated manifests.

## Constraints

- This is pre-release: no npm download/install compatibility burden exists.
- Fresh installs must start with the new canonical names and paths.
- Legacy names are fully deprecated; normal user-facing exposure is a bug.
- Internal/deprecated aliases may exist temporarily only to support phased PABCD implementation or local pre-release artifacts.
- Physical storage migration is in scope, but not as a user-facing public migration feature.
- Product/source edits require a later approved execution phase; this spec is planning output only.

## Canonical Decisions

- Public workflow name: `plan`.
- Plan phase artifact/writer/storage contract: `planphase`.
- Canonical plan writer command: `jwc planphase --write`.
- Canonical plan artifact path: `.jwc/plans/planphase/`.
- Canonical goal workflow/ledger name: `goal`.
- Canonical goal storage path: `.jwc/goal/`.
- Deprecated legacy names: `ralplan`, `ultragoal`.
- Legacy names in public prose/help/prompts after migration: bug unless inside explicit deprecation/migration diagnostics.

## PABCD Plan Slices

Use the devlog split under `devlog/_plan/260614_legacy_workflow_name_inversion/`:

1. `02_pabcd_1_contract_map.md` — canonical/legacy contract map.
2. `03_pabcd_2_state_manifest.md` — state and workflow manifest canonicalization.
3. `04_pabcd_3_plan_writer.md` — `jwc planphase --write` and legacy writer alias handling.
4. `05_pabcd_4_goal_engine.md` — goal engine and ultragoal contract flip.
5. `06_pabcd_5_surface_cleanup.md` — prompts, skills, UI, RPC/API routing cleanup.
6. `07_pabcd_6_storage_migration.md` — physical storage path migration now included as pre-release source correction.

## Acceptance Criteria

- New canonical write-side workflow/state/receipt values no longer use `ralplan` or `ultragoal`.
- New plan artifacts write under `.jwc/plans/planphase/`.
- New goal ledgers write under `.jwc/goal/`.
- Role agents persist plan/review artifacts through `jwc planphase --write`.
- `jwc ralplan` and `jwc ultragoal` are not advertised as normal user-facing commands.
- `$goal` routes to goal; `$ultragoal` and `$ralplan` are removed or deprecated aliases, not canonical routes.
- RPC/API/wire outputs converge to `plan`/`planphase` and `goal` through phased PABCD cycles.
- Tests cover fresh-install canonical behavior and any intentional local legacy read-compat.

## Assumptions Exposed & Resolved

| Assumption | Challenge | Resolution |
|---|---|---|
| Storage migration might need public backwards compatibility | User clarified npm has not shipped/downloaded | Treat as pre-release source correction; fresh installs use new paths. |
| `plan` path is clear enough | It could imply all orchestrate state | Use `.jwc/plans/planphase/` for P-stage artifacts. |
| Legacy names could remain as long-term aliases | User wants all flipped | Legacy exposure is a bug except internal/deprecation compatibility. |
| Agent should ask every mechanical implementation choice | User objected | Agent decides repo-implied mechanics; asks semantic/product-policy questions only. |

## Technical Context

Key audited files and plans are recorded in `devlog/_plan/260614_legacy_workflow_name_inversion/00_moc_internal_contract_flip.md` through `07_pabcd_6_storage_migration.md`.

## Handoff

Next step is `jwc orchestrate p --spec-ref .jwc/specs/jaw-interview-legacy-workflow-name-inversion.md` for planning. Do not implement directly from this interview without explicit execution approval.
