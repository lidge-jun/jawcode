import { describe, expect, it, spyOn } from "bun:test";
import * as fs from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";
import { resolveProviderModels } from "../src/model-manager";
import { openaiCodexModelManagerOptions } from "../src/provider-models/special";
import type { FetchImpl, Model } from "../src/types";
import { OpenAICodexTerminalOAuthError, refreshOpenAICodexToken } from "../src/utils/oauth/openai-codex";

function codexPayload(ids: readonly string[]): Response {
	return Response.json({ models: ids.map(slug => ({ slug, display_name: slug })) });
}

const bundled: Model<"openai-codex-responses"> = {
	id: "bundled-prior",
	name: "Bundled Prior",
	api: "openai-codex-responses",
	provider: "openai-codex",
	baseUrl: "https://chatgpt.com/backend-api",
	reasoning: false,
	input: ["text"],
	cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
	contextWindow: 272_000,
	maxTokens: 128_000,
};

describe("Codex authoritative account discovery", () => {
	it("unions every account catalog and deduplicates model ids", async () => {
		const cacheDbPath = path.join(await fs.mkdtemp(path.join(os.tmpdir(), "jwc-codex-union-")), "models.db");
		const fetchFn: FetchImpl = async (_input, init) => {
			const account = new Headers(init?.headers).get("chatgpt-account-id");
			return codexPayload(account === "one" ? ["Luna", "Terra"] : ["Sol", "Terra"]);
		};
		const result = await resolveProviderModels(
			{
				...openaiCodexModelManagerOptions({
					resolveAccounts: async () => [
						{ accessToken: "a", accountId: "one" },
						{ accessToken: "b", accountId: "two" },
					],
					clientVersion: "0.139.0",
					fetch: fetchFn,
				}),
				staticModels: [bundled],
				cacheDbPath,
			},
			"online",
		);
		expect(
			result.models
				.map(model => model.id)
				.filter(id => id !== bundled.id)
				.sort(),
		).toEqual(["Luna", "Sol", "Terra"]);
		expect(result.models.filter(model => model.id === "Terra")).toHaveLength(1);
	});

	it("retains the prior catalog when any account fetch fails", async () => {
		const cacheDbPath = path.join(await fs.mkdtemp(path.join(os.tmpdir(), "jwc-codex-partial-")), "models.db");
		const fetchFn: FetchImpl = async (_input, init) =>
			new Headers(init?.headers).get("chatgpt-account-id") === "one"
				? codexPayload(["partial"])
				: new Response("timeout", { status: 503 });
		const result = await resolveProviderModels(
			{
				...openaiCodexModelManagerOptions({
					resolveAccounts: async () => [
						{ accessToken: "a", accountId: "one" },
						{ accessToken: "b", accountId: "two" },
					],
					clientVersion: "0.139.0",
					fetch: fetchFn,
				}),
				staticModels: [bundled],
				cacheDbPath,
			},
			"online",
		);
		expect(result.models.map(model => model.id)).toContain("bundled-prior");
		expect(result.models.map(model => model.id)).not.toContain("partial");
	});
});

describe("OpenAI Codex typed refresh errors", () => {
	for (const [name, body, contentType] of [
		["HTML script containing invalid_grant JSON text", '<script>{"error":"invalid_grant"}</script>', "text/html"],
		["truncated invalid_grant JSON", '{"error":"invalid_grant"', "application/json"],
	] as const) {
		it(`${name} does not produce a terminal OAuth error`, async () => {
			const fetchSpy = spyOn(globalThis, "fetch").mockResolvedValue(
				new Response(body, { status: 401, headers: { "Content-Type": contentType } }),
			);
			try {
				const failure = await refreshOpenAICodexToken("refresh").catch(error => error);
				expect(failure).toBeInstanceOf(Error);
				expect(failure).not.toBeInstanceOf(OpenAICodexTerminalOAuthError);
			} finally {
				fetchSpy.mockRestore();
			}
		});
	}

	for (const [name, status, body, contentType] of [
		["502 JSON from a corporate WAF", 502, '{"error":"invalid_grant","proxy":"corp-waf"}', "application/json"],
		["502 text/html with a valid JSON body", 502, '{"error":"invalid_grant"}', "text/html"],
		["429 with a terminal-looking body", 429, '{"error":"invalid_grant"}', "application/json"],
	] as const) {
		it(`${name} is transient regardless of body`, async () => {
			const fetchSpy = spyOn(globalThis, "fetch").mockResolvedValue(
				new Response(body, { status, headers: { "Content-Type": contentType } }),
			);
			try {
				const failure = await refreshOpenAICodexToken("refresh").catch(error => error);
				expect(failure).toBeInstanceOf(Error);
				expect(failure).not.toBeInstanceOf(OpenAICodexTerminalOAuthError);
			} finally {
				fetchSpy.mockRestore();
			}
		});
	}

	it("produces a typed terminal error only from successfully parsed provider JSON", async () => {
		const fetchSpy = spyOn(globalThis, "fetch").mockResolvedValue(
			Response.json({ error: "invalid_grant", error_description: "refresh token revoked" }, { status: 400 }),
		);
		try {
			const failure = await refreshOpenAICodexToken("refresh").catch(error => error);
			expect(failure).toBeInstanceOf(OpenAICodexTerminalOAuthError);
			expect(failure.code).toBe("invalid_grant");
		} finally {
			fetchSpy.mockRestore();
		}
	});
});
