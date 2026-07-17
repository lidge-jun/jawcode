import { $env } from "@jawcode-dev/utils";
import type { ResponseInput } from "openai/resources/responses/responses";
import { redactSensitiveCredentials } from "./providers/transform-messages";
import type { CacheRetention, OpenAIResponsesHistoryPayload, ProviderPayload } from "./types";

type OpenAIResponsesReplayItem = ResponseInput[number];

export { isRecord } from "@jawcode-dev/utils";
export function normalizeSystemPrompts(systemPrompt: readonly string[] | string | undefined | null): string[] {
	if (systemPrompt === undefined || systemPrompt === null) return [];
	const prompts = Array.isArray(systemPrompt) ? systemPrompt : typeof systemPrompt === "string" ? [systemPrompt] : [];
	return prompts.map(prompt => redactSensitiveCredentials(prompt.toWellFormed())).filter(prompt => prompt.length > 0);
}

export function sanitizeJsonStrings(value: unknown): unknown {
	return sanitizeJsonStringsInner(value, new WeakMap<object, unknown>());
}

/** Serialize tool arguments as a JSON object suitable for provider wire payloads. */
export function serializeToolArguments(value: unknown): string {
	let candidate = value;
	if (typeof candidate === "string") {
		const trimmed = candidate.trim();
		if (!trimmed) return "{}";
		try {
			candidate = JSON.parse(trimmed);
		} catch {
			return "{}";
		}
	}

	if (!candidate || typeof candidate !== "object" || Array.isArray(candidate)) return "{}";
	try {
		return JSON.stringify(sanitizeJsonStrings(candidate));
	} catch {
		return "{}";
	}
}

function sanitizeJsonStringsInner(value: unknown, seen: WeakMap<object, unknown>): unknown {
	if (typeof value === "string") return value.toWellFormed();
	if (!value || typeof value !== "object") return value;
	const cached = seen.get(value);
	if (cached !== undefined) return cached;
	if (Array.isArray(value)) {
		const sanitized: unknown[] = [];
		seen.set(value, sanitized);
		for (const item of value) {
			sanitized.push(sanitizeJsonStringsInner(item, seen));
		}
		return sanitized;
	}
	const sanitized: Record<string, unknown> = {};
	seen.set(value, sanitized);
	for (const [key, val] of Object.entries(value as Record<string, unknown>)) {
		sanitized[key] = sanitizeJsonStringsInner(val, seen);
	}
	return sanitized;
}

export function toNumber(value: unknown): number | undefined {
	if (typeof value === "number" && Number.isFinite(value)) return value;
	if (typeof value === "string" && value.trim()) {
		const parsed = Number(value);
		return Number.isFinite(parsed) ? parsed : undefined;
	}
	return undefined;
}

export function toPositiveNumber(value: unknown, fallback: number): number {
	if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) {
		return fallback;
	}
	return value;
}

export function toBoolean(value: unknown): boolean | undefined {
	return typeof value === "boolean" ? value : undefined;
}

export function normalizeToolCallId(id: string): string {
	const sanitized = id.replace(/[^a-zA-Z0-9_-]/g, "_");
	return sanitized.length > 64 ? sanitized.slice(0, 64) : sanitized;
}

type ResponsesToolItemIdPrefix = "fc" | "ctc";

export function normalizeResponsesToolCallId(
	id: string,
	itemPrefix: ResponsesToolItemIdPrefix = "fc",
): { callId: string; itemId: string } {
	const [callId, itemId] = id.split("|");
	if (callId && itemId) {
		const normalizedCallId = truncateResponseItemId(callId, getIdPrefix(callId, "call"));
		const normalizedItemId = normalizeResponsesItemId(itemId, itemPrefix);
		return { callId: normalizedCallId, itemId: normalizedItemId };
	}
	const hash = Bun.hash(id).toString(36);
	const normalizedCallId = id.startsWith("call_") ? truncateResponseItemId(id, "call") : `call_${hash}`;
	return { callId: normalizedCallId, itemId: `${itemPrefix}_${hash}` };
}

function getIdPrefix(id: string, fallback: string): string {
	const prefix = id.match(/^([a-zA-Z][a-zA-Z0-9]*)_/)?.[1];
	return prefix || fallback;
}

function getExplicitIdPrefix(id: string): string | undefined {
	return id.match(/^([a-zA-Z][a-zA-Z0-9]*)_/)?.[1];
}

function normalizeResponsesItemId(itemId: string, fallbackPrefix: ResponsesToolItemIdPrefix): string {
	const prefix = getExplicitIdPrefix(itemId);
	const isAllowedPrefix = prefix
		? fallbackPrefix === "ctc"
			? prefix === "ctc"
			: prefix === "fc" || prefix === "fcr"
		: false;
	if (!prefix || !isAllowedPrefix) {
		return `${fallbackPrefix}_${Bun.hash(itemId).toString(36)}`;
	}
	return truncateResponseItemId(itemId, prefix);
}

/**
 * Truncate an OpenAI Responses API item ID to 64 characters.
 * IDs exceeding the limit are replaced with a hash-based ID using the given prefix.
 */
