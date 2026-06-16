# 020 — architecture concept: separate repos, shared runtime

## Confirmed concept

The concept already exists in the docs:

- `README.jwc.md`: JWC is cli-jaw's native agent runtime; after the npm name decision, cli-jaw consumes package `jawcode` and imports `jawcode/sdk`.
- `_legacy/260612_jawcode_fork/phase1/03_roadmap_phases.md`: final form is a resident `JawRuntime` inside the cli-jaw server process, not a Bun sidecar.
- `_legacy/260612_jawcode_fork/phase1/057_plan_skill_compat_patch.md`: JWC maps cli-jaw development vocabulary and can read cli-jaw skills.
- `_legacy/260612_jawcode_fork/150.1_parity_gap_matrix.md`: default cli switch happens on the cli-jaw side, after parity gates.

## Boundary model

| Boundary | Owner | Contract |
|---|---|---|
| `jawcode` repo | JWC implementation | source, tests, standalone binary, SDK build |
| `jawcode/sdk` | JWC public embedding API | stable runtime/session factory consumed by cli-jaw |
| `cli-jaw` repo | orchestration/product shell | depends on `jawcode`; no global `jwc` requirement |
| `jaw.db` and cli-jaw channels | cli-jaw | session persistence, Web/Telegram/Discord routing |
| `.jwc` project/runtime state | JWC | local JWC workflows and standalone mode state |

## Non-negotiable packaging invariant

cli-jaw integrated mode must not shell out to a user-installed `jwc` binary as the primary path. It uses the `jawcode` package dependency. It may keep shell fallback for rollback, but the product goal is:

> `cli-jaw` works after installing cli-jaw alone, including JWC-backed functionality.

## Repo relationship

The repos can remain separate:

- jawcode releases npm package `jawcode` and user command `jwc`.
- cli-jaw package-depends on `jawcode` on dev and release branches.
- A future monorepo is not required to satisfy the product model.
