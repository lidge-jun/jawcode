import { NOTIFICATION_DAEMON_GENERATION } from "./protocol";
import {
	DEFAULT_TRANSPORT_HEARTBEAT_TTL_MS,
	isFreshLiveTransportOwner,
	sameTransportIdentity,
	type TransportIdentity,
	type TransportOwnerState,
} from "./transport-state";

export type OwnerClaimReason = "no-owner" | "stale-owner" | "stale-generation" | "live-owner" | "self-owner";

export interface OwnerClaimDecision {
	action: "claim" | "defer" | "keep" | "reload";
	reason: OwnerClaimReason;
}

export interface DecideOwnerClaimInput {
	/** The current owner record on disk, if any. */
	current: TransportOwnerState | null | undefined;
	/** The identity + pid of the daemon that wants to own the poll. */
	candidate: TransportIdentity & { pid: number };
	now: number;
	heartbeatTtlMs?: number;
	pidAlive?: (pid: number) => boolean;
}

/**
 * Decide whether a candidate daemon may claim the single Telegram poll owner slot.
 *
 * Exactly one owner is allowed (Telegram permits one active `getUpdates`). A current-generation
 * fresh owner is reused, an older generation is cooperatively reloaded, and a stopped/stale/dead
 * owner is replaceable. The candidate keeps ownership when it is already the live owner.
 */
export function decideOwnerClaim(input: DecideOwnerClaimInput): OwnerClaimDecision {
	const { current, candidate, now } = input;
	const ttlMs = input.heartbeatTtlMs ?? DEFAULT_TRANSPORT_HEARTBEAT_TTL_MS;

	if (!current || current.stoppedAt !== undefined) return { action: "claim", reason: "no-owner" };

	if (sameTransportIdentity(current, candidate) && current.pid === candidate.pid) {
		return { action: "keep", reason: "self-owner" };
	}

	const live = isFreshLiveTransportOwner({
		tokenFingerprint: current.tokenFingerprint,
		chatIdFingerprint: current.chatIdFingerprint,
		owner: current,
		now,
		ttlMs,
		pidAlive: input.pidAlive,
	});
	if (live) {
		if (sameTransportIdentity(current, candidate) && (current.generation ?? 0) < NOTIFICATION_DAEMON_GENERATION) {
			return { action: "reload", reason: "stale-generation" };
		}
		return { action: "defer", reason: "live-owner" };
	}
	return { action: "claim", reason: "stale-owner" };
}
