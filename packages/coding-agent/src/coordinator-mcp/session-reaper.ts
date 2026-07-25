import { logger } from "@jawcode-dev/utils";

export const DEFAULT_SESSION_IDLE_TTL_MS = 30 * 60_000;
export const DEFAULT_SESSION_SWEEP_INTERVAL_MS = 5 * 60_000;
export const MIN_SESSION_IDLE_TTL_MS = 60_000;
export const MIN_SESSION_SWEEP_INTERVAL_MS = 30_000;

export interface ReapableSession {
	sessionId: string;
	ephemeral: boolean;
	ownerProven: boolean;
	lastActivityMs: number;
	hasActiveTurn: boolean;
}

export interface SessionReaperPolicy {
	idleTtlMs: number;
	sweepIntervalMs: number;
}

export interface SessionReaperDeps {
	listSessions: () => Promise<ReapableSession[]>;
	reapSession: (sessionId: string) => Promise<boolean>;
	now: () => number;
}

export interface SessionReaper {
	sweepOnce(): Promise<number>;
	start(): void;
	stop(): void;
	readonly running: boolean;
}

export function selectReapableSessions(
	sessions: readonly ReapableSession[],
	now: number,
	idleTtlMs: number,
): ReapableSession[] {
	const ttl = Math.max(MIN_SESSION_IDLE_TTL_MS, idleTtlMs);
	return sessions.filter(
		session =>
			session.ephemeral && session.ownerProven && !session.hasActiveTurn && now - session.lastActivityMs >= ttl,
	);
}

export function createSessionReaper(deps: SessionReaperDeps, policy: SessionReaperPolicy): SessionReaper {
	const idleTtlMs = Math.max(MIN_SESSION_IDLE_TTL_MS, policy.idleTtlMs);
	const sweepIntervalMs = Math.max(MIN_SESSION_SWEEP_INTERVAL_MS, policy.sweepIntervalMs);
	let timer: ReturnType<typeof setTimeout> | undefined;
	let generation = 0;
	let inProgress = false;

	async function sweepOnce(): Promise<number> {
		if (inProgress) return 0;
		inProgress = true;
		try {
			const targets = selectReapableSessions(await deps.listSessions(), deps.now(), idleTtlMs);
			let reaped = 0;
			for (const target of targets) {
				try {
					if (await deps.reapSession(target.sessionId)) reaped++;
				} catch (error) {
					logger.warn("Coordinator session reaper failed", {
						sessionId: target.sessionId,
						error: error instanceof Error ? error.message : String(error),
					});
				}
			}
			return reaped;
		} finally {
			inProgress = false;
		}
	}

	function schedule(ownerGeneration: number): void {
		timer = setTimeout(() => {
			if (ownerGeneration !== generation) return;
			void sweepOnce().finally(() => {
				if (ownerGeneration === generation) schedule(ownerGeneration);
			});
		}, sweepIntervalMs);
		timer.unref?.();
	}

	return {
		sweepOnce,
		start(): void {
			if (timer) return;
			generation++;
			schedule(generation);
		},
		stop(): void {
			generation++;
			if (timer) clearTimeout(timer);
			timer = undefined;
		},
		get running(): boolean {
			return timer !== undefined;
		},
	};
}
