# Phase 24 Build — 10.043-A URL private-network deny

## Files changed

- `packages/coding-agent/src/web/public-fetch-url.ts`
- `packages/coding-agent/src/tools/fetch.ts`
- `packages/coding-agent/src/web/scrapers/types.ts`
- `packages/coding-agent/src/web/scrapers/utils.ts`
- `packages/coding-agent/test/read-tool-group.test.ts`
- `packages/coding-agent/test/fetch-private-network.test.ts`
- `struct_har/chase/10.043_gjc_chase_web_search_insane_security.md`

## Behavior

- URL reads now reject direct syntactic private/local hosts before special handlers or network fetch.
- `loadPage()` and `fetchBinary()` manually follow redirects, validate each hop before fetching it, and stop on private/local redirect targets.
- Subprocess refetch fallbacks (`trafilatura`, `lynx`) receive a guarded public URL.
- Existing internal URL schemes and provider local baseUrl behavior are untouched.

## Residual risk

- DNS rebinding/post-resolution IP checks remain out of scope.
- `.local`, `.internal`, and `.home.arpa` hostnames remain deferred unless they match the explicit syntactic deny rules.
- `10.043-B` and `10.043-C` remain open.