export function truncateResponseItemId(id: string, prefix: string): string {
	if (id.length <= 64) return id;
	return `${prefix}_${Bun.hash(id).toString(36)}`;
}

interface OpenAIResponsesReplaySanitizeOptions {
	supportsImageDetailOriginal?: boolean;
}

function clampReplayItemImageDetail(
	item: Record<string, unknown>,
	supportsImageDetailOriginal: boolean,
): Record<string, unknown> {
	if (supportsImageDetailOriginal) return item;
	if (item.type === "input_image" && item.detail === "original") {
		return { ...item, detail: "auto" };
	}
	if (item.type !== "message" || !Array.isArray(item.content)) return item;

	let changed = false;
	const content = item.content.map(part => {
		if (!part || typeof part !== "object" || Array.isArray(part)) return part;
		const record = part as Record<string, unknown>;
		if (record.type !== "input_image" || record.detail !== "original") return part;
		changed = true;
		return { ...record, detail: "auto" };
	});
	return changed ? { ...item, content } : item;
}

export function sanitizeOpenAIResponsesHistoryItemsForReplay(
	items: Array<Record<string, unknown>>,
	options: OpenAIResponsesReplaySanitizeOptions = {},
): ResponseInput {
	const normalizedCallIds = new Map<string, string>();
	const supportsImageDetailOriginal = options.supportsImageDetailOriginal !== false;
	return items.flatMap(item => {
		const sanitized = sanitizeOpenAIResponsesHistoryItemForReplay(
			item,
			normalizedCallIds,
			supportsImageDetailOriginal,
		);
		return sanitized ? [sanitized] : [];
	});
}

function sanitizeOpenAIResponsesHistoryItemForReplay(
	item: Record<string, unknown>,
	normalizedCallIds: Map<string, string>,
	supportsImageDetailOriginal: boolean,
): OpenAIResponsesReplayItem | undefined {
	if (item.type === "item_reference") return undefined;

	// providerPayload stores raw output items; replay strips fields that are output-only.
	const { id: _id, ...itemWithoutId } = item;
	const sanitizedItem =
		item.type === "image_generation_call"
			? sanitizeImageGenerationCallForResponsesInput(itemWithoutId)
			: itemWithoutId;
	if (typeof item.call_id === "string") {
		sanitizedItem.call_id = normalizeReplayedResponsesHistoryCallId(item.call_id, normalizedCallIds);
	}

	return clampReplayItemImageDetail(sanitizedItem, supportsImageDetailOriginal) as unknown as OpenAIResponsesReplayItem;
}

function sanitizeImageGenerationCallForResponsesInput(item: Record<string, unknown>): Record<string, unknown> {
	// These output fields are not part of the Responses input replay schema.
	const {
		action: _action,
		background: _background,
		output_format: _outputFormat,
		quality: _quality,
		revised_prompt: _revisedPrompt,
		size: _size,
		...inputSafeItem
	} = item;
	return inputSafeItem;
}

function normalizeReplayedResponsesHistoryCallId(value: string, normalizedValues: Map<string, string>): string {
	const normalized = normalizedValues.get(value);
	if (normalized) return normalized;
	const next = truncateResponseItemId(value, getIdPrefix(value, "call"));
	normalizedValues.set(value, next);
	return next;
}

export function createOpenAIResponsesHistoryPayload(
	provider: string,
	items: Array<Record<string, unknown>>,
	incremental = true,
): OpenAIResponsesHistoryPayload {
	return {
		type: "openaiResponsesHistory",
		provider,
		...(incremental ? { dt: true } : {}),
		items,
	};
}

export function getOpenAIResponsesHistoryPayload(
	providerPayload: ProviderPayload | undefined,
	currentProvider: string,
	fallbackProvider?: string,
): OpenAIResponsesHistoryPayload | undefined {
	if (providerPayload?.type !== "openaiResponsesHistory" || !Array.isArray(providerPayload.items)) {
		return undefined;
	}
	const payloadProvider = providerPayload.provider ?? fallbackProvider;
	if (!payloadProvider || payloadProvider !== currentProvider) {
		return undefined;
	}
	return { ...providerPayload, provider: payloadProvider };
}

export function getOpenAIResponsesHistoryItems(
	providerPayload: ProviderPayload | undefined,
	currentProvider: string,
	fallbackProvider?: string,
): Array<Record<string, unknown>> | undefined {
	return getOpenAIResponsesHistoryPayload(providerPayload, currentProvider, fallbackProvider)?.items;
}

/**
 * Resolve cache retention preference.
 * Defaults to "short" and uses GJC_CACHE_RETENTION, with PI_CACHE_RETENTION as a legacy fallback.
 */
export function resolveCacheRetention(cacheRetention?: CacheRetention): CacheRetention {
	if (cacheRetention) return cacheRetention;
	if ($env.GJC_CACHE_RETENTION === "long") return "long";
	if ($env.GJC_CACHE_RETENTION !== undefined) return "short";
	if ($env.PI_CACHE_RETENTION === "long") return "long";
	return "short";
}

export function isAnthropicOAuthToken(key: string): boolean {
	return key.includes("sk-ant-oat");
}
