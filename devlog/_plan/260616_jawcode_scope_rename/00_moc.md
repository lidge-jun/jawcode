# @gajae-code → @jawcode Scope Rename

> Status: planning
> Created: 2026-06-16

## Problem

`@gajae-code/*` is the upstream (forked) npm scope. Our fork is `jawcode`. This causes:

1. **npm publish failure** — `@gajae-code/natives@1.0.0` doesn't exist on npm, so `npm install jawcode` fails to resolve deps
2. **Version drift** — upstream publishes `@gajae-code/*@0.4.x`, our fork needs `1.0.x`, namespace collision
3. **Identity confusion** — `jawcode` binary, `@gajae-code/*` internals, `@jawcode` org on npm needed

## Scope Audit

### Package Manifests (package.json)

| Package | Current name | Proposed name | Internal deps |
|---|---|---|---|
| `packages/utils` | `@gajae-code/utils` | `@jawcode/utils` | `@gajae-code/natives` |
| `packages/ai` | `@gajae-code/ai` | `@jawcode/ai` | `@gajae-code/utils` |
| `packages/natives` | `@gajae-code/natives` | `@jawcode/natives` | — |
| `packages/tui` | `@gajae-code/tui` | `@jawcode/tui` | `@gajae-code/natives`, `@gajae-code/utils` |
| `packages/agent` | `@gajae-code/agent-core` | `@jawcode/agent-core` | `@gajae-code/ai`, `@gajae-code/natives`, `@gajae-code/utils` |
| `packages/coding-agent` | `@gajae-code/coding-agent` | `@jawcode/coding-agent` | `@gajae-code/stats`, `@gajae-code/agent-core`, `@gajae-code/ai`, `@gajae-code/natives`, `@gajae-code/tui`, `@gajae-code/utils` |
| `packages/stats` | `@gajae-code/stats` | `@jawcode/stats` | `@gajae-code/ai`, `@gajae-code/utils` |
| `packages/bridge-client` | `@gajae-code/bridge-client` | `@jawcode/bridge-client` | — |
| `packages/orchestration-token-benchmark` | `@gajae-code/orchestration-token-benchmark` | `@jawcode/orchestration-token-benchmark` | `@gajae-code/agent-core`, `@gajae-code/coding-agent`, `@gajae-code/utils`, `@gajae-code/ai`, `@gajae-code/tui` |
| `packages/typescript-edit-benchmark` | `@gajae-code/typescript-edit-benchmark` | `@jawcode/typescript-edit-benchmark` | `@gajae-code/agent-core`, `@gajae-code/coding-agent`, `@gajae-code/utils`, `@gajae-code/ai`, `@gajae-code/tui` |
| `packages/gajae-code` | `gajae-code` (unscoped) | keep or deprecate | `@gajae-code/coding-agent` |
| `packages/jwc` | `jawcode` (unscoped) | keep | `@gajae-code/natives`, `@gajae-code/coding-agent` |

**Root catalog** (`package.json`): 8 `@gajae-code/*` entries

### Source Code References (excluding dist/, CHANGELOG)

| Category | Count |
|---|---|
| Files with `@gajae-code` imports | **1,296 files** |
| Total import lines | **~3,400 lines** |
| Non-import source refs (comments, strings, URLs) | **~500 lines** |
| Markdown docs refs | **~583 lines** |
| package.json refs | **33 lines** |
| CI/workflow yml refs | **0** (already cleaned) |
| Cargo.toml/pyproject.toml refs | **6** (upstream URLs only) |

### Import Breakdown by Package

| Package | Import count |
|---|---|
| `@gajae-code/coding-agent` | 1,344 |
| `@gajae-code/utils` | 956 |
| `@gajae-code/ai` | 732 |
| `@gajae-code/tui` | 454 |
| `@gajae-code/agent-core` | 425 |
| `@gajae-code/natives` | 145 |
| `@gajae-code/stats` | 6 |

### Special Cases

1. **`gajae-code-plugin` kind** — hardcoded in plugin system (`GJC_PLUGIN_KIND`)
2. **PI_SCOPE_ALIASES** — legacy import shim maps `@gajae-code/*` → internal modules
3. **`gajae_code` tmux prefix** — `GJC_DEFAULT_TMUX_SESSION`, `GJC_TMUX_SESSION_PREFIX`
4. **`.gajae-code-worktrees`** — worktree directory name
5. **Harness control plane** — `harness: "gajae-code"` hardcoded in v1 seam
6. **npm registry URL** — `registry.npmjs.org/@gajae-code/coding-agent/latest` for version check
7. **GitHub URLs** — `can1357/gajae-code`, `Yeachan-Heo/gajae-code`, `gajae-ai/gajae-code`
8. **dist/ bundles** — `jwc.bundle.js` and `sdk.js` contain embedded `@gajae-code` strings (rebuild after rename)
9. **Test fixtures** — ~100 test files reference `gajae-code` in assertions and fixtures
10. **Gate scripts** — `verify-g002-gates.ts`, `rebrand-inventory.ts`, `check-public-legacy-zero.ts` validate `@gajae-code` scope

## Phases

| Phase | Description | Status | Estimated |
|---|---|---|---|
| 1 | npm `@jawcode` org creation + trusted publisher setup | pending | manual, 5min |
| 2 | package.json name + deps rename (all 12 packages + root catalog) | pending | 30min |
| 3 | Source import rewrite (`@gajae-code/*` → `@jawcode/*`, ~3,400 lines) | pending | ast_edit, 10min |
| 4 | Non-import source refs (comments, strings, URLs, constants) | pending | 30min |
| 5 | Gate scripts + test fixtures update | pending | 30min |
| 6 | Docs/markdown refs | pending | 15min |
| 7 | Rebuild dist bundles + bun.lock + verify | pending | 15min |
| 8 | Legacy compat: PI_SCOPE_ALIASES add `@jawcode` → `@gajae-code` reverse shim | pending | 15min |

## Strategy: ast_edit for Imports

```bash
# Phase 3 can be 90% automated:
ast_edit ops=[{pat: 'import { $$$IMPORTS } from "@gajae-code/$PKG"', out: 'import { $$$IMPORTS } from "@jawcode/$PKG"'}]
# Per-package, 7 packages × 1 call = 7 ast_edit calls
```

## Risks

1. **Backward compat** — existing `@gajae-code/*` plugins and extensions break. Mitigate with PI_SCOPE_ALIASES reverse shim.
2. **npm org availability** — `@jawcode` must be created on npm first. If taken, need alternative.
3. **Bundle rebuild** — dist/ contains embedded strings, must rebuild after source rename.
4. **Test fixture drift** — assertions comparing package names must update.

## Prerequisites

- [ ] Create `@jawcode` org on npm
- [ ] Add trusted publisher to all `@jawcode/*` packages (10 packages)
- [ ] Verify `@jawcode` org is available

## Parallelization Plan

Phase 2-6 can be parallelized across 5 subagents:
- **Agent 1**: package.json manifests (Phase 2)
- **Agent 2**: source imports via ast_edit (Phase 3)
- **Agent 3**: non-import source refs + constants (Phase 4)
- **Agent 4**: gate scripts + test fixtures (Phase 5)
- **Agent 5**: docs/markdown (Phase 6)

Phase 7-8 must be sequential after 2-6 complete.
