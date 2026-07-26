import { expect, test } from "bun:test";
import type { Model } from "@jawcode-dev/ai";
import { createAuthGatewayModelCatalog } from "../src/cli/auth-gateway-cli";

function model(provider: string, id: string): Model<"openai-responses"> {
	return {
		id,
		name: id,
		api: "openai-responses",
		provider,
		baseUrl: `https://${provider}.example/v1`,
		reasoning: false,
		input: ["text"],
		cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
		contextWindow: 8192,
		maxTokens: 1024,
	};
}

test("qualified gateway ids round-trip while bare aliases require uniqueness", () => {
	const providerA = model("provider-a", "shared-model");
	const providerB = model("provider-b", "shared-model");
	const unique = model("provider-c", "unique-model");
	const catalog = createAuthGatewayModelCatalog([providerA, providerA, providerB, unique]);

	expect([...catalog.listModels()].map(entry => `${entry.provider}/${entry.id}`)).toEqual([
		"provider-a/shared-model",
		"provider-b/shared-model",
		"provider-c/unique-model",
	]);
	expect(catalog.resolveModel("provider-a/shared-model")).toBe(providerA);
	expect(catalog.resolveModel("provider-b/shared-model")).toBe(providerB);
	expect(catalog.resolveModel("unique-model")).toBe(unique);
	expect(() => catalog.resolveModel("shared-model")).toThrow(
		'Ambiguous bare model id "shared-model"; use one of: provider-a/shared-model, provider-b/shared-model',
	);
});
