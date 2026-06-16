# PABCD-5 — surface gates

```bash
bun scripts/check-visible-definitions.ts
bun scripts/verify-g002-gates.ts
bun scripts/rebrand-inventory.ts --strict
bun scripts/check-public-legacy-zero.ts
bun test packages/coding-agent/test/workflow-surface-orchestrate.test.ts
```