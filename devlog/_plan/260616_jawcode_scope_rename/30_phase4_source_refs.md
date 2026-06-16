# Phase 4: Non-Import Source References

~500 lines of `@gajae-code` in source code outside import statements.
These are comments, string literals, URLs, constants, and error messages.

## Categories

### A. Constants to rename (behavioral)

| File | Constant | Current | New |
|---|---|---|---|
| `packages/coding-agent/src/extensibility/jwc-plugins/types.ts` | `GJC_PLUGIN_KIND` | `"gajae-code-plugin"` | `"jawcode-plugin"` |
| `packages/coding-agent/src/jwc-runtime/tmux-common.ts` | `GJC_DEFAULT_TMUX_SESSION` | `"gajae_code"` | `"jawcode"` |
| `packages/coding-agent/src/jwc-runtime/tmux-common.ts` | `GJC_TMUX_SESSION_PREFIX` | `"gajae_code_"` | `"jawcode_"` |
| `packages/coding-agent/src/jwc-runtime/worktree.ts` | worktree bucket | `".gajae-code-worktrees"` | `".jawcode-worktrees"` |
| `packages/coding-agent/src/harness-control-plane/seams.ts` | `SUPPORTED_HARNESSES` | `["gajae-code"]` | `["jawcode"]` |
| `packages/coding-agent/src/harness-control-plane/types.ts` | `Harness` type | `"gajae-code"` | `"jawcode"` |
| `packages/ai/src/utils/h2-fetch.ts` | Symbol | `"gajae-code.h2fetch.installed"` | `"jawcode.h2fetch.installed"` |
| `packages/coding-agent/src/extensibility/pi-scope-aliases.ts` | `PI_SCOPE_ALIASES` | includes `"gajae-code"` | add `"jawcode"` AND keep `"gajae-code"` for compat |

### B. URLs to update

| Pattern | Current | New |
|---|---|---|
| npm registry check | `registry.npmjs.org/@gajae-code/coding-agent/latest` | `registry.npmjs.org/jawcode/latest` (or `@jawcode/coding-agent`) |
| GitHub repo | `can1357/gajae-code` | `lidge-jun/jawcode` |
| GitHub repo | `Yeachan-Heo/gajae-code` | `lidge-jun/jawcode` |
| GitHub repo | `gajae-ai/gajae-code` | `lidge-jun/jawcode` |
| Theme schema | `raw.githubusercontent.com/can1357/gajae-code/...` | `raw.githubusercontent.com/lidge-jun/jawcode/...` |
| Native addon download | `github.com/can1357/gajae-code/releases/...` | `github.com/lidge-jun/jawcode/releases/...` |

### C. User-Agent strings

| File | Current | New |
|---|---|---|
| `packages/ai/src/web/...` | `"gajae-code"` | `"jawcode"` |
| `scripts/check-spoofed-versions.ts` | `"gajae-code/version-check"` | `"jawcode/version-check"` |

### D. CLI usage strings

| File | Current | New |
|---|---|---|
| `packages/ai/src/cli.ts` | `bunx @gajae-code/ai` | `bunx @jawcode/ai` |
| `packages/natives/native/loader-state.js` | `bun install @gajae-code/natives` | `bun install @jawcode/natives` |

### E. Comments (low priority, bulk sed)

~200 lines of comments referencing `@gajae-code`. Bulk `sed` after all behavioral changes.

## Automation

```bash
# Behavioral constants: manual edits (too specific for sed)
# URLs: sed with exact patterns
# Comments: bulk sed last
sed -i '' 's/@gajae-code\//@jawcode\//g' <file>
```

## Verification

```bash
grep -rn '@gajae-code' --include='*.ts' --include='*.js' packages/ scripts/ \
  | grep -v node_modules | grep -v dist/ | grep -v CHANGELOG | grep -v '_upstream' | wc -l
# Expected: near 0 (some upstream references intentionally kept)
```
