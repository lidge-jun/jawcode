import { afterEach, describe, expect, it, vi } from "bun:test";
import { hookFetch } from "@jawcode-dev/utils";
import { searchAnthropic } from "../../../src/web/search/providers/anthropic";
import { SearchProviderError } from "../../../src/web/search/types";

describe("Anthropic search citation parsing", () => {
	afterEach(() => {
		vi.restoreAllMocks();
		delete process.env.ANTHROPIC_SEARCH_API_KEY;
	});

	it("normalizes Anthropic web_search results and text citations", async () => {
		process.env.ANTHROPIC_SEARCH_API_KEY = "sk-test";

		using _hook = hookFetch(async () => {
			return new Response(
				JSON.stringify({
					id: "msg_1",
					model: "claude-haiku-4-5",
					content: [
						{
							type: "server_tool_use",
							name: "web_search",
							input: { query: "jwc citation parsing" },
						},
						{
							type: "web_search_tool_result",
							content: [
								{
									type: "web_search_result",
									title: "JWC Source",
									url: "https://example.com/jwc",
									encrypted_content: "encrypted",
									page_age: "2 days ago",
								},
							],
						},
						{
							type: "text",
							text: "JWC answer with a grounded source.",
							citations: [
								{
									type: "web_search_result_location",
									url: "https://example.com/jwc",
									title: "JWC Source",
									cited_text: "grounded source",
									encrypted_index: "idx",
								},
							],
						},
					],
					usage: {
						input_tokens: 11,
						output_tokens: 7,
						server_tool_use: { web_search_requests: 1 },
					},
				}),
				{ status: 200, headers: { "Content-Type": "application/json" } },
			);
		});

		const result = await searchAnthropic({ query: "jwc citation parsing", system_prompt: "" });

		expect(result.provider).toBe("anthropic");
		expect(result.answer).toBe("JWC answer with a grounded source.");
		expect(result.searchQueries).toEqual(["jwc citation parsing"]);
		expect(result.sources).toEqual([
			{
				title: "JWC Source",
				url: "https://example.com/jwc",
				snippet: undefined,
				publishedDate: "2 days ago",
				ageSeconds: 172800,
			},
		]);
		expect(result.citations).toEqual([
			{
				url: "https://example.com/jwc",
				title: "JWC Source",
				citedText: "grounded source",
			},
		]);
		expect(result.usage?.searchRequests).toBe(1);
	});

	it("fails closed when Anthropic returns a web_search error object", async () => {
		process.env.ANTHROPIC_SEARCH_API_KEY = "sk-test";

		using _hook = hookFetch(async () => {
			return new Response(
				JSON.stringify({
					id: "msg_2",
					model: "claude-haiku-4-5",
					content: [
						{
							type: "web_search_tool_result",
							content: {
								type: "web_search_tool_result_error",
								error_code: "max_uses_exceeded",
							},
						},
					],
					usage: {
						input_tokens: 5,
						output_tokens: 2,
					},
				}),
				{ status: 200, headers: { "Content-Type": "application/json" } },
			);
		});

		try {
			await searchAnthropic({ query: "jwc citation parsing", system_prompt: "" });
			throw new Error("Expected searchAnthropic to reject");
		} catch (error) {
			expect(error).toBeInstanceOf(SearchProviderError);
			expect((error as SearchProviderError).provider).toBe("anthropic");
			expect((error as SearchProviderError).status).toBe(424);
			expect((error as Error).message).toContain("max_uses_exceeded");
		}
	});
});
