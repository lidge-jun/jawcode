# 262 Phase 26 build — 10.043-C web search citation/read hardening

## Built

- Added `AnthropicWebSearchToolResultError` to the Anthropic web-search response types.
- Extended `AnthropicContentBlock.content` to model either successful search results or an Anthropic search error object.
- Updated the Anthropic parser to fail closed with `SearchProviderError("anthropic", ..., 424)` when a `web_search_tool_result` block contains an error object.
- Added focused tests for successful Anthropic source/citation normalization and fail-closed error-object handling.
- Added Phase 26 evidence to the `10.043` chase card.

## JWC-native boundary

This phase intentionally avoids copying GJC's shared citation-harvest module. It adapts only the missing JWC behavior that current code can own directly: explicit Anthropic error blocks must not become partial or untyped successful search results.

## Changed files

- `packages/coding-agent/src/web/search/types.ts`
- `packages/coding-agent/src/web/search/providers/anthropic.ts`
- `packages/coding-agent/test/web/search/anthropic-citations.test.ts`
- `struct_har/chase/10.043_gjc_chase_web_search_insane_security.md`

## Initial verification

Final command output is recorded in `263_phase26_web_search_citation_hardening_check.md` after C.

