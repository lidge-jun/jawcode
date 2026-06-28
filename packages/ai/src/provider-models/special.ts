import { once } from "@jawcode-dev/utils";
import type { ModelManagerOptions } from "../model-manager";
import type { Model } from "../types";
import { fetchCodexModels } from "../utils/discovery/codex";

// ---------------------------------------------------------------------------
// OpenAI code provider
// ---------------------------------------------------------------------------

export interface OpenAICodexModelManagerConfig {
	accessToken?: string;
	accountId?: string;
	clientVersion?: string;
}

export function openaiCodexModelManagerOptions(
	config: OpenAICodexModelManagerConfig = {},
): ModelManagerOptions<"openai-codex-responses"> {
	const { accessToken, accountId, clientVersion } = config;
	return {
		providerId: "openai-codex",
		...(accessToken
			? {
					fetchDynamicModels: async () => {
						const result = await fetchCodexModels({ accessToken, accountId, clientVersion });
						return result?.models ?? null;
					},
					// The backend serves only a handful of live models; bundled legacy
					// ids (gpt-5, 5.1, 5.2, …) are not usable on this OAuth transport.
					// Tag them unlisted so the picker hides them by default.
					markUnlistedOutsideDynamic: true,
				}
			: undefined),
	};
}

// ---------------------------------------------------------------------------
// Cursor
// ---------------------------------------------------------------------------

export interface CursorModelManagerConfig {
	apiKey?: string;
	baseUrl?: string;
	clientVersion?: string;
}

export function cursorModelManagerOptions(config: CursorModelManagerConfig = {}): ModelManagerOptions<"cursor-agent"> {
	const { apiKey, baseUrl, clientVersion } = config;
	return {
		providerId: "cursor",
		...(apiKey
			? {
					fetchDynamicModels: async () => {
						const { fetchCursorUsableModels } = await cursorDiscovery();
						return fetchCursorUsableModels({ apiKey, baseUrl, clientVersion });
					},
				}
			: undefined),
	};
}

const cursorDiscovery = once(() => import("../utils/discovery/cursor"));

// ---------------------------------------------------------------------------
// Zai
// ---------------------------------------------------------------------------

export interface ZaiModelManagerConfig {}

export function zaiModelManagerOptions(_config: ZaiModelManagerConfig = {}): ModelManagerOptions<"anthropic-messages"> {
	return { providerId: "zai" };
}

// ---------------------------------------------------------------------------
// Kiro
// ---------------------------------------------------------------------------

export interface KiroModelManagerConfig {}

export function kiroModelManagerOptions(_config: KiroModelManagerConfig = {}): ModelManagerOptions<"kiro-streaming"> {
	return {
		providerId: "kiro",
		staticModels: [
			kiroModel("auto", "Auto", 1_000_000, 16_384),
			kiroModel("claude-opus-4.8", "Claude Opus 4.8", 1_000_000, 16_384, true),
			kiroModel("claude-opus-4.7", "Claude Opus 4.7", 1_000_000, 16_384, true),
			kiroModel("claude-opus-4.6", "Claude Opus 4.6", 1_000_000, 16_384, true),
			kiroModel("claude-sonnet-4.6", "Claude Sonnet 4.6", 1_000_000, 16_384, true),
			kiroModel("claude-opus-4.5", "Claude Opus 4.5", 200_000, 16_384, true),
			kiroModel("claude-sonnet-4.5", "Claude Sonnet 4.5", 200_000, 16_384, true),
			kiroModel("claude-sonnet-4", "Claude Sonnet 4", 200_000, 16_384, true),
			kiroModel("claude-haiku-4.5", "Claude Haiku 4.5", 200_000, 16_384),
			kiroModel("deepseek-3.2", "DeepSeek 3.2", 164_000, 8_192, true),
			kiroModel("minimax-m2.5", "MiniMax M2.5", 196_000, 8_192),
			kiroModel("minimax-m2.1", "MiniMax M2.1", 196_000, 8_192),
			kiroModel("glm-5", "GLM 5", 200_000, 8_192),
			kiroModel("qwen3-coder-next", "Qwen3 Coder Next", 256_000, 8_192, true),
		],
	};
}

function kiroModel(
	id: string,
	name: string,
	contextWindow: number,
	maxTokens: number,
	reasoning = false,
): Model<"kiro-streaming"> {
	return {
		id,
		name,
		api: "kiro-streaming",
		provider: "kiro",
		baseUrl: "",
		reasoning,
		input: ["text", "image"],
		cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
		contextWindow,
		maxTokens,
	};
}
