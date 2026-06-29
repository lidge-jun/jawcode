# 261 Phase 26 audit — 10.043-C web search citation/read hardening

## Auditor

Backend employee, read-only plan audit.

## Verdict

PASS.

## Evidence checked

- `packages/coding-agent/src/web/search/types.ts`
- `packages/coding-agent/src/web/search/providers/anthropic.ts`
- `packages/coding-agent/test/tools/web-search-codex.test.ts`
- `packages/coding-agent/test/web/search/xai.test.ts`
- `packages/coding-agent/test/web/search/codex-broker.test.ts`
- `struct_har/chase/10.043_gjc_chase_web_search_insane_security.md`
- GJC upstream reference for `4cc65051`

## Findings

- Planned file anchors exist and match the current JWC code.
- `SearchProviderError("anthropic", message, 424)` matches the current constructor.
- The new Anthropic test file is a valid new file and can follow existing `hookFetch()`/env-key test patterns.
- The phase is a JWC-native adaptation: it explicitly throws on Anthropic object-shaped `web_search_tool_result_error` instead of porting GJC's broader shared citation module.

## Non-blocking advisories

- Document that this is not a literal cherry-pick of GJC `4cc65051`.
- Keep broader upstream citation-harvest/no-grounded-source behavior out of scope unless a later JWC-native phase expands the parser contract.
- Keep `10.043` active if the deferred `10.043-B` exact local `baseUrl` provider-context guard remains unresolved.

