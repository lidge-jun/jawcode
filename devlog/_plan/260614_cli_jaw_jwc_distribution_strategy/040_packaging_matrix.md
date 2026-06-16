# 040 — packaging matrix

## Decided package contract

| Concern | Decision |
|---|---|
| npm package name | `jawcode` |
| user command | `jwc` bin |
| install UX | `npm install -g jawcode` |
| cli-jaw dependency | `jawcode` |
| cli-jaw import | `import { ... } from "jawcode/sdk"` |
| local dev | `file:`/link dependency or packed tarball pointing at `packages/jwc` |
| public package exports | distributable `dist`/`dist-node` artifacts, not source TS |
| runtime provisioning | managed Bun for standalone CLI; Node-compatible SDK for cli-jaw embedding |

## Registry facts

- `npm view jwc` resolves to an unrelated package (`jwc@1.0.4`, "javascript web component").
- `npm view jawcode` returned 404 on 2026-06-14, so `jawcode` is the target package name subject to normal npm publish permissions.

## Package-dependency policy

The embedded path should be boring and inspectable:

1. Build and publish package `jawcode`.
2. Make cli-jaw depend on `jawcode`.
3. For local dev, point cli-jaw at local `jawcode` using `file:`/link or a packed tarball.
4. Smoke-test cli-jaw with no global `jwc` in `PATH`.

Do not make cli-jaw depend on a globally installed `jwc` command.

## Standalone package blocker

Legacy packaging analysis found the key blocker:

- `packages/jwc` currently imports/depends on workspace packages such as `@gajae-code/coding-agent`.
- npm users cannot install unpublished workspace dependencies.
- `packages/jwc/package.json` currently has `name: "jwc"` and `exports` pointing at `src/*.ts`; both must change before publish.

Therefore the standalone slice must choose one:

| Option | Meaning | Use when |
|---|---|---|
| bundled standalone | package includes built coding-agent/runtime JS | fastest reliable install |
| publish workspace deps | publish required internal workspace packages | only if scope ownership and naming are intentional |
| source checkout installer | installer clones repo/builds locally | not acceptable as primary user install |

Preferred P0: bundled standalone package `jawcode`, then revisit workspace dependency publishing later.
