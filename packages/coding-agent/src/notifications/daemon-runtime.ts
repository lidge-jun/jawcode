import { clearDaemonControl, readDaemonControl } from "./daemon-control";
import { type DaemonInboundConfig, type DaemonPollState, runDaemonTick } from "./daemon-engine";
import { type DaemonLoopResult, runDaemonLoop } from "./daemon-loop";
import type { deleteForumTopic } from "./telegram-api";
import { deleteSessionTopics } from "./threaded-shutdown";
import { markTransportOwnerStopped, readTransportOwner, writeTransportOwner } from "./transport-state";

export interface RunManagedDaemonOptions {
	agentDir: string;
	token: string;
	chatId: string;
	ownerId: string;
	pid?: number;
	now?: () => number;
	sleep?: (ms: number) => Promise<void>;
	baseIntervalMs?: number;
	pollTimeoutSec?: number;
	maxTicks?: number;
	fetchImpl?: typeof fetch;
	heartbeatTtlMs?: number;
	pidAlive?: (pid: number) => boolean;
	/** Active per-session topics to best-effort delete on shutdown (e.g. ThreadTopicRegistry.list()). */
	listActiveTopics?: () => ReadonlyArray<{ messageThreadId: number }>;
	deleteTopicImpl?: typeof deleteForumTopic;
	/** Optional inbound (remote answer) routing+execution config, threaded into every tick. */
	inbound?: DaemonInboundConfig;
}

const defaultSleep = (ms: number): Promise<void> => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Run a managed Telegram daemon: wires the tested loop/tick/control/owner pieces to real transport
 * and control I/O, carrying poll state across ticks and marking the owner stopped on a stop control.
 * `sleep`/`fetchImpl`/`now`/`maxTicks` are injectable so the full stack runs end-to-end in tests with
 * a mocked Telegram and no detached OS process.
 */
export async function runManagedDaemon(options: RunManagedDaemonOptions): Promise<DaemonLoopResult> {
	const now = options.now ?? Date.now;
	const pid = options.pid ?? process.pid;
	let pollState: DaemonPollState = { attempt: 0 };

	return runDaemonLoop({
		baseIntervalMs: options.baseIntervalMs,
		maxTicks: options.maxTicks,
		sleep: options.sleep ?? defaultSleep,
		readControl: () => readDaemonControl(options.agentDir),
		readOwner: () => readTransportOwner(options.agentDir),
		clearControl: () => clearDaemonControl(options.agentDir),
		onStop: async () => {
			const owner = await readTransportOwner(options.agentDir);
			if (owner) await writeTransportOwner(options.agentDir, markTransportOwnerStopped(owner, now()));
			if (options.listActiveTopics) {
				try {
					await deleteSessionTopics({
						token: options.token,
						chatId: options.chatId,
						topics: options.listActiveTopics(),
						deleteImpl: options.deleteTopicImpl,
					});
				} catch (error) {
					console.error("[notifications] topic cleanup on stop failed", (error as Error).message);
				}
			}
		},
		tick: async () => {
			const result = await runDaemonTick({
				agentDir: options.agentDir,
				token: options.token,
				chatId: options.chatId,
				ownerId: options.ownerId,
				pid,
				now,
				pollState,
				pollTimeoutSec: options.pollTimeoutSec,
				heartbeatTtlMs: options.heartbeatTtlMs,
				pidAlive: options.pidAlive,
				fetchImpl: options.fetchImpl,
				inbound: options.inbound,
			});
			pollState = result.nextPollState;
			return result;
		},
	});
}
