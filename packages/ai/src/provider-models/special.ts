import { once } from "@jawcode-dev/utils";
import type { ModelManagerOptions } from "../model-manager";
import { Effort } from "../model-thinking";
import type { FetchImpl, Model, ThinkingConfig } from "../types";
import { type CodexModelDiscoveryResult, fetchCodexModels } from "../utils/discovery/codex";

// ---------------------------------------------------------------------------
// OpenAI code provider
// ---------------------------------------------------------------------------

export interface OpenAICodexAccount {
	accessToken: string;
	accountId?: string;
}

export interface OpenAICodexModelManagerConfig {
	/** @deprecated Prefer resolveAccounts for complete account-scoped discovery. */
	accessToken?: string;
	/** @deprecated Prefer resolveAccounts for complete account-scoped discovery. */
	accountId?: string;
	resolveAccounts?: () => Promise<readonly OpenAICodexAccount[] | null>;
	clientVersion?: string;
	fetch?: FetchImpl;
	signal?: AbortSignal;
}

export function openaiCodexModelManagerOptions(
	config: OpenAICodexModelManagerConfig = {},
): ModelManagerOptions<"openai-codex-responses"> {
	const { accessToken, accountId, resolveAccounts, clientVersion, fetch, signal } = config;
	const accountResolver = resolveAccounts ?? (accessToken ? async () => [{ accessToken, accountId }] : undefined);
	return {
		providerId: "openai-codex",
		...(accountResolver
			? {
					fetchDynamicModels: async () => {
						const accounts = await accountResolver();
						if (!accounts || accounts.length === 0) return null;
						const results = await Promise.all(
							accounts.map(account =>
								fetchCodexModels({
									accessToken: account.accessToken,
									accountId: account.accountId,
									clientVersion,
									fetchFn: fetch,
									signal,
								}),
							),
						);
						return unionCodexModels(results);
					},
					// The backend serves only a handful of live models; bundled legacy
					// ids (gpt-5, 5.1, 5.2, …) are not usable on this OAuth transport.
					// Tag them unlisted so the picker hides them by default.
					markUnlistedOutsideDynamic: true,
				}
			: undefined),
	};
}

function unionCodexModels(
	results: readonly (CodexModelDiscoveryResult | null)[],
): Model<"openai-codex-responses">[] | null {
	const byId = new Map<string, Model<"openai-codex-responses">>();
	for (const result of results) {
		if (!result) return null;
		for (const model of result.models) {
			if (!byId.has(model.id)) byId.set(model.id, model);
		}
	}
	return [...byId.values()];
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

const KIRO_THINKING: ThinkingConfig = {
	mode: "effort",
	minLevel: Effort.Low,
	maxLevel: Effort.XHigh,
	levels: [Effort.Low, Effort.Medium, Effort.High, Effort.XHigh],
	defaultLevel: Effort.High,
};

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
		...(reasoning ? { thinking: KIRO_THINKING } : undefined),
	};
}
