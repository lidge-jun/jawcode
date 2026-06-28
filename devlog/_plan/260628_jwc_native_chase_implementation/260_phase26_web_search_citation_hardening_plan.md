# 260 Phase 26 plan — 10.043-C web search citation/read hardening

## Work-phase target

Close the remaining `10.043-C` slice with JWC-native evidence for web-search citation/read hardening. This phase does not port GJC's shared `text-citations.ts` or OpenAI-compatible provider code wholesale. It keeps JWC's current provider stack and adds only the missing fail-closed Anthropic error-block guard plus citation regression evidence already native to JWC.

## Source anchors

- Chase card: `struct_har/chase/10.043_gjc_chase_web_search_insane_security.md`
- Prior split: `devlog/_plan/260628_jwc_native_chase_implementation/73_phase7_search_url_boundary_split.md`
- Upstream reference commits: `e49d93f8` citation recovery and `4cc65051` Anthropic web_search error block fail-closed behavior.

## Current JWC findings

- Codex citation fallback is already covered in `packages/coding-agent/test/tools/web-search-codex.test.ts`.
- xAI citation virtualization is already covered in `packages/coding-agent/test/web/search/xai.test.ts`.
- Codex broker auth/citation behavior is covered in `packages/coding-agent/test/web/search/codex-broker.test.ts`.
- Anthropic currently parses `web_search_tool_result` blocks with result arrays but does not explicitly reject object-shaped error blocks such as `web_search_tool_result_error`.

## Planned file changes

### MODIFY `packages/coding-agent/src/web/search/types.ts`

Before:

```ts
/** Search results (for type="web_search_tool_result") */
content?: AnthropicSearchResult[];
```

After:

```ts
/** Search results or Anthropic web_search error object (for type="web_search_tool_result") */
content?: AnthropicSearchResult[] | AnthropicWebSearchToolResultError;
```

Add a small exported interface near the Anthropic types:

```ts
export interface AnthropicWebSearchToolResultError {
	type: "web_search_tool_result_error";
	error_code?: string;
}
```

### MODIFY `packages/coding-agent/src/web/search/providers/anthropic.ts`

Before:

```ts
} else if (block.type === "web_search_tool_result" && block.content) {
	for (const result of block.content) {
		if (result.type === "web_search_result") {
```

After:

```ts
} else if (block.type === "web_search_tool_result" && block.content) {
	if (!Array.isArray(block.content)) {
		throw new SearchProviderError(
			"anthropic",
			`Anthropic web search failed: ${block.content.error_code ?? "unknown_error"}`,
			424,
		);
	}
	for (const result of block.content) {
		if (result.type === "web_search_result") {
```

This keeps normal result parsing unchanged and makes provider-side search failure fail closed instead of returning an answer with missing/partial sources.

### NEW `packages/coding-agent/test/web/search/anthropic-citations.test.ts`

Add focused tests using `hookFetch()` and env API-key auth:

1. Parses successful Anthropic web-search source arrays and text citations into unified `sources` and `citations`.
2. Throws `SearchProviderError` with status `424` when Anthropic returns object-shaped `web_search_tool_result_error`.

### MODIFY `struct_har/chase/10.043_gjc_chase_web_search_insane_security.md`

Add `JWC Phase 26 Partial Evidence — 2026-06-28` with:

- Implementation evidence for Anthropic fail-closed error block handling.
- Regression evidence for Codex/xAI/Codex broker citation tests.
- Verification commands and pass counts.
- Residual note that exact local `provider: "openai"` + `baseUrl` denial remains deferred from `10.043-B` until resolver context expands.

## Verification plan

Run focused tests:

```bash
bun test packages/coding-agent/test/web/search/anthropic-citations.test.ts packages/coding-agent/test/tools/web-search-codex.test.ts packages/coding-agent/test/web/search/xai.test.ts packages/coding-agent/test/web/search/codex-broker.test.ts
```

Run package typecheck:

```bash
cd packages/coding-agent && bun run check:types
```

Run scoped whitespace check:

```bash
git diff --check -- packages/coding-agent/src/web/search/providers/anthropic.ts packages/coding-agent/src/web/search/types.ts packages/coding-agent/test/web/search/anthropic-citations.test.ts struct_har/chase/10.043_gjc_chase_web_search_insane_security.md devlog/_plan/260628_jwc_native_chase_implementation
```

## Commit plan

One atomic commit after C passes:

```text
fix(web-search): fail closed on anthropic search errors
```

