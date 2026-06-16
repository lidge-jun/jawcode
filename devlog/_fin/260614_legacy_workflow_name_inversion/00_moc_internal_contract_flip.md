# Legacy workflow name inversion — internal TS contract flip plan

Date: 2026-06-14
Status: read-only investigation note; no product-source patch in this note.

## User directive

The requested "flip" is not the read-only precedence change. It is a full internal contract inversion:

- `ralplan` should become `plan` / `orchestrate-plan` everywhere it is not strictly preserved compatibility data.
- `ultragoal` should become `goal` everywhere it is not strictly preserved compatibility data.
- This includes TypeScript contracts, runtime state owners, workflow manifests, command surfaces, prompts, tests, generated manifests, fixtures, slash/hook routing, and user-facing prose.
- If the migration exposes unclear product decisions, enter Jaw Interview rather than guessing.

## Current state summary

Public/default workflow names are already partially flipped:

- `packages/coding-agent/src/defaults/jwc-defaults.ts`
  - `DEFAULT_JWC_DEFINITION_NAMES = ["jaw-interview", "plan", "team", "goal"]`
  - public `plan` loads `skills/ralplan/SKILL.md`
  - public `goal` loads `skills/ultragoal/SKILL.md`
- `packages/coding-agent/src/defaults/jwc/skills/ralplan/SKILL.md`
  - frontmatter `name: plan`
- `packages/coding-agent/src/defaults/jwc/skills/ultragoal/SKILL.md`
  - frontmatter `name: goal`
- `packages/coding-agent/src/modes/components/skill-hud/render.ts`
  - displays `ralplan` as `plan`
  - displays `ultragoal` as `goal`

But the internal runtime is still mostly legacy:

- CLI subcommands still register `jwc ralplan` and `jwc ultragoal`.
- workflow/state manifests still use `ralplan` and `ultragoal` canonical skill ids.
- state files and active-state/handoff contracts still use `ralplan` and `ultragoal`.
- prompts still route to `/skill:ultragoal` and sometimes `/skill:ralplan`.
- role agents persist via `jwc ralplan --write`.
- tests and fixtures encode `ralplan` / `ultragoal` state owners.

## High-risk contract inventory

### 1. Public command registry

Files:

- `packages/coding-agent/src/cli.ts`
- `packages/coding-agent/src/commands/ralplan.ts`
- `packages/coding-agent/src/commands/ultragoal.ts`
- `packages/coding-agent/src/commands/interview.ts`
- `packages/coding-agent/src/commands/skills.ts`
- `packages/coding-agent/src/commands/state.ts`

Observed legacy surfaces:

- `cli.ts` registers `ultragoal` and `ralplan` subcommands.
- `commands/ralplan.ts` exposes examples for `jwc ralplan ...`.
- `commands/ultragoal.ts` exposes examples for `jwc ultragoal status --json`.
- `commands/interview.ts` accepts `--handoff ralplan` and describes deliberate as handoff to ralplan.
- `commands/skills.ts` examples read `ultragoal` and `ralplan` embedded skills.
- `commands/state.ts` examples use `state ralplan` and handoff to ralplan.

Flip target:

- Public command names should become `jwc plan` / `jwc goal` or `jwc orchestrate p` / `jwc goal` depending on final product choice.
- `jwc ralplan` and `jwc ultragoal` can remain as hidden/deprecated compatibility aliases for at least one migration window.
- Help/examples should prefer `jwc orchestrate p`, `jwc plan` only if introduced, and `jwc goal`.

Open decision:

- Should there be a first-class `jwc plan` command, or is the public plan surface exclusively `jwc orchestrate p` plus the legacy writer alias? This affects `ralplan --write` replacement design.

### 2. Workflow manifest and state schema

Files:

- `packages/coding-agent/src/jwc-runtime/workflow-manifest.ts`
- `packages/coding-agent/src/jwc-runtime/workflow-manifest.generated.json`
- `packages/coding-agent/src/jwc-runtime/state-schema.ts`
- `packages/coding-agent/src/jwc-runtime/state-runtime.ts`
- `packages/coding-agent/src/skill-state/active-state.ts`
- `packages/coding-agent/src/skill-state/workflow-state-contract.ts`
- tests/fixtures under `packages/coding-agent/test/fixtures/jwc-state/`

Observed legacy contracts:

