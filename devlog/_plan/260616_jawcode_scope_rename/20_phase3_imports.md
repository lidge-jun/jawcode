# Phase 3: Source Import Rewrite

~3,400 import lines across ~1,296 files. All `from "@gajae-code/*"` → `from "@jawcode/*"`.

## Strategy: ast_edit per package

```bash
# 7 ast_edit calls, one per consumed package scope:
ast_edit ops=[{pat:'from "@gajae-code/utils"', out:'from "@jawcode/utils"'}] paths=["packages/", "scripts/"]
ast_edit ops=[{pat:'from "@gajae-code/ai"', out:'from "@jawcode/ai"'}] paths=["packages/", "scripts/"]
ast_edit ops=[{pat:'from "@gajae-code/natives"', out:'from "@jawcode/natives"'}] paths=["packages/", "scripts/"]
ast_edit ops=[{pat:'from "@gajae-code/tui"', out:'from "@jawcode/tui"'}] paths=["packages/", "scripts/"]
ast_edit ops=[{pat:'from "@gajae-code/agent-core"', out:'from "@jawcode/agent-core"'}] paths=["packages/", "scripts/"]
ast_edit ops=[{pat:'from "@gajae-code/coding-agent"', out:'from "@jawcode/coding-agent"'}] paths=["packages/", "scripts/"]
ast_edit ops=[{pat:'from "@gajae-code/stats"', out:'from "@jawcode/stats"'}] paths=["packages/", "scripts/"]
```

## Subpath imports

Some imports use subpaths: `@gajae-code/coding-agent/sdk`, `@gajae-code/ai/utils/schema`.
ast_edit string match handles these — the `from "..."` pattern matches the full string.

Fallback: `sed -i '' 's/@gajae-code\//@jawcode\//g'` on all .ts files after ast_edit for any remainders.

## Exclusions

- `dist/`, `dist-node/` — rebuilt in Phase 7
- `CHANGELOG.md` — historical, don't touch
- `node_modules/` — regenerated
- `devlog/_upstream_gjc/` — upstream reference, don't touch

## Verification

```bash
grep -rn 'from "@gajae-code' --include='*.ts' --include='*.tsx' packages/ scripts/ \
  | grep -v node_modules | grep -v dist/ | grep -v dist-node/ | grep -v CHANGELOG | wc -l
# Expected: 0
```
