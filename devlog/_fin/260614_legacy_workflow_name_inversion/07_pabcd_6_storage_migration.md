# PABCD-6 — optional storage path migration

Status: separate opt-in planning artifact; do not include in default migration without explicit approval.

## Goal

Decide whether physical storage paths should move from legacy names to canonical names.

## Candidate migrations

- `.jwc/plans/ralplan/` → `.jwc/plans/plan/` or `.jwc/plans/orchestrate/`
- `.jwc/ultragoal/` → `.jwc/goal/`
- `.jwc/state/**/ralplan-state.json` → `.jwc/state/**/plan-state.json`
- `.jwc/state/**/ultragoal-state.json` → `.jwc/state/**/goal-state.json`

## Risks

- Existing user plans/ledgers may be orphaned.
- Receipts and checksums reference old paths.
- Stop hooks and status renderers may miss active legacy state.
- External scripts may depend on old paths.

## Safer transition model

1. Add dual-read support.
2. New writes use canonical paths only after tests prove old reads work.
3. If old and new exist, define deterministic precedence:
   - prefer newest valid receipt by `mutated_at`, or
   - prefer canonical path if fresh, otherwise legacy path.
4. Provide a non-destructive migration command that copies, verifies hashes, and leaves old files unless user explicitly prunes.

## Default recommendation

Defer physical storage migration until after PABCD-1 through PABCD-5. Keep old storage paths as compatibility storage in the first implementation wave.

## Verification

- Dual-path read tests.
- Corrupt old/new precedence tests.
- Non-destructive migration smoke.
- Stop hook and HUD tests with old-only, new-only, and both-path states.


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
