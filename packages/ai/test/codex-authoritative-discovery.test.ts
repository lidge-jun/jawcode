import { describe, expect, it } from "bun:test";
import * as fs from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";
import { resolveProviderModels } from "../src/model-manager";
import { openaiCodexModelManagerOptions } from "../src/provider-models/special";
import type { FetchImpl, Model } from "../src/types";

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
