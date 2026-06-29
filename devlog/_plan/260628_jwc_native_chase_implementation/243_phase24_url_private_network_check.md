# Phase 24 Check — 10.043-A URL private-network deny

## Local verification

```bash
bun test packages/coding-agent/test/read-tool-group.test.ts packages/coding-agent/test/fetch-private-network.test.ts
```

Result: 36 pass, 0 fail, 65 expect() calls.

```bash
cd packages/coding-agent && bun run check:types
```

Result: pass.

```bash
git diff --check -- packages/coding-agent/src/web/public-fetch-url.ts packages/coding-agent/src/tools/fetch.ts packages/coding-agent/src/web/scrapers/types.ts packages/coding-agent/src/web/scrapers/utils.ts packages/coding-agent/test/read-tool-group.test.ts packages/coding-agent/test/fetch-private-network.test.ts devlog/_plan/260628_jwc_native_chase_implementation/240_phase24_url_private_network_plan.md
```

Result: pass.

## Employee verification

Backend read-only verification: DONE.

Evidence:

- Focused tests: 36 pass, 0 fail, 65 expect() calls.
- `cd packages/coding-agent && bun run check:types`: pass.
- scoped `git diff --check`: pass.
- Verified no `fetch.ts` <-> scraper cycle and confirmed private redirect hops are not fetched.
