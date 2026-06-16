# Phase 2: Package Manifest Rename

## Changes

### Every `packages/*/package.json` — `name` field

```diff
- "name": "@gajae-code/utils"
+ "name": "@jawcode/utils"
```

Full list:
- `packages/utils/package.json` — `@gajae-code/utils` → `@jawcode/utils`
- `packages/ai/package.json` — `@gajae-code/ai` → `@jawcode/ai`
- `packages/natives/package.json` — `@gajae-code/natives` → `@jawcode/natives`
- `packages/tui/package.json` — `@gajae-code/tui` → `@jawcode/tui`
- `packages/agent/package.json` — `@gajae-code/agent-core` → `@jawcode/agent-core`
- `packages/coding-agent/package.json` — `@gajae-code/coding-agent` → `@jawcode/coding-agent`
- `packages/stats/package.json` — `@gajae-code/stats` → `@jawcode/stats`
- `packages/bridge-client/package.json` — `@gajae-code/bridge-client` → `@jawcode/bridge-client`
- `packages/orchestration-token-benchmark/package.json` — `@gajae-code/orchestration-token-benchmark` → `@jawcode/orchestration-token-benchmark`
- `packages/typescript-edit-benchmark/package.json` — `@gajae-code/typescript-edit-benchmark` → `@jawcode/typescript-edit-benchmark`

### Every `packages/*/package.json` — dependency refs

All `"@gajae-code/*": "catalog:"` → `"@jawcode/*": "catalog:"`

### `packages/jwc/package.json` — hardcoded versions

```diff
- "@gajae-code/natives": "1.0.0"
+ "@jawcode/natives": "1.0.0"
- "@gajae-code/coding-agent": "1.0.0"
+ "@jawcode/coding-agent": "1.0.0"
```

### `packages/gajae-code/package.json`

Decision: keep `gajae-code` unscoped name for backward compat (npm deprecation notice).
Update internal dep:
```diff
- "@gajae-code/coding-agent": "catalog:"
+ "@jawcode/coding-agent": "catalog:"
```

### Root `package.json` — catalog

```diff
- "@gajae-code/stats": "1.0.0",
- "@gajae-code/agent-core": "1.0.0",
+ "@jawcode/stats": "1.0.0",
+ "@jawcode/agent-core": "1.0.0",
```
(all 8 entries)

### `bun.lock`

Delete and regenerate with `bun install`.

## Automation

```bash
# sed for all package.json files:
find packages -name package.json -not -path '*/node_modules/*' \
  -exec sed -i '' 's/@gajae-code\//@jawcode\//g' {} +

# Root package.json:
sed -i '' 's/@gajae-code\//@jawcode\//g' package.json

# Regenerate:
bun install
```

## Verification

```bash
grep -rn '@gajae-code' packages/*/package.json package.json | grep -v node_modules
# Expected: 0 results (except gajae-code legacy package name itself)
```
