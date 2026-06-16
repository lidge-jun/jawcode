# PABCD MOC — legacy workflow name inversion

Date: 2026-06-14
Status: Jaw Interview Round 0 confirmed topology; planning artifacts only.

## Confirmed topology

The user confirmed the six-component topology for fully flipping legacy workflow names:

1. **Plan contract flip** — `ralplan` internal TS/state/manifest/plan-writer contracts become `plan` or `orchestrate-plan`.
2. **Goal contract flip** — `ultragoal` internal TS/state/manifest/goal-engine contracts become `goal`.
3. **Storage/state migration policy** — `.jwc/plans/ralplan`, `.jwc/ultragoal`, and `*-state.json` path migration / dual-read / compatibility policy.
4. **CLI/API/RPC compatibility** — `jwc ralplan`, `jwc ultragoal`, RPC enums, approval gates, skill keyword aliases, deprecation windows, hidden aliases, and v2 policy.
5. **Prompt/skill/documentation surface cleanup** — `/skill:ralplan`, `/skill:ultragoal`, `$ultragoal`, title/prose remnants, command refs, and bundled skill docs.
6. **Tests/gates migration** — legacy fixture read-compat plus new canonical write-side assertions.

## PABCD slicing strategy

This work should not be one large patch. Split it into several PABCD cycles so each cycle has an auditable plan, execution boundary, and compatibility proof.

Recommended sequence:

| Cycle | Theme | Primary outcome | Why separate |
|---|---|---|---|
| PABCD-1 | Contract map + compatibility policy | Frozen canonical/legacy vocabulary and tests-first map | Prevents accidental storage/RPC breakage |
| PABCD-2 | State/manifest canonical ids | Write-side `plan`/`goal`; read-side `ralplan`/`ultragoal` aliases | Core runtime dependency for later surfaces |
| PABCD-3 | Plan writer command flip | Canonical plan artifact writer plus legacy `ralplan --write` alias | Role agents and orchestrate-p persistence depend on this |
| PABCD-4 | Goal engine command/source flip | Canonical goal source/skill values and `jwc goal` user-facing runtime | Goal ledger has separate storage/receipt risks |
| PABCD-5 | Prompt/skill/UI/RPC surface cleanup | User-facing prose/routing uses `plan`/`goal`; compatibility is explicit | Avoids agent confusion after core contracts are stable |
| PABCD-6 | Storage path migration decision | Optional `.jwc/plans/plan` and `.jwc/goal` migration | Highest risk; should happen only after explicit go/no-go |

## Current recommendation

Use PABCD-1 through PABCD-5 as the default approved migration. Treat PABCD-6 as a separate opt-in storage migration, because it risks orphaning real `.jwc` state/ledger artifacts.

## Links

- Inventory source: `devlog/_plan/260614_legacy_workflow_name_inversion/00_moc_internal_contract_flip.md`
- This MOC: `devlog/_plan/260614_legacy_workflow_name_inversion/01_pabcd_moc.md`
- Cycle docs:
  - `02_pabcd_1_contract_map.md`
  - `03_pabcd_2_state_manifest.md`
  - `04_pabcd_3_plan_writer.md`
  - `05_pabcd_4_goal_engine.md`
  - `06_pabcd_5_surface_cleanup.md`
  - `07_pabcd_6_storage_migration.md`


## Jaw Interview Round 1 decision — 2026-06-14T14:22:47.860553+00:00

Decision: **Option C selected** — include physical storage path migration in the full inversion scope.

Implications:

- `.jwc/plans/ralplan/` should migrate to a canonical plan storage path.
- `.jwc/ultragoal/` should migrate to `.jwc/goal/` or another confirmed canonical goal storage path.
- State files should migrate from `ralplan-state.json` / `ultragoal-state.json` to `plan-state.json` / `goal-state.json` with read compatibility.
- The implementation plan must include dual-read, deterministic old/new precedence, non-destructive migration tooling, and tests for old-only/new-only/both-path states.
- PABCD-6 is no longer optional; it becomes part of the overall migration, but should remain a dedicated later cycle after core canonical ids and command aliases are stable.


## Jaw Interview Round 2 decision — 2026-06-14T14:25:07.608687+00:00

Decision: canonical plan artifact storage path should use **planphase** naming.

Interpretation for subsequent planning:

- Replace `.jwc/plans/ralplan/` with `.jwc/plans/planphase/` as the new canonical physical storage root for orchestrate P-stage plan artifacts.
- Replace `.jwc/ultragoal/` with `.jwc/goal/` as the new canonical physical storage root for durable goal ledger artifacts, unless later explicitly revised.
- Keep legacy paths readable during migration:
  - `.jwc/plans/ralplan/` -> `.jwc/plans/planphase/`
  - `.jwc/ultragoal/` -> `.jwc/goal/`
