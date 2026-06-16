import { afterEach, describe, expect, it, vi } from "bun:test";
import type { AuthStorage } from "@gajae-code/ai";
import { hookFetch } from "@gajae-code/utils";
import { hasXaiSearch, parseXaiResponse, XaiProvider } from "../../../src/web/search/providers/xai";

function authStub(opts: { oauth?: boolean; auth?: boolean; oauthToken?: string; apiKey?: string }): AuthStorage {
	return {
		hasOAuth: (p: string) => (p === "xai" ? !!opts.oauth : false),
		hasAuth: (p: string) => (p === "xai" ? !!(opts.auth || opts.oauth) : false),
		getOAuthAccess: async (p: string) =>
			p === "xai" && opts.oauthToken ? { accessToken: opts.oauthToken, accountId: undefined } : undefined,
		getApiKey: async (p: string) => (p === "xai" ? opts.apiKey : undefined),
	} as unknown as AuthStorage;
}

describe("xai provider gating", () => {
	afterEach(() => {
		vi.restoreAllMocks();
		delete process.env.XAI_API_KEY;
	});

	it("is available when an xAI OAuth credential is present (model-layer parity)", () => {
		expect(hasXaiSearch(authStub({ oauth: true }))).toBe(true);
	});

	it("is available with a stored xai auth credential", () => {
		expect(hasXaiSearch(authStub({ auth: true }))).toBe(true);
	});

	it("is available when XAI_API_KEY is set in the environment", () => {
		process.env.XAI_API_KEY = "xai-test-key";
		expect(hasXaiSearch(authStub({}))).toBe(true);
	});

	it("is NOT available with no credential", () => {
		expect(hasXaiSearch(authStub({}))).toBe(false);
	});
});

describe("xai response virtualization", () => {
	it("extracts the answer text and url_citation sources, deduped", () => {
		const { answer, sources } = parseXaiResponse({
			output: [
				{
					type: "message",
					content: [
						{
							type: "output_text",
							text: "Grok says hello.",
							annotations: [
								{ type: "url_citation", url: "https://x.com/a", title: "Post A" },
								{ type: "url_citation", url: "https://x.com/a", title: "dup" },
								{ type: "url_citation", url: "https://x.com/b" },
								{ type: "other", url: "https://ignore.me" },
							],
						},
					],
				},
			],
		});
		expect(answer).toBe("Grok says hello.");
		expect(sources).toEqual([
			{ title: "Post A", url: "https://x.com/a" },
			{ title: "https://x.com/b", url: "https://x.com/b" },
		]);
	});

	it("returns empty answer/sources for a payload with no message output", () => {
		expect(parseXaiResponse({ output: [] })).toEqual({ answer: "", sources: [] });
	});

	it("falls back to the URL when xAI returns a numeric citation index as the title (live-data quirk)", () => {
		const { sources } = parseXaiResponse({
			output: [
				{
					type: "message",
					content: [
						{
							type: "output_text",
							text: "answer",
							annotations: [
								{ type: "url_citation", url: "https://x.com/u/status/1", title: "1" },
								{ type: "url_citation", url: "https://x.com/u/status/2", title: "Real Title" },
							],
						},
					],
				},
			],
		});
		expect(sources).toEqual([
			{ title: "https://x.com/u/status/1", url: "https://x.com/u/status/1" },
			{ title: "Real Title", url: "https://x.com/u/status/2" },
		]);
	});
});

describe("xai search request shape (integration)", () => {
	afterEach(() => {
		vi.restoreAllMocks();
	});

	it("POSTs the Responses API with the x_search tool and a bearer token, then virtualizes the result", async () => {
		let captured: { url: string; auth: string | null; body: any } | undefined;
		using _hook = hookFetch(async (input, init) => {
			captured = {
				url: typeof input === "string" ? input : input instanceof URL ? input.href : input.url,
				auth: new Headers(init?.headers).get("authorization"),
				body: JSON.parse(String(init?.body)),
			};
			return new Response(
				JSON.stringify({
					model: "grok-4-fast",
					id: "resp_1",
					output: [
						{
							type: "message",
							content: [
								{
									type: "output_text",
									text: "Live answer",
									annotations: [{ type: "url_citation", url: "https://x.com/post", title: "Post" }],
								},
							],
						},
					],
				}),
				{ status: 200, headers: { "content-type": "application/json" } },
			);
		});

		const provider = new XaiProvider();
		const result = await provider.search({
			query: "ai agent reactions today",
			systemPrompt: "",
			authStorage: authStub({ oauth: true, oauthToken: "oauth-tok" }),
		} as any);

		expect(captured?.url).toBe("https://api.x.ai/v1/responses");
		expect(captured?.auth).toBe("Bearer oauth-tok");
		// Unified search: both general web AND X live index in one round-trip.
		expect(captured?.body.tools).toEqual([{ type: "web_search" }, { type: "x_search" }]);
		expect(result.provider).toBe("xai");
		expect(result.answer).toBe("Live answer");
		expect(result.sources).toEqual([{ title: "Post", url: "https://x.com/post" }]);
		expect(result.authMode).toBe("oauth");
	});

	it("throws a 401 SearchProviderError when no credential resolves", async () => {
		const provider = new XaiProvider();
		await expect(provider.search({ query: "q", systemPrompt: "", authStorage: authStub({}) } as any)).rejects.toThrow(
			/xAI credential/,
		);
	});
});
