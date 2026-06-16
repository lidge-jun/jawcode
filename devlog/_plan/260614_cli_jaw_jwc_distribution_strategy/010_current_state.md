# 010 — current state

## Legacy relocation

Moved under this folder:

- `_legacy/260612_jawcode_fork`
- `_legacy/260613_github_deploy`
- `_legacy/260613_packaging`
- `_legacy/260614_deploy_fork_packaging_bridge`

The legacy files remain useful for evidence, but they should not be treated as the current execution map when they disagree with this folder.

## Current progress

| Area | State | Evidence |
|---|---|---|
| fork/rebrand | roughly through 110 | legacy fork docs contain 100/110 Node/import surface planning and 150 promotion preparation |
| resident runtime concept | already established | `_legacy/260612_jawcode_fork/phase1/03_roadmap_phases.md` defines cli-jaw in-process `JawRuntime` |
| cli-jaw import surface | renamed for npm reality | `README.jwc.md` now treats `jawcode/sdk` as the package dependency import surface |
| packaging | not deploy-ready | `_legacy/260612_jawcode_fork/phase1/063.1_plan_package_scope_migration.md` notes `packages/jwc` still depends on workspace `@gajae-code/coding-agent` |
| GitHub deploy | blocked by packaging/identity | `_legacy/260614_deploy_fork_packaging_bridge/README.md` classified postinstall and package target as shared blockers |
| package name | decided | npm `jwc` is occupied; npm `jawcode` returned 404; target package is `jawcode` with bin `jwc` |
| legacy identity cleanup | required before public/default promotion | legacy promotion docs list visible bins, CI artifacts/statuses, coordinator MCP names |

## Reclassification before 120

120 must not mean "start coding against old assumptions." It means:

1. freeze `jawcode/sdk` as the package dependency contract cli-jaw will consume;
2. wire cli-jaw to get that code through package dependency `jawcode`;
3. keep standalone JWC deploy independent but compatible with the same package surface;
4. remove legacy identity from active public/current docs while allowing internal build-only compatibility where unavoidable;
5. include/provision Bun for standalone `jwc`.
