# PABCD-7 — prompt legacy-name cleanup

Date: 2026-06-14
Status: proposed follow-up cycle; no source changes in this artifact.

## Problem

PABCD-1 through PABCD-6 removed `ralplan` / `ultragoal` from the first-class workflow surface and added canonical storage compatibility, but prompt text still contains named legacy references in negative/compatibility wording. The user clarified that historical docs and deprecated bridges may keep legacy names, but **active prompt guidance should not need to name them**.

Current inventory from `search "ralplan|ultragoal"` over active source/prompt paths:

### Active prompt / agent-context cleanup targets

- `AGENTS.md`
  - Repo-local contract still describes legacy source directories and the old role-agent bridge by name. This file is injected as active project context, so it should use canonical `skills/plan` / `skills/goal` source paths and describe compatibility without promoting the old names.
- `packages/coding-agent/src/defaults/jwc/skills/goal/SKILL.md`
  - Names the legacy planning skill loop in a prohibition.
- `packages/coding-agent/src/defaults/jwc/skills/jaw-interview/SKILL.md`
  - Names legacy on-disk plan artifacts, deliberate seeding, and legacy planning loop prohibitions.
- `packages/coding-agent/src/defaults/jwc/skills/plan/SKILL.md`
  - Source attribution names the upstream legacy skill.
- `packages/coding-agent/src/prompts/jaw/orchestrate-a.md`
  - Names legacy-vocabulary embedded agent prompts in Stage-A audit guidance.

### Source-code cleanup targets (comments / user-visible alias hints)

- `packages/coding-agent/src/orchestrate-runtime.ts`
  - Comment names legacy-vocabulary prompts; can be generalized.
- `packages/coding-agent/src/orchestrate-state.ts`
  - Comment names legacy critic vocabulary; can be generalized to P-stage critic vocabulary.
- `packages/coding-agent/src/skill-state/initial-phase.ts`
  - Comment names legacy verification code; can be generalized.
- `packages/coding-agent/src/modes/interactive-mode.ts`
  - Comment cites an old spec slug; can be renamed generically.
- `packages/coding-agent/src/hooks/skill-keywords.ts`
  - `$ralplan` / `$ultragoal` aliases are explicit compatibility triggers. Keep or remove only by alias policy; if kept, they must stay deprecated diagnostics, not normal recommendations.

`packages/coding-agent/src/prompts/system/system-prompt.md`, bundled role-agent prompts, and `packages/coding-agent/src/defaults/jwc-defaults.ts` are already clean: first-class workflow tags/defaults are `jaw-interview`, `plan`, `goal`, and `team`.

## Goal

Make active prompt guidance name only canonical workflow concepts:

- `jaw-interview`
- `plan` / `jwc orchestrate p`
- `planphase` for P-stage artifact writing
- `goal` / `jwc goal`
- `team`

Legacy names should not appear in bundled active prompts unless the file is explicitly a deprecated bridge/compatibility implementation, historical changelog, fixture, or runtime alias test.

## Scope

### Edit targets

1. `AGENTS.md`
   - Update bundled source paths to `packages/coding-agent/src/defaults/jwc/skills/plan/SKILL.md` and `packages/coding-agent/src/defaults/jwc/skills/goal/SKILL.md`.
   - Replace the named old bridge in role-agent guidance with canonical `jwc planphase --write ...` plus generic deprecated-alias compatibility wording only if still necessary.

2. `packages/coding-agent/src/defaults/jwc/skills/goal/SKILL.md`
   - Replace named legacy-loop prohibition with canonical wording:
     - "Do not route planning through superseded legacy planning skill loops; `jwc orchestrate p` owns consensus planning."
   - Keep `.jwc/goal/*` guidance unchanged.

