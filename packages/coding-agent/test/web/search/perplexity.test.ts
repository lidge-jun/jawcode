import { afterEach, describe, expect, it, vi } from "bun:test";
import type { AuthStorage } from "@jawcode-dev/ai";
import { hookFetch } from "@jawcode-dev/utils";
import { searchPerplexity } from "../../../src/web/search/providers/perplexity";

const savedCookies = process.env.PERPLEXITY_COOKIES;
const savedApiKey = process.env.PERPLEXITY_API_KEY;
const savedPplxApiKey = process.env.PPLX_API_KEY;

function restoreEnv(name: string, value: string | undefined): void {
	if (value === undefined) {
		delete process.env[name];
		return;
	}
	process.env[name] = value;
}

afterEach(() => {
	vi.restoreAllMocks();
	restoreEnv("PERPLEXITY_COOKIES", savedCookies);
	restoreEnv("PERPLEXITY_API_KEY", savedApiKey);
	restoreEnv("PPLX_API_KEY", savedPplxApiKey);
});

describe("Perplexity OAuth bearer isolation", () => {
	it("sends the OAuth bearer only to the consumer ask endpoint", async () => {
		delete process.env.PERPLEXITY_COOKIES;
		delete process.env.PERPLEXITY_API_KEY;
		delete process.env.PPLX_API_KEY;

		const getOAuthAccess = vi.fn(async () => ({ accessToken: "oauth-session-jwt" }));
		const getApiKey = vi.fn(async () => "oauth-session-jwt");
		const authStorage = { getOAuthAccess, getApiKey } as unknown as AuthStorage;
		const requests: Array<{ url: string; authorization: string | null }> = [];

		using _hook = hookFetch(async (input, init) => {
			const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
			requests.push({ url, authorization: new Headers(init?.headers).get("authorization") });
			const event = {
				final: true,
				display_model: "pplx_pro",
				uuid: "req-oauth",
				blocks: [{ intended_usage: "ask_text", markdown_block: { answer: "OAuth answer" } }],
			};
			return new Response(`data: ${JSON.stringify(event)}\n\n`, {
				status: 200,
				headers: { "content-type": "text/event-stream" },
			});
		});

		const result = await searchPerplexity({
			query: "OpenAI official website",
			authStorage,
			sessionId: "perplexity-oauth-session",
		});

		expect(requests).toEqual([
			{
				url: "https://www.perplexity.ai/rest/sse/perplexity_ask",
				authorization: "Bearer oauth-session-jwt",
			},
		]);
		expect(getOAuthAccess).toHaveBeenCalledWith("perplexity", "perplexity-oauth-session", {
			signal: undefined,
		});
		expect(getApiKey).not.toHaveBeenCalled();
		expect(result.authMode).toBe("oauth");
		expect(result.answer).toBe("OAuth answer");
	});
});