- `CANONICAL_JWC_WORKFLOW_SKILLS = ["jaw-interview", "ralplan", "goal", "ultragoal", "team"]`.
- `WORKFLOW_MANIFEST` has canonical keys `ralplan` and `ultragoal`, with getter `goal` returning `WORKFLOW_MANIFEST.ultragoal`.
- generated manifest still enumerates `ralplan` / `ultragoal` in mode/to/skill enums.
- state runtime has cases for `ralplan` and `ultragoal`.
- active state comments and behavior model the chain `jaw-interview → ralplan → ultragoal`.
- fixtures include `ralplan-valid.json`, `ralplan-legacy.json`, and `ultragoal-valid.json`.

Flip target:

- Canonical write-side skill ids should become `plan` and `goal`.
- Read-side compatibility should normalize old `ralplan` → `plan` and old `ultragoal` → `goal`.
- Existing persisted state files should keep reading without destructive migration.
- New writes should use `plan-state.json` / `goal-state.json` only after a compatibility bridge is in place.
- Generated manifest must be regenerated from source, not hand-edited.

Data-compat requirement:

- Existing `.jwc/state/**/ralplan-state.json` and `.jwc/state/**/ultragoal-state.json` must continue to load.
- Reads can support dual paths; writes should have an intentional cutover.
- If both old and new files exist, precedence must be specified.

Open decision:

- Do we write both old and new state files during a transition, or read old/write new immediately?
- Should `goal` remain both the inline goal tool name and workflow skill id, or do we need a distinct internal id like `goal-ledger` to avoid ambiguity?

### 3. Plan writer / ralplan runtime

Files:

- `packages/coding-agent/src/jwc-runtime/plan-writer.ts`
- `packages/coding-agent/src/tools/bash-allowed-prefixes.ts`
- `packages/coding-agent/src/prompts/agents/planner.md`
- `packages/coding-agent/src/prompts/agents/architect.md`
- `packages/coding-agent/src/prompts/agents/critic.md`
- `packages/coding-agent/test/jwc-runtime/ralplan-runtime.test.ts`

Observed legacy contracts:

- The implementation is already named `plan-writer.ts`, but the CLI shape is `jwc ralplan --write`.
- restricted role-agent bash allowlist only permits `jwc ralplan --write` and `jwc state`.
- role prompts instruct durable plan/review persistence through `jwc ralplan --write`.
- runtime receipts and audit metadata use `skill: "ralplan"` and command strings containing `jwc ralplan`.
- tests are named `ralplan-runtime.test.ts` and assert `jwc ralplan --write` behavior.

Flip target:

- Introduce a canonical plan writer command, likely one of:
  - `jwc plan --write ...`
  - `jwc orchestrate write-plan ...`
  - `jwc orchestrate artifact --stage ...`
- Keep `jwc ralplan --write` as compatibility alias while role prompts switch to canonical writer.
- Change receipts/audit owner skill from `ralplan` to `plan`, with read normalization for legacy receipts.
- Rename tests to plan-writer vocabulary after compatibility coverage is added.

Open decision:

- Product name for the write command: `jwc plan --write` is shorter; `jwc orchestrate artifact` is more semantically tied to PABCD.

### 4. Goal engine / ultragoal runtime

Files:

- `packages/coding-agent/src/jwc-runtime/goal-engine.ts`
- `packages/coding-agent/src/jwc-runtime/goal-cli.ts`
- `packages/coding-agent/src/jwc-runtime/goal-guard.ts`
- `packages/coding-agent/src/jwc-runtime/goal-mode-request.ts`
- `packages/coding-agent/src/jwc-runtime/state-renderer.ts`
- `packages/coding-agent/test/jwc-runtime/ultragoal-runtime.test.ts`

Observed legacy contracts:

- File names have mostly been flipped (`goal-engine.ts`, `goal-cli.ts`, `goal-guard.ts`), but string/data contracts still use `ultragoal`.
- `.jwc/ultragoal/brief.md`, `.jwc/ultragoal/goals.json`, `.jwc/ultragoal/ledger.jsonl` remain canonical storage paths.
- `DEFAULT_ULTRAGOAL_OBJECTIVE` embeds the word `ultragoal` and `.jwc/ultragoal` paths.
- pending goal-mode request uses `source: "ultragoal"`.
- workflow reconciliation writes `skill: "ultragoal"` / mode `"ultragoal"`.
- user-facing errors still say `jwc ultragoal create-goals`, `jwc ultragoal checkpoint`, and `# ultragoal status`.

Flip target:

