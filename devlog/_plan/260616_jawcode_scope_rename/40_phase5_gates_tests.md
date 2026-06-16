# Phase 5: Gate Scripts + Test Fixtures

## Gate Scripts

### `scripts/verify-g002-gates.ts`

- Line 24: `["gajae-code", "0.4.5"]` → update or remove legacy version check
- Line 27: `ALLOWED_UNSCOPED_PACKAGE_NAMES` — add jawcode-related names
- Line 32: `["gajae-code", ["gjc"]]` → update bin mapping
- Line 200: root name check `=== "gajae-code"` → `=== "jawcode"` or keep both
- Line 231: scope check `!== "gajae-code"` → `!== "jawcode"`
- Line 236: scope prefix check `@gajae-code` → `@jawcode`

### `scripts/rebrand-inventory.ts`

- Line 39: `expectedRootPackageName = "gajae-code"` → assess (root might stay `gajae-code`)

### `scripts/check-public-legacy-zero.ts`

- Lines 16-23: allowed legacy terms list — add jawcode equivalents
- Line 42: `"gajae_code_harness"` — update to `"jawcode_harness"`
- Line 101: comment about `@gajae-code` imports in jwc package

### `scripts/jwc-release-validation.ts`

- Line 40: version match check references `@gajae-code/natives`, `@gajae-code/coding-agent` — update to `@jawcode/*`

### `scripts/sync-versions.ts`

- Line 4: comment `@gajae-code/*` → `@jawcode/*`
- Line 24: `VERSION_LOCKSTEP_EXEMPT_PACKAGES` — keep `gajae-code` for legacy package

### `scripts/verify-jwc-ui-redesign.ts`

- Lines 147-160: checks for `content="gajae-code"` and `"GJC / gajae-code"` — update to jawcode branding

### `scripts/docs-brand-sweep.ts`

- Lines 25-54: regex patterns referencing `gajae-code` — update to jawcode

### `scripts/release.ts`

- Line 239: comment `@gajae-code/*` → `@jawcode/*`

## Test Fixtures (~100 files)

### High-impact test files

| File | Changes |
|---|---|
| `test/harness-control-plane/cli.test.ts` | ~30 refs to `"gajae-code"` harness, `"gajae_code_harness_"` tmux |
| `test/harness-control-plane/seams.test.ts` | `SUPPORTED_HARNESSES` assertion |
| `test/jwc-runtime/tmux-sessions.test.ts` | `"gajae_code"` session names |
| `test/jwc-runtime/launch-worktree.test.ts` | `".gajae-code-worktrees"` |
| `test/jwc-runtime/launch-tmux.test.ts` | `"gajae_code_feature"` |
| `test/setup-cli.test.ts` | `"gajae-code"` repo name |
| `test/pi-scope-aliases.test.ts` | scope alias test data |
| `test/jwc-plugin-*.test.ts` | `"gajae-code-plugin"` kind |
| `test/acp-*.test.ts` | `name: "gajae-code"` |
| `test/jwc-ui-redesign.test.ts` | branded content checks |
| `test/default-jwc-definitions.test.ts` | `"gajae-code:"` scope checks |
| `test/status-line-git-utils.test.ts` | GitHub URL parsing tests |

### Strategy

Bulk `sed` for `gajae-code` → `jawcode` in test files, then manual review for:
1. `gajae_code` (underscore variant for tmux) → `jawcode`
2. `"gajae-code-plugin"` → `"jawcode-plugin"`
3. `gajae-code-worktrees` → `jawcode-worktrees`
4. GitHub URLs in assertions

## Verification

```bash
bun test packages/coding-agent/test/
bun test scripts/
# All tests must pass after rename
```
