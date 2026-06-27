# Phase 24 Plan — 10.043-A URL private-network deny

## Summary

Add a JWC-native public URL guard before the `read` URL fetch pipeline touches the network. The guard blocks syntactic local/private hosts for URL reads and transport-level redirect hops while preserving existing internal URL schemes and model-provider local baseUrl behavior outside this surface.

## Source card

- `struct_har/chase/10.043_gjc_chase_web_search_insane_security.md`
- Prior split: `devlog/_plan/260628_jwc_native_chase_implementation/73_phase7_search_url_boundary_split.md`

## Threat boundary

`read` URL input is user-controlled and can currently reach `loadPage()`/`fetchBinary()` for arbitrary `http(s)` targets. The protected boundary is public URL fetch -> local/private network. This slice blocks obvious SSRF-style local/private hosts before fetch attempts, including syntactic redirect hops exposed by HTTP `Location` headers.

## Scope

### Modify

- `packages/coding-agent/src/web/public-fetch-url.ts` (NEW)
  - Add exported helper `assertPublicFetchUrl(url: string): string`.
  - Keep this as a leaf module so `tools/fetch.ts`, `web/scrapers/types.ts`, and `web/scrapers/utils.ts` can import it without creating `fetch.ts` <-> scraper cycles.
  - Normalize URL once, parse with `URL`, reject non-`http(s)` schemes, reject URL credentials, and reject:
    - `localhost`, `*.localhost`
    - `0.0.0.0`
    - IPv4 loopback `127.0.0.0/8`
    - IPv4 link-local `169.254.0.0/16`
    - RFC1918 IPv4: `10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16`
    - IPv6 loopback `::1`
    - IPv6 link-local `fe80::/10`
    - IPv6 unique-local `fc00::/7`
    - IPv4-mapped IPv6 equivalents where `URL.hostname` exposes them as bracketed IPv6.
  - Throw `ToolError("Blocked URL: private or local network targets are not allowed")` for blocked targets.

- `packages/coding-agent/src/tools/fetch.ts`
  - Import `assertPublicFetchUrl` from `../web/public-fetch-url`.
  - Call the helper at the start of `renderUrl()` after existing `pi-internal://` handling and before special handlers/network fetch.
  - Call the helper before subprocess refetch fallbacks in `renderHtmlToText()` (`trafilatura`, `lynx`) and before HTML-derived document link conversion if those paths are not already protected by transport helpers.

- `packages/coding-agent/src/web/scrapers/types.ts`
  - Import `assertPublicFetchUrl` from `../public-fetch-url`.
  - Replace `redirect: "follow"` in `loadPage()` with bounded manual redirect handling.
  - Validate the initial URL and every resolved redirect target before the next fetch.
  - Preserve existing user-agent retry behavior, status/content handling, headers, body, timeout, size limit, and abort semantics.
  - Handle redirect statuses `301`, `302`, `303`, `307`, and `308`.
  - Cap redirects at 10 hops.
  - Use one combined request signal per user-agent attempt so timeout/abort covers the whole redirect chain.
  - On blocked redirect or redirect overflow, return a non-throwing failure result (`{ ok: false, content: "", contentType: "", finalUrl, status: 310 }` or equivalent) so `renderUrl()` preserves its current soft-failure path. Preserve `ToolAbortError` throws for aborts.

- `packages/coding-agent/src/web/scrapers/utils.ts`
  - Import `assertPublicFetchUrl` from `../public-fetch-url`.
  - Replace `redirect: "follow"` in `fetchBinary()` with bounded manual redirect handling.
  - Validate the initial URL and every resolved redirect target before the next fetch.
  - Preserve existing content-length, max-byte, timeout, abort, content-disposition, and error-result behavior.
  - Handle redirect statuses `301`, `302`, `303`, `307`, and `308`.
  - Cap redirects at 10 hops and return `{ ok: false, error: "..." }` for blocked redirects/overflow rather than throwing non-abort errors.

- `packages/coding-agent/test/read-tool-group.test.ts`
  - Add unit tests for the exported helper:
    - allows public `https://example.com`.
    - rejects direct localhost/loopback/private/link-local/unspecified IPv4 targets.
    - rejects IPv6 loopback/link-local/unique-local targets.
    - rejects credentials in URL authority.
    - rejects `www.localhost` after implicit `https://` normalization.
  - Tests will not perform real network access.

- `packages/coding-agent/test/fetch-private-network.test.ts`
  - Add integration-level tests with mocked `fetch`:
    - `loadPage()` does not follow a public URL redirect to `127.0.0.1`.
    - `fetchBinary()` does not follow a public URL redirect to `169.254.169.254`.
    - blocked redirect tests assert the private-hop fetch is never attempted.

- `struct_har/chase/10.043_gjc_chase_web_search_insane_security.md`
  - Add Phase 24 partial evidence for `10.043-A`.
  - Keep card active because `10.043-B` and `10.043-C` remain open.

### New

- `devlog/_plan/260628_jwc_native_chase_implementation/241_phase24_url_private_network_audit.md`
- `devlog/_plan/260628_jwc_native_chase_implementation/242_phase24_url_private_network_build.md`
- `devlog/_plan/260628_jwc_native_chase_implementation/243_phase24_url_private_network_check.md`

## Non-goals

- Do not add DNS resolution or post-resolution IP validation in this slice.
- Do not classify `.local`, `.internal`, or `.home.arpa` DNS names as private in this slice unless they also match the explicit syntactic rules above.
- Do not change web-search provider baseUrl behavior; that remains `10.043-B`.
- Do not copy upstream GJC implementation code.
- Do not move `10.043` to `_fin` in this slice.

## Verification

- `bun test packages/coding-agent/test/read-tool-group.test.ts packages/coding-agent/test/fetch-private-network.test.ts`
- `cd packages/coding-agent && bun run check:types`
- `git diff --check -- packages/coding-agent/src/web/public-fetch-url.ts packages/coding-agent/src/tools/fetch.ts packages/coding-agent/src/web/scrapers/types.ts packages/coding-agent/src/web/scrapers/utils.ts packages/coding-agent/test/read-tool-group.test.ts packages/coding-agent/test/fetch-private-network.test.ts struct_har/chase/10.043_gjc_chase_web_search_insane_security.md devlog/_plan/260628_jwc_native_chase_implementation/240_phase24_url_private_network_plan.md devlog/_plan/260628_jwc_native_chase_implementation/241_phase24_url_private_network_audit.md devlog/_plan/260628_jwc_native_chase_implementation/242_phase24_url_private_network_build.md devlog/_plan/260628_jwc_native_chase_implementation/243_phase24_url_private_network_check.md`

## Commit plan

One atomic commit:

- `fix(fetch): deny private url reads`