- Tests must cover old-only, new-only, and both-path states/artifacts.

Rationale captured from interview:

- `.jwc/plans/plan/` was too ambiguous: it could sound like either a plan workflow path or all orchestrate planning state.
- `planphase` communicates that the directory stores the plan phase's artifacts rather than the entire orchestrate/PABCD state.


## Jaw Interview Round 3 decision — 2026-06-14T14:26:41.417350+00:00

Decision: use the agent recommendation for the canonical plan artifact writer: **`jwc planphase --write`**.

Recorded interview steering:

- Do not ask the user mechanical/logical questions that can be derived from existing repository patterns.
- Decide implementation-mechanics defaults directly when the repo already implies a safe answer.
- Ask the user only higher-level semantic/product-policy questions: compatibility posture, naming meaning, break tolerance, and user-facing doctrine.
- Batch several independent semantic questions when useful instead of one narrow implementation question at a time.

Derived defaults to carry into later PABCD plans unless contradicted:

- `jwc planphase --write` is canonical for plan-phase artifact persistence.
- `jwc ralplan --write` remains a deprecated compatibility alias during migration.
- Role-agent allowlists should move to `jwc planphase --write` plus temporary legacy alias acceptance.
- New receipts should use canonical skill/workflow id `planphase` or `plan` according to the final canonical-id decision, but command text should prefer `jwc planphase --write`.
- Storage path remains `.jwc/plans/planphase/`.


## Jaw Interview Round 4 semantic decisions — 2026-06-14T14:29:13.078234+00:00

Decisions:

1. Legacy names are **fully deprecated**.
   - `ralplan` / `ultragoal` appearing in user-facing prose, prompts, help, docs, or normal command recommendations is a bug after migration.
   - Internal aliases may remain only for compatibility reads and deprecated command/wire handling.

2. Migration conflict/failure posture is **best effort with warnings**.
   - Move what can be safely moved.
   - Preserve evidence and warnings for anything skipped or conflicting.
   - Do not silently discard old artifacts.
   - Do not fail the whole migration solely because one legacy artifact cannot be migrated, unless corruption would make continued operation unsafe.

3. RPC/API naming should also fully flip, but through phased PABCD cycles.
   - No permanent legacy wire-value doctrine.
   - Existing legacy RPC values may be accepted during compatibility phases.
   - New write/event/output contracts should converge to canonical `planphase` / `goal` values across subsequent PABCD cycles.

Derived implementation doctrine:

- Public/default prose after the migration should not advertise `/skill:ralplan`, `/skill:ultragoal`, `$ralplan`, `$ultragoal`, `jwc ralplan`, or `jwc ultragoal` except in explicit deprecation/migration diagnostics.
- Compatibility aliases should produce warnings or migration guidance where user-visible.
- PABCD cycles should progressively remove legacy wire values after compatibility tests and migration tooling exist.


## Jaw Interview Round 5 naming decision — 2026-06-14T14:30:28.850926+00:00

Decision:

- Public workflow name remains **`plan`**.
- Internal P-stage artifact/storage/writer contract becomes **`planphase`**.

Meaning:

- User-facing workflow surface: `/skill:plan` and `jwc orchestrate p`.
- Internal artifact writer: `jwc planphase --write`.
- Physical plan artifacts: `.jwc/plans/planphase/`.
- Runtime/state identifiers should use `plan` for the workflow concept where the public workflow is being represented, and `planphase` for P-stage artifact writer/storage contracts where disambiguation is needed.
- Legacy `ralplan` should be accepted only through deprecation/read-compat paths and should not appear in normal user-facing guidance.


## Jaw Interview Round 6 migration trigger decision — 2026-06-14T14:31:22.805195+00:00

Decision:

- There is no released/downloaded npm user base yet.
- Treat the rename as a **pre-release source-contract correction**, not as a public migration burden.
- Fresh installs should start directly with the new canonical names and paths.

Implications:

- No user-facing migration command is required as part of the default plan.
- No automatic migration-on-startup is required for external users.
- Product source, bundled defaults, generated manifests, tests, and fixtures should be rewritten to the new canonical contracts directly.
- Compatibility aliases can be kept only where they protect local developer state or intentional legacy tests, not because of public npm backwards compatibility.
- Best-effort migration logic can be limited to in-repo/local `.jwc` development artifacts if needed, but should not dominate the implementation plan.

Updated storage doctrine:

- New canonical plan artifact path: `.jwc/plans/planphase/`.
- New canonical goal ledger path: `.jwc/goal/`.
- Existing legacy paths are not public compatibility contracts; they are local/pre-release leftovers.