- Canonical internal source/skill values should be `goal`.
- Public CLI should prefer `jwc goal ...`.
- Storage path should likely become `.jwc/goal/` only with a deliberate migration/read-compat plan; otherwise storage may remain legacy while prose calls it legacy compatibility.
- Constant names should become `DEFAULT_GOAL_OBJECTIVE`, with deprecated alias only if needed.
- Pending request `source` should become `goal`, with read normalization for `ultragoal`.
- tests should rename from ultragoal runtime to goal engine / goal workflow.

Open decision:

- Should `.jwc/ultragoal/` be renamed to `.jwc/goal/` now? This is the riskiest part because existing ledgers, goal-mode receipts, tests, docs, and stop hooks cite the old path.

### 5. Prompt and workflow skill prose

Files:

- `packages/coding-agent/src/prompts/system/system-prompt.md`
- `packages/coding-agent/src/defaults/jwc/skills/jaw-interview/SKILL.md`
- `packages/coding-agent/src/defaults/jwc/skills/ralplan/SKILL.md`
- `packages/coding-agent/src/defaults/jwc/skills/ultragoal/SKILL.md`
- `packages/coding-agent/src/defaults/jwc/skills/team/SKILL.md`
- `packages/coding-agent/src/defaults/jwc/skills/ultragoal/ai-slop-cleaner.md`
- `packages/coding-agent/src/jwc-runtime/workflow-command-ref.ts`

Observed legacy surfaces:

- system prompt now lists `plan` and `goal`, but runtime/path explanations still need sharper legacy-vs-public separation.
- jaw-interview still offers execution through `/skill:ultragoal` and says implementation handoff defaults to ultragoal.
- team skill still says `$ultragoal`, `/skill:ultragoal`, and `jwc ultragoal checkpoint`.
- ralplan skill is public-named `plan` but the document title/examples still center `/skill:ralplan`.
- ultragoal skill is public-named `goal` but title/prose still center Ultragoal.
- ai-slop-cleaner fragment says parent skill `ultragoal`, even though `jwc-defaults.ts` parents it under public `goal`.

Flip target:

- Public prose should use `plan`, `goal`, `jwc orchestrate p`, and `jwc goal`.
- Legacy names should appear only in explicit compatibility notes, old disk paths, or old wire values.
- `ai-slop-cleaner` should say parent skill `goal` and describe old Ultragoal only as legacy engine/data vocabulary if still needed.

### 6. Slash keyword / activation / UI routing

Files:

- `packages/coding-agent/src/hooks/skill-keywords.ts`
- `packages/coding-agent/src/modes/interactive-mode.ts`
- `packages/coding-agent/src/modes/components/skill-hud/render.ts`
- `packages/coding-agent/src/modes/shared/agent-wire/approval-gate.ts`
- `packages/coding-agent/src/modes/shared/agent-wire/workflow-gate-broker.ts`
- `packages/coding-agent/src/modes/rpc/rpc-types.ts`

Observed legacy contracts:

- `$ralplan` maps to `skill: "ralplan"`; `$ultragoal` and `$goal` map to `skill: "ultragoal"`.
- autocomplete deletes `ralplan` from public defaults, but `DEFAULT_JWC_DEFINITION_NAMES` already has `plan`, so this delete may be stale/no-op.
- HUD maps legacy ids to public labels.
- RPC stages include `ralplan`, `ultragoal`, and `goal`.
- approval gate stages still emit `ralplan` and `ultragoal`.

Flip target:

- `$goal` should route to public `goal`.
- `$ultragoal` may remain as compatibility alias but should route to `goal`.
- `$ralplan` / `consensus plan` should route to `plan` or `orchestrate p`, not legacy `ralplan`.
- approval gate and RPC contract need versioned compatibility if external clients consume `ralplan` / `ultragoal`.

Open decision:

- Is RPC v1 allowed to change enum values, or must it retain `ralplan`/`ultragoal` forever and add v2 aliases?

### 7. Tests and gates

Files/categories:

- `packages/coding-agent/test/default-jwc-definitions.test.ts`
- `packages/coding-agent/test/jwc-runtime/ralplan-runtime.test.ts`
- `packages/coding-agent/test/jwc-runtime/ultragoal-runtime.test.ts`
- `packages/coding-agent/test/fixtures/jwc-state/**`
- `packages/coding-agent/test/discovery/agent-fields.test.ts`
- prompt/system policy tests
- workflow/state/handoff tests

Flip target:

