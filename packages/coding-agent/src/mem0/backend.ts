import { logger } from "@jawcode-dev/utils";
import type { MemoryBackend, MemoryBackendStartOptions } from "../memory-backend/types";
import { createMem0Client } from "./client";
import { isMem0Configured, loadMem0Config } from "./config";
import { computeMem0Scope } from "./scope";
import { Mem0SessionState } from "./state";

const STATIC_INSTRUCTIONS = [
	"Mem0 memories are heuristic context from past conversations.",
	"Prefer current repo state and explicit user instruction when they conflict with a memory.",
].join("\n");

export const mem0Backend: MemoryBackend = {
	id: "mem0",

	async start(options: MemoryBackendStartOptions): Promise<void> {
		const { session, settings } = options;
		const sessionId = session.sessionId;
		if (!sessionId) return;

		if (options.taskDepth > 0) {
			const parent = options.parentMem0SessionState;
			if (!parent) return;
			const previous = session.setMem0SessionState(
				new Mem0SessionState({
					sessionId,
					client: parent.client,
					scope: parent.scope,
					config: parent.config,
					session,
				}),
			);
			previous?.dispose();
			return;
		}

		const config = loadMem0Config(settings);
		if (!isMem0Configured(config)) {
			logger.warn("Mem0: memory.backend=mem0 but mem0.apiKey is unset; backend inert.");
			return;
		}

		const client = createMem0Client(config);
		const scope = computeMem0Scope(config, session.sessionManager.getCwd(), sessionId);
		const state = new Mem0SessionState({ sessionId, client, scope, config, session });
		const previous = session.setMem0SessionState(state);
		previous?.dispose();
		state.attachSessionListeners();
	},

	async buildDeveloperInstructions(_agentDir, settings, session): Promise<string | undefined> {
		const config = loadMem0Config(settings);
		if (!isMem0Configured(config)) return undefined;
		const snippet = session?.getMem0SessionState()?.lastRecallSnippet;
		if (!snippet) return STATIC_INSTRUCTIONS;
		return `${STATIC_INSTRUCTIONS}\n\n${snippet}`;
	},

	async beforeAgentStartPrompt(session, promptText): Promise<string | undefined> {
		return await session.getMem0SessionState()?.beforeAgentStartPrompt(promptText);
	},

	async clear(_agentDir, _cwd, session): Promise<void> {
		const previous = session?.setMem0SessionState(undefined);
		previous?.dispose();
		logger.warn(
			"Mem0 memory is stored on the Mem0 Platform; only the local recall cache was cleared. " +
				"Delete memories from the Mem0 dashboard or API to wipe upstream state.",
		);
	},

	async enqueue(_agentDir, _cwd, session): Promise<void> {
		await session?.getMem0SessionState()?.forceRetainCurrentSession();
	},
};
