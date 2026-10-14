/**
 * DeepSeek V4 context window contract.
 *
 * DeepSeek's official agent integration config
 * (https://api-docs.deepseek.com/quick_start/agent_integrations/codex) sets
 * context_window = 1,048,576 for the V4 models. models.dev rounds it to
 * 1,000,000, so the deepseek descriptor pins the official value and the
 * bundled catalog must agree with it.
 */
import { describe, expect, test } from "bun:test";
import { getBundledModel } from "../src/models";
import {
	MODELS_DEV_PROVIDER_DESCRIPTORS,
	type ModelsDevModel,
	mapModelsDevToModels,
} from "../src/provider-models/openai-compat";

const OFFICIAL_CONTEXT_WINDOW = 1_048_576;

describe("deepseek v4 context window", () => {
	const descriptor = MODELS_DEV_PROVIDER_DESCRIPTORS.find(d => d.providerId === "deepseek");

	test.each([
		["deepseek-v4-flash"],
		["deepseek-v4-pro"],
	])("%s keeps the official window when models.dev reports a rounded value", modelId => {
		const raw: ModelsDevModel = { tool_call: true, limit: { context: 1_000_000, output: 384_000 } };
		const models = mapModelsDevToModels({ deepseek: { models: { [modelId]: raw } } }, descriptor ? [descriptor] : []);
		expect(models).toHaveLength(1);
		expect(models[0]?.contextWindow).toBe(OFFICIAL_CONTEXT_WINDOW);
		expect(models[0]?.maxTokens).toBe(384_000);
	});

	test.each([["deepseek-v4-flash"], ["deepseek-v4-pro"]])("bundled %s matches the official window", modelId => {
		expect(getBundledModel("deepseek", modelId)?.contextWindow).toBe(OFFICIAL_CONTEXT_WINDOW);
	});
});
