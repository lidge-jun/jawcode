# CI Green Stabilization — Phase 1: push fix + observe remote CI

> Goal `ed5403fe-43b`. Make origin/main CI actually green. Iterate until success.
> Constraints: respect other agents' merged work; format/type/schema/test gates
> only; NO force-push, NO destructive git. Atomic commits.

## Part 1 — Easy explanation

main's CI was red because a biome formatting check failed after several agents
merged in parallel. I already committed the formatting-only fix locally
(`146cfbd`). This phase pushes that commit to main and watches the real GitHub
Actions run. If CI still fails on anything, I read the failing log, fix the root
cause (respecting other agents' code), commit, and push again — repeating until
the run is green.

## Part 2 — Root cause (already diagnosed)

CI job `check-and-package` failed at `bun run ci:check:full` → `check:tools`
(`biome check .`). Two violations on main HEAD `a7ccef5`:
- `packages/ai/src/model-manager.ts:171` — single-line call exceeded width; biome
  wants it multi-line (other agent's code; format-only).
- `packages/coding-agent/test/tools/web-search-hard-timeout.test.ts:2` — import
  names not sorted (my Phase-4 test).

Fixed via `biome check --write` on exactly those 2 files → commit `146cfbd`.

## Part 3 — Local CI-mirror verification (done before push)

| gate | result |
|---|---|
| `check:tools` (biome) | clean (only `biome.json` deprecated info, non-error) |
| `check:node20-baseline` | OK |
| `check:schemas` | no drift |
| `check:jwc-ui` | violations all empty |
| `--workspaces check` (tsgo all pkgs) | every package exit 0 |
| `ci:test:smoke` | `smoke-test: ok` |
| focused test web-search-hard-timeout | 7 pass |
| `validate:jwc-release` | fails locally ONLY due to missing packed-native in tmp dir; CI builds natives first (`build:native` precedes it), so green on CI. Env-only, not a code gap. |

## Part 4 — Execution loop

1. `git push` `146cfbd` to origin/main (user explicitly authorized green-CI via
   the goal hint; no force, no branch rewrite).
2. `gh run watch` the triggered CI run to completion.
3. If success → goal met, close.
4. If failure → `gh run view --log-failed`, identify root cause, fix respecting
   other agents, atomic commit, push, GOTO 2.

## Verification gates
- Authoritative success signal = `gh run list --branch main` top run `success`
  for workflow `CI` on the pushed SHA.
- Each local fix re-runs the relevant gate before push.

## Non-goals
- No force-push / reset / branch deletion.
- Not touching other agents' logic — format/type/schema/test stabilization only.
- Not fixing the `biome.json` deprecated-`recommended` info (non-blocking).
