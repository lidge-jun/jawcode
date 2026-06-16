import { logger } from "@gajae-code/utils";
import { sliceLastTurnsByUserBoundary } from "../hindsight/content";
import { extractMessages } from "../hindsight/transcript";
import type { AgentSession } from "../session/agent-session";
import type { Mem0Api } from "./client";
import type { Mem0Config } from "./config";
import type { Mem0EntityScope } from "./scope";

export interface Mem0SessionStateOptions {
	sessionId: string;
	client: Mem0Api;
	scope: Mem0EntityScope;
	config: Mem0Config;
	session: AgentSession;
}

export class Mem0SessionState {
	readonly sessionId: string;
	readonly client: Mem0Api;
	readonly scope: Mem0EntityScope;
	readonly config: Mem0Config;
	readonly session: AgentSession;

	lastRecallSnippet?: string;
	hasRecalledForFirstTurn = false;
	lastRetainedTurn = 0;

	#unsubscribe?: () => void;

	constructor(options: Mem0SessionStateOptions) {
		this.sessionId = options.sessionId;
		this.client = options.client;
		this.scope = options.scope;
		this.config = options.config;
		this.session = options.session;
	}

	setSessionId(sessionId: string): void {
		(this as { sessionId: string }).sessionId = sessionId;
		this.scope.retainMetadata.run_id = sessionId;
		if (typeof this.scope.searchFilters.run_id === "string") {
			this.scope.searchFilters.run_id = sessionId;
		}
	}

	resetConversationTracking(): void {
		this.hasRecalledForFirstTurn = false;
		this.lastRetainedTurn = 0;
		this.lastRecallSnippet = undefined;
	}

	formatSearchHits(hits: Array<{ id: string; memory: string; score?: number }>): string {
		const lines = hits.map(h => {
			const score = h.score !== undefined ? ` (${h.score.toFixed(2)})` : "";
			return `- ${h.memory}${score} [${h.id}]`;
		});
		return `<memories>\n${this.config.recallPreamble}\n\n${lines.join("\n")}\n</memories>`;
	}

	async recallForQuery(query: string): Promise<string | undefined> {
		const trimmed = query.trim();
		if (!trimmed) return undefined;
		try {
			const response = await this.client.search(trimmed, this.scope.searchFilters, this.config.searchTopK);
			const hits = response.results ?? [];
			if (hits.length === 0) return undefined;
			return this.formatSearchHits(hits);
		} catch (err) {
			logger.debug("Mem0: search failed", { error: String(err) });
			return undefined;
		}
	}

	async beforeAgentStartPrompt(promptText: string): Promise<string | undefined> {
		if (!this.config.autoRecall || this.hasRecalledForFirstTurn) return undefined;
		const latest = promptText.trim();
		if (!latest) return undefined;
		const block = await this.recallForQuery(latest);
		this.hasRecalledForFirstTurn = true;
		if (!block) return undefined;
		this.lastRecallSnippet = block;
		return block;
	}

	async maybeRetainOnAgentEnd(): Promise<void> {
		if (!this.config.autoRetain) return;
		const messages = extractMessages(this.session.sessionManager);
		if (messages.length === 0) return;
		const userTurns = messages.filter(m => m.role === "user").length;
		if (userTurns - this.lastRetainedTurn < this.config.retainEveryNTurns) return;

		const windowTurns = Math.max(1, this.config.retainEveryNTurns);
		const slice = sliceLastTurnsByUserBoundary(messages, windowTurns);
		if (slice.length === 0) return;

		try {
			await this.client.add(
				slice.map(m => ({ role: m.role, content: m.content })),
				{
					userId: this.scope.userId,
					agentId: this.scope.agentId,
					runId: this.sessionId,
					metadata: { ...this.scope.retainMetadata },
				},
			);
			this.lastRetainedTurn = userTurns;
		} catch (err) {
			logger.warn("Mem0: auto-retain failed", { sessionId: this.sessionId, error: String(err) });
		}
	}

	async forceRetainCurrentSession(): Promise<void> {
		const messages = extractMessages(this.session.sessionManager);
		if (messages.length === 0) return;
		try {
			await this.client.add(
				messages.map(m => ({ role: m.role, content: m.content })),
				{
					userId: this.scope.userId,
					agentId: this.scope.agentId,
					runId: this.sessionId,
					metadata: { ...this.scope.retainMetadata },
				},
			);
			this.lastRetainedTurn = messages.filter(m => m.role === "user").length;
		} catch (err) {
			logger.warn("Mem0: forced retain failed", { sessionId: this.sessionId, error: String(err) });
		}
	}

	attachSessionListeners(): void {
		this.#unsubscribe?.();
		this.#unsubscribe = this.session.subscribe(event => {
			if (event.type === "agent_end") void this.maybeRetainOnAgentEnd();
		});
	}

	dispose(): void {
		this.#unsubscribe?.();
		this.#unsubscribe = undefined;
	}
}
