import { describe, expect, it } from "bun:test";
import { decideOwnerClaim } from "../src/notifications/daemon-owner";
import type { TransportOwnerState } from "../src/notifications/transport-state";

const IDENTITY = { tokenFingerprint: "tok123456789", chatIdFingerprint: "chat12345678" };

function owner(overrides: Partial<TransportOwnerState> = {}): TransportOwnerState {
	return {
		version: 1,
		ownerId: "owner-a",
		pid: 4242,
		startedAt: 1_000,
		heartbeatAt: 1_000,
		...IDENTITY,
		...overrides,
	};
}

const aliveAll = () => true;
const deadAll = () => false;

describe("decideOwnerClaim", () => {
	it("claims when there is no owner", () => {
		expect(decideOwnerClaim({ current: null, candidate: { ...IDENTITY, pid: 5 }, now: 2_000 })).toEqual({
			action: "claim",
			reason: "no-owner",
		});
	});

	it("claims when the owner record is stopped", () => {
		const decision = decideOwnerClaim({
			current: owner({ stoppedAt: 1_500 }),
			candidate: { ...IDENTITY, pid: 5 },
			now: 1_600,
			pidAlive: aliveAll,
		});
		expect(decision).toEqual({ action: "claim", reason: "no-owner" });
	});

	it("keeps ownership when the candidate is the current owner (same identity + pid)", () => {
		const decision = decideOwnerClaim({
			current: owner({ pid: 4242, heartbeatAt: 1_900 }),
			candidate: { ...IDENTITY, pid: 4242 },
			now: 2_000,
			pidAlive: aliveAll,
		});
		expect(decision).toEqual({ action: "keep", reason: "self-owner" });
	});

	it("defers to a fresh live owner held by a different pid", () => {
		const decision = decideOwnerClaim({
			current: owner({ pid: 9999, heartbeatAt: 1_995 }),
			candidate: { ...IDENTITY, pid: 5 },
			now: 2_000,
			heartbeatTtlMs: 20_000,
			pidAlive: aliveAll,
		});
		expect(decision).toEqual({ action: "defer", reason: "live-owner" });
	});

	it("claims when the owner heartbeat is stale", () => {
		const decision = decideOwnerClaim({
			current: owner({ pid: 9999, heartbeatAt: 1_000 }),
			candidate: { ...IDENTITY, pid: 5 },
			now: 100_000,
			heartbeatTtlMs: 20_000,
			pidAlive: aliveAll,
		});
		expect(decision).toEqual({ action: "claim", reason: "stale-owner" });
	});

	it("claims when the owner pid is dead", () => {
		const decision = decideOwnerClaim({
			current: owner({ pid: 9999, heartbeatAt: 1_999 }),
			candidate: { ...IDENTITY, pid: 5 },
			now: 2_000,
			heartbeatTtlMs: 20_000,
			pidAlive: deadAll,
		});
		expect(decision).toEqual({ action: "claim", reason: "stale-owner" });
	});
});
