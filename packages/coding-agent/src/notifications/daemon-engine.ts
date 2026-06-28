import { decideOwnerClaim, type OwnerClaimDecision } from "./daemon-owner";
import { getTelegramUpdates, nextBackoffMs } from "./telegram-api";
import { type ScanTransportSessionsResult, scanTransportSessions } from "./transport-shell";
import {
	fingerprintSecret,
	readTransportOwner,
	type TransportOwnerState,
	writeTransportOwner,
} from "./transport-state";

export interface DaemonPollState {
	offset?: number;
	attempt: number;
}

export interface DaemonPollOutcome {
	ok: boolean;
	updateCount: number;
	nextOffset?: number;
	retryable?: boolean;
	backoffMs?: number;
	status?: number;
	reason?: string;
}

export interface DaemonTickResult {
	decision: OwnerClaimDecision;
	owned: boolean;
	scannedSessions: number;
	poll?: DaemonPollOutcome;
	nextPollState: DaemonPollState;
}

export interface RunDaemonTickOptions {
	agentDir: string;
	token: string;
	chatId: string;
	ownerId: string;
	pid: number;
	now: () => number;
	pollState?: DaemonPollState;
	pollTimeoutSec?: number;
	heartbeatTtlMs?: number;
	pidAlive?: (pid: number) => boolean;
	// Injectable I/O for tests; default to the real transport/telegram implementations.
	readOwner?: (agentDir: string) => Promise<TransportOwnerState | null>;
	writeOwner?: (agentDir: string, owner: TransportOwnerState) => Promise<void>;
	scan?: (options: { agentDir: string }) => Promise<ScanTransportSessionsResult>;
	getUpdates?: typeof getTelegramUpdates;
	fetchImpl?: typeof fetch;
}

/**
 * Run one deterministic iteration of the managed Telegram daemon: claim/keep/defer the single owner
 * slot, refresh the heartbeat, scan discovered sessions, and poll Telegram once (advancing the offset
 * or backing off on a transient error). No OS process spawn and no real timers — the long-lived loop
 * and reload/stop control are a later slice. All I/O is injectable for tests.
 */
export async function runDaemonTick(options: RunDaemonTickOptions): Promise<DaemonTickResult> {
	const readOwner = options.readOwner ?? readTransportOwner;
	const writeOwner = options.writeOwner ?? writeTransportOwner;
	const scan = options.scan ?? scanTransportSessions;
	const getUpdates = options.getUpdates ?? getTelegramUpdates;
	const pollState: DaemonPollState = options.pollState ?? { attempt: 0 };

	const tokenFingerprint = fingerprintSecret(options.token);
	const chatIdFingerprint = fingerprintSecret(options.chatId);

	const current = await readOwner(options.agentDir);
	const decision = decideOwnerClaim({
		current,
		candidate: { tokenFingerprint, chatIdFingerprint, pid: options.pid },
		now: options.now(),
		heartbeatTtlMs: options.heartbeatTtlMs,
		pidAlive: options.pidAlive,
	});

	if (decision.action === "defer") {
		return { decision, owned: false, scannedSessions: 0, nextPollState: pollState };
	}

	const startedAt = decision.action === "keep" && current ? current.startedAt : options.now();
	const owner: TransportOwnerState = {
		version: 1,
		ownerId: options.ownerId,
		pid: options.pid,
		startedAt,
		heartbeatAt: options.now(),
		tokenFingerprint,
		chatIdFingerprint,
	};
	await writeOwner(options.agentDir, owner);

	const scanResult = await scan({ agentDir: options.agentDir });
	const scannedSessions = scanResult.observations.length;

	const outcome = await getUpdates({
		token: options.token,
		offset: pollState.offset,
		timeoutSec: options.pollTimeoutSec,
		fetchImpl: options.fetchImpl,
	});

	if (outcome.ok) {
		const updates = outcome.result;
		const maxId = updates.reduce((max, update) => Math.max(max, update.update_id), -1);
		const nextOffset = maxId >= 0 ? maxId + 1 : pollState.offset;
		return {
			decision,
			owned: true,
			scannedSessions,
			poll: { ok: true, updateCount: updates.length, nextOffset },
			nextPollState: { offset: nextOffset, attempt: 0 },
		};
	}

	const backoffMs = outcome.retryable ? nextBackoffMs(pollState.attempt) : undefined;
	return {
		decision,
		owned: true,
		scannedSessions,
		poll: {
			ok: false,
			updateCount: 0,
			retryable: outcome.retryable,
			backoffMs,
			status: outcome.status,
			reason: outcome.reason,
		},
		nextPollState: {
			offset: pollState.offset,
			attempt: outcome.retryable ? pollState.attempt + 1 : pollState.attempt,
		},
	};
}
