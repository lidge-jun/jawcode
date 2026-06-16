# Phase 6: Documentation References

~583 lines of `@gajae-code` in markdown files.

## Strategy

Bulk sed on all `.md` files excluding `devlog/_upstream_gjc/` and `CHANGELOG.md`:

```bash
find . -name '*.md' -not -path './devlog/_upstream_gjc/*' -not -name 'CHANGELOG.md' \
  -not -path './node_modules/*' \
  -exec sed -i '' 's/@gajae-code\//@jawcode\//g' {} +
```

## Key Files

| File | Description |
|---|---|
| `AGENTS.md` | References `@gajae-code/*` package namespace |
| `README.md` | Package names, install instructions |
| `README.jwc.md` | Jawcode-facing orientation |
| `CONTRIBUTING.jwc.md` | Contributor guide |
| `structure/*.md` | Architecture docs |
| `docs/*.md` | Internal docs (~40 files) |
| `packages/*/README.md` | Package-level docs |

## Exclusions

- `devlog/_upstream_gjc/` — upstream reference archive, never modify
- `CHANGELOG.md` (all packages) — historical record, keep as-is
- `devlog/_plan/260616_jawcode_scope_rename/` — this plan itself

## Verification

```bash
grep -rn '@gajae-code' --include='*.md' . \
  | grep -v '_upstream_gjc' | grep -v CHANGELOG | grep -v node_modules \
  | grep -v 'devlog/_plan/260616' | wc -l
# Expected: 0 or near-0
```
