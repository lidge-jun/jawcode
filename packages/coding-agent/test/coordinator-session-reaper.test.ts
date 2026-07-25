import { describe, expect, it } from "bun:test";
import {
	createSessionReaper,
	type ReapableSession,
	selectReapableSessions,
} from "../src/coordinator-mcp/session-reaper";

const NOW = 10_000_000;
const TTL = 30 * 60_000;

function session(id: string, overrides: Partial<ReapableSession> = {}): ReapableSession {
	return {
		sessionId: id,
		ephemeral: true,
		ownerProven: true,
		lastActivityMs: NOW - TTL,
		hasActiveTurn: false,
		...overrides,
	};
}

describe("coordinator session reaper", () => {
	it("selects only owner-proven idle ephemeral sessions", () => {
		expect(
			selectReapableSessions(
				[
					session("eligible"),
					session("resident", { ephemeral: false }),
					session("unproven", { ownerProven: false }),
					session("active", { hasActiveTurn: true }),
					session("fresh", { lastActivityMs: NOW - 1_000 }),
				],
				NOW,
				TTL,
			).map(candidate => candidate.sessionId),
		).toEqual(["eligible"]);
	});

	it("does not overlap sweeps and continues after a failed reap", async () => {
		const listed = Promise.withResolvers<ReapableSession[]>();
		const reaped: string[] = [];
		const reaper = createSessionReaper(
			{
				listSessions: () => listed.promise,
				reapSession: async id => {
					if (id === "bad") throw new Error("wedged");
					reaped.push(id);
					return true;
				},
				now: () => NOW,
			},
			{ idleTtlMs: TTL, sweepIntervalMs: 60_000 },
		);

		const first = reaper.sweepOnce();
		expect(await reaper.sweepOnce()).toBe(0);
		listed.resolve([session("bad"), session("good")]);
		expect(await first).toBe(1);
		expect(reaped).toEqual(["good"]);
	});
});
