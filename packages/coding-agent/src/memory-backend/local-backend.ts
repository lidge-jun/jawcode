import {
	buildMemoryToolDeveloperInstructions,
	clearMemoryData,
	enqueueMemoryConsolidation,
	startMemoryStartupTask,
} from "../memories";
import { buildLocalTaskSnapshot } from "../memories/local-query";
import { loadMemoryConfig } from "../memories/memory-config";
import type { MemoryBackend } from "./types";

/**
 * Wraps the existing `memories/` module as a `MemoryBackend`.
 *
 * The local pipeline owns rollout summarisation, SQLite retention, and
 * `memory_summary.md`. Prompt reads use the live session cwd when available so
 * manual enqueue/rebuild and startup hydration address the same memory root.
 */
export const localBackend: MemoryBackend = {
	id: "local",
	start(options) {
		startMemoryStartupTask(options);
	},
	async buildDeveloperInstructions(agentDir, settings, session) {
		return buildMemoryToolDeveloperInstructions(agentDir, settings, session);
	},
	async beforeAgentStartPrompt(session, promptText) {
		const prompt = promptText.trim();
		if (!prompt) return undefined;
		const agentDir = session.settings.getAgentDir();
		const cwd = session.sessionManager.getCwd();
		const memCfg = loadMemoryConfig(session.settings);
		const body = buildLocalTaskSnapshot(agentDir, cwd, prompt, 4, { searchMode: memCfg.searchMode });
		if (!body) return undefined;
		return `<memories>\nTask snapshot (local memory hits for this turn):\n\n${body}\n</memories>`;
	},
	async clear(agentDir, cwd) {
		await clearMemoryData(agentDir, cwd);
	},
	async enqueue(agentDir, cwd, session) {
		enqueueMemoryConsolidation(agentDir, cwd);
		if (!session) return;
		startMemoryStartupTask({
			session,
			settings: session.settings,
			modelRegistry: session.modelRegistry,
			agentDir,
			taskDepth: session.taskDepth,
		});
	},
};
