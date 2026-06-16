/**
 * markUnlistedOutsideDynamic semantics (99.30.04 S1). When the dynamic fetch
 * succeeds, catalog ids the endpoint no longer serves get `unlisted: true`
 * (kept, not dropped — selectors hide them by default and reveal on ctrl+o).
 * Models the endpoint serves get stale tags cleared; provider allowlist
 * filters may pre-set `unlisted` on dynamic models and are respected. A failed
 * fetch leaves the bundle/cache untagged.
 */
import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { resolveProviderModels } from "../src/model-manager";
import type { Model } from "../src/types";

let tempDir: string;

beforeEach(() => {
	tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "jwc-unlisted-"));
});

afterEach(() => {
	fs.rmSync(tempDir, { recursive: true, force: true });
});

function codexModel(id: string, overrides: Partial<Model<"openai-codex-responses">> = {}) {
	return {
		id,
		name: id,
		api: "openai-codex-responses" as const,
		provider: "openai-codex" as const,
		baseUrl: "https://chatgpt.com/backend-api",
		reasoning: true,
		input: ["text", "image"] as ("text" | "image")[],
		cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
		contextWindow: 272000,
		maxTokens: 128000,
		...overrides,
	};
}

function unlistedIds(models: readonly Model<"openai-codex-responses">[]): string[] {
	return models
		.filter(model => model.unlisted === true)
		.map(model => model.id)
		.sort();
}

describe("markUnlistedOutsideDynamic", () => {
	it("tags catalog-only ids and keeps served ids visible", async () => {
		const result = await resolveProviderModels(
			{
				providerId: "openai-codex",
				staticModels: [codexModel("gpt-5"), codexModel("gpt-5.1"), codexModel("gpt-5.5")],
				cacheDbPath: path.join(tempDir, "models.db"),
				fetchDynamicModels: async () => [codexModel("gpt-5.5"), codexModel("gpt-5.4")],
				markUnlistedOutsideDynamic: true,
			},
			"online",
		);

		expect(result.models.map(model => model.id).sort()).toEqual(["gpt-5", "gpt-5.1", "gpt-5.4", "gpt-5.5"]);
		expect(unlistedIds(result.models)).toEqual(["gpt-5", "gpt-5.1"]);
		expect(result.stale).toBe(false);
	});

	it("clears stale tags when the endpoint serves the id again, and respects dynamic pre-set tags", async () => {
		const result = await resolveProviderModels(
			{
				providerId: "openai-codex",
				staticModels: [codexModel("gpt-5.5", { unlisted: true })],
				cacheDbPath: path.join(tempDir, "models.db"),
				fetchDynamicModels: async () => [
					codexModel("gpt-5.5"),
					codexModel("codex-auto-review", { unlisted: true }),
				],
				markUnlistedOutsideDynamic: true,
			},
			"online",
		);

		expect(unlistedIds(result.models)).toEqual(["codex-auto-review"]);
		expect(result.models.find(model => model.id === "gpt-5.5")?.unlisted).toBeUndefined();
	});

	it("leaves the catalog untagged when the dynamic fetch fails", async () => {
		const result = await resolveProviderModels(
			{
				providerId: "openai-codex",
				staticModels: [codexModel("gpt-5"), codexModel("gpt-5.5")],
				cacheDbPath: path.join(tempDir, "models.db"),
				fetchDynamicModels: async () => null,
				markUnlistedOutsideDynamic: true,
			},
			"online",
		);

		expect(unlistedIds(result.models)).toEqual([]);
		expect(result.stale).toBe(true);
	});

	it("persists tags into the authoritative cache snapshot", async () => {
		const dbPath = path.join(tempDir, "models.db");
		await resolveProviderModels(
			{
				providerId: "openai-codex",
				staticModels: [codexModel("gpt-5"), codexModel("gpt-5.5")],
				cacheDbPath: dbPath,
				fetchDynamicModels: async () => [codexModel("gpt-5.5")],
				markUnlistedOutsideDynamic: true,
			},
			"online",
		);
		// Offline read must serve the tagged snapshot from cache.
		const offline = await resolveProviderModels(
			{
				providerId: "openai-codex",
				staticModels: [codexModel("gpt-5"), codexModel("gpt-5.5")],
				cacheDbPath: dbPath,
			},
			"offline",
		);
		expect(unlistedIds(offline.models)).toEqual(["gpt-5"]);
	});
});