- Add tests that new canonical write-side values are `plan` / `goal`.
- Keep read-compat tests for old `ralplan` / `ultragoal` fixtures.
- Add dual-path state loading tests before changing persisted path names.
- Update default-surface tests to reject public `/skill:ralplan` and `/skill:ultragoal` guidance except explicit legacy notes.

## Migration strategy options

### Option A — Public-only cleanup

Scope:

- Fix prompts, docs, keyword routing, autocomplete, and public command help.
- Keep TS internal contracts and `.jwc` paths as `ralplan` / `ultragoal`.

Pros:

- Low migration risk.
- Keeps existing fixtures/state stable.

Cons:

- Does not satisfy the user request to flip internal TS contracts.
- Keeps future agent confusion alive.

Verdict: insufficient for this request.

### Option B — Canonical IDs flip, compatibility storage retained

Scope:

- Change write-side canonical ids to `plan` / `goal`.
- Normalize read-side `ralplan` → `plan`, `ultragoal` → `goal`.
- Public commands/prompts switch to `jwc orchestrate p` / `jwc goal` and/or new `jwc plan --write`.
- Keep `.jwc/plans/ralplan/` and `.jwc/ultragoal/` as legacy storage paths with explicit compatibility labels.

Pros:

- Flips most TS contracts without requiring destructive file migration.
- Good staged path for tests.

Cons:

- Some legacy path strings remain by design.
- Requires precise compatibility precedence.

Verdict: safest likely implementation slice.

### Option C — Full contract + storage migration

Scope:

- Everything in Option B.
- Rename storage paths to `.jwc/plans/plan/` or `.jwc/plans/orchestrate/` and `.jwc/goal/`.
- Migrate or dual-read all old files.

Pros:

- Cleanest final mental model.

Cons:

- Highest risk: existing state, ledgers, receipts, hooks, fixtures, and user work may be orphaned if migration misses a path.
- Needs explicit compatibility and rollback policy.

Verdict: requires Jaw Interview / user decision before implementation.

## Recommended plan after interview/approval

Recommended default: Option B first, Option C only after a separate migration decision.

Implementation bands:

1. Contract map and tests first
   - Define canonical ids: `plan`, `goal`.
   - Define legacy aliases: `ralplan`, `ultragoal`.
   - Add read-normalization tests before changing writers.
2. State/manifest flip
   - `CANONICAL_JWC_WORKFLOW_SKILLS`: replace write-side `ralplan`/`ultragoal` with `plan`/`goal`.
   - Add aliases `ralplan -> plan`, `ultragoal -> goal`.
   - Regenerate workflow manifest.
3. Plan writer flip
   - Add canonical writer command or orchestrate writer subcommand.
   - Update role-agent allowlists and prompts to canonical writer.
   - Keep `jwc ralplan --write` alias with tests.
4. Goal engine flip
   - Change source/skill values to `goal`.
   - Keep `.jwc/ultragoal` read/write until storage migration is approved.
   - Change user-facing command help to `jwc goal`.
5. Prompt/skill prose flip
   - `jaw-interview`, `team`, `goal`, `plan`, `system-prompt`, and command refs.
6. UI/RPC/approval gate flip
   - route public aliases to `plan`/`goal`.
   - preserve RPC compatibility with explicit v1/v2 decision.
7. Test sweep and gates
   - default workflow definitions
   - workflow state read/write
   - plan writer alias
   - goal engine alias
   - skill keyword routing
   - prompt policy tests

## Questions requiring Jaw Interview before product mutation

1. Should the canonical planning command be `jwc plan --write`, `jwc orchestrate artifact`, or only `jwc orchestrate p` plus an internal writer?
2. Should `.jwc/plans/ralplan/` be renamed, or retained forever as compatibility storage for plan artifacts?
3. Should `.jwc/ultragoal/` be renamed to `.jwc/goal/`, or retained forever as compatibility storage for goal ledgers?
4. Is RPC v1 allowed to change enum values from `ralplan`/`ultragoal` to `plan`/`goal`, or must this become a v2-only contract?
5. Should `/skill:plan` and `/skill:goal` be the only public skill entries, with `/skill:ralplan` and `/skill:ultragoal` removed, or should old names remain hidden aliases?

## Current recommendation

Enter Jaw Interview for the five decisions above before implementation. The lowest-risk technical path is Option B: flip canonical TypeScript/state/prompt contracts to `plan` and `goal`, keep legacy disk paths and CLI aliases as compatibility shims, and add tests proving old artifacts still read while new writes use new names.
