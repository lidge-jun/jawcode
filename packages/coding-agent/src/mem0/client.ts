/**
 * Minimal fetch client for Mem0 Platform V3 (https://api.mem0.ai).
 */

import type { Mem0Config } from "./config";

const USER_AGENT = "oh-my-jawcode";

export interface Mem0SearchHit {
	id: string;
	memory: string;
	score?: number;
	metadata?: Record<string, unknown>;
	created_at?: string;
}

export interface Mem0SearchResponse {
	results: Mem0SearchHit[];
}

export interface Mem0AddResponse {
	message?: string;
	status?: string;
	event_id?: string;
}

export class Mem0Error extends Error {
	constructor(
		message: string,
		readonly status: number,
		readonly body?: string,
	) {
		super(message);
		this.name = "Mem0Error";
	}
}

export class Mem0Api {
	#baseUrl: string;
	#apiKey: string;

	constructor(config: Mem0Config & { mem0ApiKey: string }) {
		const base = config.mem0ApiUrl.replace(/\/+$/, "");
		this.#baseUrl = base;
		this.#apiKey = config.mem0ApiKey;
	}

	async search(query: string, filters: Record<string, unknown>, topK: number): Promise<Mem0SearchResponse> {
		return await this.postJson<Mem0SearchResponse>("/v3/memories/search/", {
			query,
			filters,
			top_k: topK,
		});
	}

	async getMemory(memoryId: string): Promise<Record<string, unknown>> {
		return await this.getJson(`/v1/memories/${encodeURIComponent(memoryId)}/`);
	}

	async add(
		messages: Array<{ role: "user" | "assistant" | "system"; content: string }>,
		params: {
			userId: string;
			agentId?: string;
			runId?: string;
			metadata?: Record<string, unknown>;
			infer?: boolean;
		},
	): Promise<Mem0AddResponse> {
		const body: Record<string, unknown> = {
			messages,
			user_id: params.userId,
		};
		if (params.agentId) body.agent_id = params.agentId;
		if (params.runId) body.run_id = params.runId;
		if (params.metadata && Object.keys(params.metadata).length > 0) body.metadata = params.metadata;
		if (params.infer === false) body.infer = false;
		return await this.postJson<Mem0AddResponse>("/v3/memories/add/", body);
	}

	private async getJson(path: string): Promise<Record<string, unknown>> {
		const res = await fetch(`${this.#baseUrl}${path}`, {
			method: "GET",
			headers: this.headers(),
		});
		return await this.parseJson(res);
	}

	private async postJson<T>(path: string, body: Record<string, unknown>): Promise<T> {
		const res = await fetch(`${this.#baseUrl}${path}`, {
			method: "POST",
			headers: { ...this.headers(), "Content-Type": "application/json" },
			body: JSON.stringify(body),
		});
		return (await this.parseJson(res)) as T;
	}

	private headers(): Record<string, string> {
		return {
			Authorization: `Token ${this.#apiKey}`,
			Accept: "application/json",
			"User-Agent": USER_AGENT,
		};
	}

	private async parseJson(res: Response): Promise<Record<string, unknown>> {
		const text = await res.text();
		if (!res.ok) {
			throw new Mem0Error(`Mem0 API ${res.status}: ${text.slice(0, 400)}`, res.status, text);
		}
		if (!text.trim()) return {};
		try {
			return JSON.parse(text) as Record<string, unknown>;
		} catch {
			throw new Mem0Error("Mem0 API returned non-JSON body", res.status, text);
		}
	}
}

export function createMem0Client(config: Mem0Config & { mem0ApiKey: string }): Mem0Api {
	return new Mem0Api(config);
}
