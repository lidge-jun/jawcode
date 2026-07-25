import { Database } from "bun:sqlite";
import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import * as fs from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";
import { readModelCache, writeModelCache } from "../src/model-cache";
import type { Model } from "../src/types";

const TTL_MS = 24 * 60 * 60 * 1000;

function createModel(id: string, name: string): Model<"openai-completions"> {
	return {
		id,
		name,
		api: "openai-completions",
		provider: "ollama-cloud",
		baseUrl: "https://ollama.com/v1",
		reasoning: false,
		input: ["text"],
		cost: {
			input: 0,
			output: 0,
			cacheRead: 0,
			cacheWrite: 0,
		},
		contextWindow: 4096,
		maxTokens: 1024,
	};
}

describe("model cache migrations", () => {
	let tempDir = "";
	let dbPath = "";

	beforeEach(async () => {
		tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "pi-ai-model-cache-"));
		dbPath = path.join(tempDir, "models.db");
	});

	afterEach(async () => {
		if (tempDir) {
			await fs.rm(tempDir, { recursive: true, force: true });
			tempDir = "";
			dbPath = "";
		}
	});

	it("invalidates pre-v4 cached models that may contain headers", () => {
		const legacyModel = {
			...createModel("legacy-cloud-model", "Legacy Cloud Model"),
			headers: { "X-Arbitrary-Secret": "legacy-secret" },
		};
		const legacyDb = new Database(dbPath, { create: true });
		legacyDb.run(`
			CREATE TABLE model_cache (
				provider_id TEXT PRIMARY KEY,
				version INTEGER NOT NULL,
				updated_at INTEGER NOT NULL,
				authoritative INTEGER NOT NULL DEFAULT 0,
				models TEXT NOT NULL
			)
		`);
		legacyDb.run(
			"INSERT INTO model_cache (provider_id, version, updated_at, authoritative, models) VALUES (?, ?, ?, ?, ?)",
			["ollama-cloud", 2, Date.now(), 1, JSON.stringify([legacyModel])],
		);
		legacyDb.close();

		const migrated = readModelCache<"openai-completions">("ollama-cloud", TTL_MS, Date.now, dbPath);
		expect(migrated).toBeNull();

		const replacementModel = createModel("fresh-cloud-model", "Fresh Cloud Model");
		writeModelCache("ollama-cloud", Date.now(), [replacementModel], true, "static-v3", dbPath);

		const overwritten = readModelCache<"openai-completions">("ollama-cloud", TTL_MS, Date.now, dbPath);
		expect(overwritten?.models.map(model => model.id)).toEqual(["fresh-cloud-model"]);
		expect(overwritten?.staticFingerprint).toBe("static-v3");
	});

	it("omits every model header from the cache payload", () => {
		const model = {
			...createModel("gated-model", "Gated Model"),
			headers: {
				Authorization: "Bearer standard-secret",
				"X-Goog-Api-Key": "google-secret",
				"X-Project-Id": "project-secret",
			},
		};
		writeModelCache("ollama-cloud", Date.now(), [model], true, "static-v4", dbPath);

		const raw = new Database(dbPath, { readonly: true });
		const row = raw
			.query<{ models: string }, []>("SELECT models FROM model_cache WHERE provider_id = 'ollama-cloud'")
			.get();
		raw.close();
		expect(row?.models).not.toContain("headers");
		expect(row?.models).not.toContain("secret");

		const cached = readModelCache<"openai-completions">("ollama-cloud", TTL_MS, Date.now, dbPath);
		expect(cached?.models[0]?.headers).toBeUndefined();
	});
});
