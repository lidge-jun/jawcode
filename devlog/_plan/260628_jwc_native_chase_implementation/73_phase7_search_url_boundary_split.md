# 73 Phase 7 split — 10.043 search and URL boundary

## Source card

`struct_har/chase/10.043_gjc_chase_web_search_insane_security.md`

## JWC posture

Adapt only public URL and search-provider hardening that preserves JWC's current web search provider stack and read/internal URL contracts. Public/private URL guards must be tested as JWC behavior, not copied from upstream snapshots.

## Existing JWC owners

| Surface | JWC owner |
|---|---|
| web search tool | `packages/coding-agent/src/web/search/**`; `packages/coding-agent/src/tools/index.ts` |
| read/internal URL tool | `packages/coding-agent/src/tools/read.ts`; `docs/tools/read.md` |
| search docs | `docs/tools/web_search.md`; `docs/environment-variables.md` search section |
| tests | `packages/coding-agent/test/tools/web-search-*.test.ts`; `packages/coding-agent/test/read-tool-group.test.ts`; internal URL tests |

## Candidate slices

| Slice | Allowed future scope | Required evidence |
|---|---|---|
| `10.043-A` | Private/local network deny tests for URL reads and public fetch paths. | read/internal URL negative tests. |
| `10.043-B` | Search provider auth/baseUrl guard tests, including direct provider-id mappings. | web-search provider tests with local baseUrl denial. |
| `10.043-C` | Citation/read hardening and blocked public URL fallback if JWC needs it. | focused citation/read tests; no snapshot parity. |

## Reject/defer

- Reintroducing upstream insane-search provider without JWC-specific risk review.
- Allowing local/private baseUrl overrides for public-provider IDs.
- Browser or read URL access to private networks unless an explicit local-tool mode owns it.

## Done-gate status

No `10.043` done-gate is closed by this split. The card remains active.

