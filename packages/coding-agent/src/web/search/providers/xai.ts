/**
 * xAI Grok unified search via the Responses API.
 *
 * Sends BOTH the `web_search` and `x_search` tools so Grok searches the
 * general web AND the X (Twitter) live index in one round-trip, deciding per
 * query which sources are relevant — not X-only. Live-verified against
 * `https://api.x.ai/v1/responses`: the valid tool variants are `web_search`,
 * `x_search`, `collections_search`, `file_search`; both web and X citations
 * come back as identically-shaped `url_citation` annotations.
 *
 * Auth mirrors the model layer's xAI OAuth gating: a Grok OAuth credential
 * (stored under the "xai" key by `grok login` / the xAI OAuth flow) unlocks
 * search, and a plain `XAI_API_KEY` works too. Credentials are resolved only
 * through `AuthStorage` (`getOAuthAccess` for the bearer, `getApiKey` as the
 * fallback) — never by opening a sibling store.
 *
 * The answer + `url_citation` annotations are virtualized into the standard
 * `SearchSource[]` shape so the calling agent's parser sees the same structure
 * every other provider emits. Reference: cli-jaw devlog
 * 260530_grok_xsearch_integration.
 */
import type { AuthStorage } from "@gajae-code/ai";
import { $env } from "@gajae-code/utils";
import type { SearchResponse, SearchSource } from "../types";
import { SearchProviderError } from "../types";
import type { SearchParams } from "./base";
import { SearchProvider } from "./base";
import { classifyProviderHttpError, withHardTimeout } from "./utils";

const XAI_BASE_URL = "https://api.x.ai/v1";
const XAI_RESPONSES_PATH = "/responses";
/** grok-4.3 = current flagship (Apr 2026, 1M ctx, live search). grok-4-fast is legacy/retired. */
const DEFAULT_XAI_SEARCH_MODEL = "grok-4.3";
/** Both tools so Grok unifies general web + X live index per query. */
const XAI_SEARCH_TOOLS = [{ type: "web_search" }, { type: "x_search" }] as const;

interface XaiAuth {
	token: string;
	mode: "oauth" | "api-key";
}

/** Resolve a usable bearer: OAuth credential first, then XAI_API_KEY / stored key. */
async function resolveXaiAuth(
	authStorage: AuthStorage,
	sessionId: string | undefined,
	signal: AbortSignal | undefined,
): Promise<XaiAuth | null> {
	const access = await authStorage.getOAuthAccess("xai", sessionId, { signal });
	if (access?.accessToken) {
		return { token: access.accessToken, mode: "oauth" };
	}
	const apiKey = (await authStorage.getApiKey("xai", sessionId)) ?? $env.XAI_API_KEY;
	if (apiKey) {
		return { token: apiKey, mode: "api-key" };
	}
	return null;
}

export function hasXaiSearch(authStorage: AuthStorage): boolean {
	// Cheap synchronous probe — mirror codex's hasOAuth gate, plus the env key.
	return authStorage.hasOAuth("xai") || authStorage.hasAuth("xai") || Boolean($env.XAI_API_KEY);
}

interface XaiResponsesPayload {
	output?: Array<{
		type?: string;
		content?: Array<{
			type?: string;
			text?: string;
			annotations?: Array<{
				type?: string;
				url?: string;
				title?: string;
				start_index?: number;
				end_index?: number;
			}>;
		}>;
	}>;
	model?: string;
	id?: string;
	usage?: { input_tokens?: number; output_tokens?: number; total_tokens?: number };
}

/** Pull answer text + url_citation annotations out of the Responses payload. */
export function parseXaiResponse(data: XaiResponsesPayload): { answer: string; sources: SearchSource[] } {
	const answerParts: string[] = [];
	const sources: SearchSource[] = [];
	const seenUrls = new Set<string>();
	for (const item of data.output ?? []) {
		if (item.type !== "message") continue;
		for (const content of item.content ?? []) {
			if ((content.type === "output_text" || content.type === "text") && content.text) {
				answerParts.push(content.text);
			}
			for (const annotation of content.annotations ?? []) {
				if (annotation.type !== "url_citation" || !annotation.url) continue;
				if (seenUrls.has(annotation.url)) continue;
				seenUrls.add(annotation.url);
				// xAI returns the citation INDEX ("1", "2", …) as the title, not
				// a descriptive label; fall back to the URL so sources read
				// usefully instead of showing a bare ordinal.
				const rawTitle = annotation.title?.trim();
				const title = rawTitle && !/^\d+$/.test(rawTitle) ? rawTitle : annotation.url;
				sources.push({ title, url: annotation.url });
			}
		}
	}
	return { answer: answerParts.join("\n").trim(), sources };
}

async function searchXai(params: SearchParams): Promise<SearchResponse> {
	const auth = await resolveXaiAuth(params.authStorage, params.sessionId, params.signal);
	if (!auth) {
		throw new SearchProviderError("xai", "No xAI credential — run grok login or set XAI_API_KEY", 401);
	}

	// Deep tier (075): grok-4.20-multi-agent for complex multi-hop (bench 072: 12src + X depth).
	const deepModel = params.depth === "deep" ? "grok-4.20-multi-agent" : undefined;
	const body: Record<string, unknown> = {
		model: $env.XAI_SEARCH_MODEL?.trim() || deepModel || DEFAULT_XAI_SEARCH_MODEL,
		store: false,
		input: [{ role: "user", content: params.query }],
		tools: XAI_SEARCH_TOOLS,
	};

	const response = await fetch(`${XAI_BASE_URL}${XAI_RESPONSES_PATH}`, {
		method: "POST",
		headers: {
			Authorization: `Bearer ${auth.token}`,
			"Content-Type": "application/json",
		},
		body: JSON.stringify(body),
		signal: withHardTimeout(params.signal, params.timeoutMs),
	});

	if (!response.ok) {
		const errorText = await response.text().catch(() => "");
		const classified = classifyProviderHttpError("xai", response.status, errorText);
		if (classified) throw classified;
		throw new SearchProviderError("xai", `xAI API error (${response.status}): ${errorText}`, response.status);
	}

	const data = (await response.json()) as XaiResponsesPayload;
	const { answer, sources } = parseXaiResponse(data);
	return {
		provider: "xai",
		answer: answer || undefined,
		sources,
		model: data.model,
		requestId: data.id,
		authMode: auth.mode,
		usage: data.usage
			? {
					inputTokens: data.usage.input_tokens ?? 0,
					outputTokens: data.usage.output_tokens ?? 0,
					totalTokens: data.usage.total_tokens ?? 0,
				}
			: undefined,
	};
}

/** Search provider for xAI Grok unified web + X search. */
export class XaiProvider extends SearchProvider {
	readonly id = "xai";
	readonly label = "xAI Grok";

	isAvailable(authStorage: AuthStorage): boolean {
		return hasXaiSearch(authStorage);
	}

	search(params: SearchParams): Promise<SearchResponse> {
		return searchXai(params);
	}
}