3. `packages/coding-agent/src/defaults/jwc/skills/jaw-interview/SKILL.md`
   - Replace "legacy ralplan plans on disk" with "legacy planning artifacts on disk".
   - Replace "legacy `--deliberate` ralplan-seeding flag" with "legacy deliberate seeding bridge".
   - Replace "legacy ralplan skill loop" with "superseded legacy planning skill loop".
   - Keep `jwc orchestrate p --spec-ref` and `/skill:goal` as the only named handoff routes.

4. `packages/coding-agent/src/defaults/jwc/skills/plan/SKILL.md`
   - Remove the source-attribution legacy name from YAML front matter.
   - Keep the file name/skill as `plan`; keep superseded-by-orchestrate warning.
   - Do not change `jwc planphase --write` behavior.

5. `packages/coding-agent/src/prompts/jaw/orchestrate-a.md`
   - Replace "embedded ralplan-vocabulary agent prompts" with "embedded legacy-vocabulary planning prompts".
   - Preserve the instruction to fetch Stage-A audit prompts through `orchestrate audit-prompt planner|architect`.

6. Low-risk code-comment cleanup:
   - `packages/coding-agent/src/orchestrate-runtime.ts`
   - `packages/coding-agent/src/orchestrate-state.ts`
   - `packages/coding-agent/src/skill-state/initial-phase.ts`
   - `packages/coding-agent/src/modes/interactive-mode.ts`
   - Only comments/spec-slug references change; no behavior change.

7. Alias policy decision point:
   - `packages/coding-agent/src/hooks/skill-keywords.ts` currently keeps `$ralplan` / `$ultragoal` as deprecated keyword aliases.
   - Recommended default for PABCD-7: leave behavior intact, but confirm whether these should be removed entirely in a later compatibility-pruning cycle.

### Explicit non-goals

Do not remove legacy names from these categories in PABCD-7:

- Deprecated command bridges and their explicit diagnostics: `commands/ralplan.ts`, `commands/ultragoal.ts`, CLI alias registration.
- Runtime compatibility: `state-schema.ts`, `legacy-storage.ts`, `goal-mode-request.ts`, state migration code.
- Tests/fixtures that intentionally prove legacy compatibility.
- Historical changelog/devlog/structure notes that describe past names.
- Deprecated alias keyword behavior unless the cycle explicitly chooses to prune `$ralplan` / `$ultragoal`.

## Acceptance criteria

1. Active prompt/default-skill search is clean:

```sh
search "ralplan|ultragoal" AGENTS.md packages/coding-agent/src/prompts packages/coding-agent/src/defaults/jwc/skills packages/coding-agent/src/defaults/jwc-defaults.ts
```

Expected result: no active prompt/agent-context hits. Historical devlog/structure/changelog and explicit deprecated bridge/runtime-compat code may still contain legacy names.

2. First-class surface remains canonical:

```sh
bun scripts/check-visible-definitions.ts
bun scripts/check-public-legacy-zero.ts
```

3. Prompt/default-skill tests are updated only where expectations asserted the old negative wording:

```sh
bun test packages/coding-agent/test/default-jwc-definitions.test.ts packages/coding-agent/test/workflow-surface-orchestrate.test.ts
```

4. Full repo check remains green:

```sh
bun run check
```

## PABCD execution shape

Run as one direct `jwc orchestrate` cycle:

1. `jwc orchestrate p`
   - Record this plan as the P artifact.
   - Critic check is pragmatic: wording-only cleanup; fix nits inline.
2. `jwc orchestrate a`
   - Solo audit pass is sufficient unless a prompt routing ambiguity is found.
3. `jwc orchestrate b`
   - Patch the active prompt/agent-context targets, low-risk comments, and only directly affected tests.
4. `jwc orchestrate c`
   - Run the acceptance commands above.
5. `jwc orchestrate d --complete`
   - Record final evidence with search output and gate/test results.

## Risk

Low. This is prompt wording cleanup, not behavior migration. The main risk is accidentally deleting useful compatibility guidance; preserve the concept while removing the named legacy tokens from active prompts.
