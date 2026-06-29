# Phase 25 Check — 10.043-B search provider mapping guard

## Local verification

```bash
bun test packages/coding-agent/test/tools/web-search-duckduckgo.test.ts
```

Result: 25 pass, 1 skip, 0 fail, 37 expect() calls. The skip is the existing opt-in live DuckDuckGo e2e.

```bash
cd packages/coding-agent && bun run check:types
```

Result: pass.

```bash
git diff --check -- packages/coding-agent/test/tools/web-search-duckduckgo.test.ts struct_har/chase/10.043_gjc_chase_web_search_insane_security.md devlog/_plan/260628_jwc_native_chase_implementation/250_phase25_search_provider_mapping_plan.md devlog/_plan/260628_jwc_native_chase_implementation/251_phase25_search_provider_mapping_audit.md devlog/_plan/260628_jwc_native_chase_implementation/252_phase25_search_provider_mapping_build.md devlog/_plan/260628_jwc_native_chase_implementation/253_phase25_search_provider_mapping_check.md
```

Result: pass.

## Employee verification

Backend read-only verification: DONE.

Evidence:

- New local alias tests verified at `packages/coding-agent/test/tools/web-search-duckduckgo.test.ts`.
- `packages/coding-agent/src/web/search/provider.ts` unchanged; resolver API still takes `activeModelProvider?: string`.
- Focused tests: 25 pass, 1 skip, 0 fail, 37 expect() calls.
- `cd packages/coding-agent && bun run check:types`: pass.
- scoped `git diff --check`: pass.
