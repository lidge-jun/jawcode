import { enrichModelThinking } from "./model-thinking";
import MODELS from "./models.json" with { type: "json" };
import type { Api, KnownProvider, Model, Usage } from "./types";
import { isClaudeForcedToolChoiceIncapableModelId } from "./utils/tool-choice-capability";

/**
 * Bundled-catalog compat defaults applied at load time so stale committed
 * models.json snapshots still receive policy-critical fields (e.g. Claude
 * Fable/Mythos rejecting forced tool use) without a full regeneration.
 */
function applyBundledCompatDefaults(model: Model<Api>): Model<Api> {
	// Issue #404: upstream MiniMax catalogs label `minimax-m3` with plan-specific display names
	// (e.g. "MiniMax M3 (3x usage)") that vary by provider/plan. Normalize the bundled display name
	// to the canonical "MiniMax-M3" so first-class MiniMax providers surface a stable, plan-agnostic
	// label. Only the name is adjusted; id/transport/pricing are untouched.
	if (model.id === "minimax-m3" && model.name !== "MiniMax-M3") {
		model = { ...model, name: "MiniMax-M3" };
	}
	if (
		(model.api === "anthropic-messages" || model.api === "bedrock-converse-stream") &&
		isClaudeForcedToolChoiceIncapableModelId(model.id) &&
		(model.compat as { toolChoiceSupport?: string } | undefined)?.toolChoiceSupport === undefined
	) {
		return { ...model, compat: { ...(model.compat ?? {}), toolChoiceSupport: "auto" } as Model<Api>["compat"] };
	}
	return model;
}

/**
 * Static bundled model registry loaded from `models.json`.
 *
 * This module intentionally exposes compile-time defaults only.
 * It does not include runtime discovery, models.dev overlays, or on-disk cache state.
 *
 * For runtime-aware resolution, use `createModelManager()` / `resolveProviderModels()`.
 */
const modelRegistry: Map<string, Map<string, Model<Api>>> = new Map();
for (const [provider, models] of Object.entries(MODELS)) {
	const providerModels = new Map<string, Model<Api>>();
	for (const [id, model] of Object.entries(models)) {
		providerModels.set(id, applyBundledCompatDefaults(enrichModelThinking(model as Model<Api>)));
	}
	modelRegistry.set(provider, providerModels);
}

export type GeneratedProvider = keyof typeof MODELS;

export function getBundledModel<TApi extends Api = Api>(provider: GeneratedProvider, modelId: string): Model<TApi> {
	const providerModels = modelRegistry.get(provider);
	return providerModels?.get(modelId) as Model<TApi>;
}

export function getBundledProviders(): KnownProvider[] {
	return Array.from(modelRegistry.keys()) as KnownProvider[];
}

export function getBundledModels(provider: GeneratedProvider): Model<Api>[] {
	const models = modelRegistry.get(provider);
	return models ? (Array.from(models.values()) as Model<Api>[]) : [];
}

export function calculateCost<TApi extends Api>(model: Model<TApi>, usage: Usage): Usage["cost"] {
	usage.cost.input = (model.cost.input / 1000000) * usage.input;
	usage.cost.output = (model.cost.output / 1000000) * usage.output;
	usage.cost.cacheRead = (model.cost.cacheRead / 1000000) * usage.cacheRead;
	usage.cost.cacheWrite = (model.cost.cacheWrite / 1000000) * usage.cacheWrite;
	usage.cost.total = usage.cost.input + usage.cost.output + usage.cost.cacheRead + usage.cost.cacheWrite;
	return usage.cost;
}
/**
 * Check if two models are equal by comparing both their id and provider.
 * Returns false if either model is null or undefined.
 */
export function modelsAreEqual<TApi extends Api>(
	a: Model<TApi> | null | undefined,
	b: Model<TApi> | null | undefined,
): boolean {
	if (!a || !b) return false;
	return a.id === b.id && a.provider === b.provider;
}
