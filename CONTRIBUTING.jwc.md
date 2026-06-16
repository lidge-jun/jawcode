# Contributing to Jawcode (jwc)

> **upstream jawcode** 기여는 [Yeachan-Heo/jawcode](https://github.com/Yeachan-Heo/jawcode) 정책을 따른다.
> 본 문서는 **jawcode 포크**(jwc M1 · cli-jaw M2)용 최소 안내다. beta v0.1: [structure/50_status.md](structure/50_status.md).

## Before you change code

1. Read [AGENTS.md](AGENTS.md) — coding-agent 계약과 jwc 기준 문서 정본 가이드.
2. Read [structure/11_conventions.md](structure/11_conventions.md) — rebase, `.jwc/`, cite, struct_har 갱신.
3. Primary product surface: `packages/coding-agent/`. Public bin: `packages/jwc` → `jwc`.

## Workflow surface

- Public bundled workflows: `jaw-interview`, `plan`, `goal`, `team` only — do not add default workflow definitions without product decision ([AGENTS.md](AGENTS.md)).
- Native orchestration: `jwc orchestrate` is the public planning/audit/build/check/done path. `plan` is the public workflow alias for the legacy planning engine; `goal` is the public workflow alias for the durable goal engine.
- Planning/execution gates: `jaw-interview` may produce a spec, `jwc orchestrate p` writes the reviewed plan, and source mutation still requires explicit approval unless the session is already in an approved goal-mode execution.

## Verification (typical)

```sh
bun install
bun run install:defaults
# after workflow-definition or rebrand surface changes:
bun scripts/check-visible-definitions.ts
bun scripts/verify-g002-gates.ts
bun scripts/rebrand-inventory.ts --strict
bun test packages/coding-agent/test/default-jwc-definitions.test.ts
```

Use `bun check` / package tests for focused changes — do not run raw `tsc` ([AGENTS.md](AGENTS.md)).

## Documentation

- Patched SoT: [structure/](structure/00_INDEX.md) · map: [structure/00_INDEX.md](structure/00_INDEX.md).
- Fork diff snapshots: [struct_har/](struct_har/README.md). Gaps: [struct_har/chase/](struct_har/chase/README.md).
- Active distribution and packaging plan: [devlog/_plan/260614_cli_jaw_jwc_distribution_strategy/000_moc_distribution_strategy.md](devlog/_plan/260614_cli_jaw_jwc_distribution_strategy/000_moc_distribution_strategy.md).

When you change HARD-EDIT/NEW fork files, update [structure/40_fork-delta.md](structure/40_fork-delta.md) in the same change set.

### Jawdev documentation model

`jawdev` is the Jawcode development-documentation discipline for keeping product truth, fork comparison, and implementation history separate:

- `structure/` is the maintained source of truth for current architecture, contracts, conventions, readiness, and navigation.
- `struct_har/` is the comparison + harness layer: regenerated `gjc_origin` ↔ `jwc_patched` snapshots, OMP reference facts, chase gap indexes, and the scripts under `struct_har/_scripts/` that refresh those facts.
- `devlog/` is written in the Jawdev logic style: plan folders under `devlog/_plan/`, MOC/phase numbering, concrete file-level plans, decisions, evidence, and historical implementation context. It is not the canonical current-state map; promote stable rules back into `structure/` or `AGENTS.md`.

## Commits & upstream

- Do **not** commit unless explicitly asked.
- Upstream mirror: `devlog/_upstream_gjc/` (gitignored). Rebase: [structure/11_conventions.md](structure/11_conventions.md).

## Questions

Use GitHub issues on the Jawcode repository for jwc-specific work. Cite `structure/` + the active devlog MOC in issue bodies.
