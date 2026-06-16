# 070 — decision register

## Decisions

| ID | Decision | Status |
|---|---|---|
| D-070-1 | cli-jaw and jawcode remain separate repos for now | accepted |
| D-070-2 | cli-jaw integrated mode must not require global `jwc` | accepted |
| D-070-3 | `jawcode/sdk` or a successor embedding facade is the cli-jaw contract | accepted |
| D-070-4 | standalone JWC deploy and cli-jaw embedded deploy are separate tracks | accepted |
| D-070-5 | full internal `@gajae-code/*` rename is not a pre-120 blocker | accepted |
| D-070-6 | visible legacy identity contracts must be cleaned or compatibility-aliased before public release/default promotion | accepted |
| D-070-7 | npm package name is `jawcode`; installed command remains `jwc` | accepted |
| D-070-8 | cli-jaw consumes JWC through package dependency `jawcode`, not vendored source and not global bin lookup | accepted |
| D-070-9 | standalone `jwc` must provision or include Bun so users do not separately install Bun first | accepted |

## Resolved questions

| ID | Question | Needed before |
|---|---|---|
| Q-070-1 | exact package name | resolved: `jawcode` |
| Q-070-2 | JWC artifact format consumed by cli-jaw | resolved: package dependency `jawcode` |

## Open decisions

| ID | Question | Needed before |
|---|---|---|
| Q-070-4 | fallback vendor CLI retention window after cli-jaw defaults to JWC | 160 release |

## Recently resolved

| ID | Question | Resolution |
|---|---|---|
| Q-070-3 | CI artifact/status transition: direct rename vs compatibility bridge | **Option A — direct rename.** No branch protection configured on main/dev/preview. Self-hosted runners absent (0 registered), so runner label rename is infrastructure-blocked and deferred. Job ID/name gjc-state-gates→jwc-state-gates applied 260614. |

## Default answers until changed

- Use package `jawcode` for both standalone install and cli-jaw dependency.
- Use `jawcode/sdk` for cli-jaw imports.
- Use managed Bun provisioning for standalone `jwc`.
- Use compatibility CI/status aliases for one transition if branch protection is unknown.
- Keep legacy env/path compatibility internally while exposing JWC/Jawcode-first docs and bin.
