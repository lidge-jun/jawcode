# 156 — active public zero execution

## Goal

Execute the first enforceable active public `gajae`/`gjc` zero cleanup across
Jawcode and cli-jaw.

## Changes

### Jawcode

| Action | Path |
|---|---|
| NEW | `scripts/check-public-legacy-zero.ts` |
| MODIFY | `README.md` |
| MODIFY | `README.jwc.md` |
| MODIFY | `packages/jwc/package.json` |
| MODIFY | `packages/jwc/bin/jwc.js` |
| MODIFY | `packages/jwc/src/cli-entry.ts` |
| MODIFY | `devlog/_plan/260614_cli_jaw_jwc_distribution_strategy/150_legacy_name_flip_slice.md` |
| MODIFY | `devlog/_plan/260614_cli_jaw_jwc_distribution_strategy/180_validation_matrix.md` |
| MODIFY | `devlog/_plan/260614_cli_jaw_jwc_distribution_strategy/220_pabcd_execution_plan.md` |

### cli-jaw

| Action | Path |
|---|---|
| MODIFY | `/Users/jun/Developer/new/700_projects/cli-jaw/src/lib/tui/jawcode-tui-bundle.js` |
| MODIFY | `/Users/jun/Developer/new/700_projects/cli-jaw/src/lib/tui/jawcode-tui-bundle.mjs` |
| MODIFY | `/Users/jun/Developer/new/700_projects/cli-jaw/src/lib/tui/jawcode-interactive-bundle.mjs` |

## Execution notes

- Generated cli-jaw bundles are patched only as a bridge because they already
  exist in cli-jaw and currently leak legacy identity. The durable source fix is
  to regenerate them from cleaned Jawcode source in the later internal namespace
  cleanup.
- Do not stage unrelated cli-jaw dirty files. The cli-jaw worktree already has
  untracked code-mode recovery files; this slice touches only the tracked
  embedded bundle files needed for the active public surface.
- When `src/agent/jwc-runtime.ts` and `src/code-mode/**` become tracked, add
  them to this guard lane before publishing that slice.
- Do not restore GitHub Actions workflows.

## Verification

Jawcode:

```bash
bun scripts/check-public-legacy-zero.ts
bun --cwd=packages/coding-agent run generate-docs-index
bun scripts/check-visible-definitions.ts
bun scripts/verify-g002-gates.ts
bun scripts/rebrand-inventory.ts --strict
bun --cwd=packages/jwc run bundle
bun --cwd=packages/jwc run build:node
(cd packages/jwc && npm pack --dry-run)
git diff --check
```

cli-jaw:

```bash
npm run build
git diff --check
```

## Completion criteria

- Jawcode guard passes.
- cli-jaw build passes.
- The active public guard reports zero blocked legacy hits in both repositories.
- Jawcode and cli-jaw changes are committed separately.
