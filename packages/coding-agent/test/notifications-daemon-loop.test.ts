import { describe, expect, it } from "bun:test";
import type { DaemonControlRequest } from "../src/notifications/daemon-control";
import type { DaemonTickResult } from "../src/notifications/daemon-engine";
import { type RunDaemonLoopOptions, runDaemonLoop } from "../src/notifications/daemon-loop";
import type { TransportOwnerState } from "../src/notifications/transport-state";

function tickResult(overrides: Partial<DaemonTickResult> = {}): DaemonTickResult {
	return {
		decision: { action: "claim", reason: "no-owner" },
		owned: true,
		scannedSessions: 0,
		poll: { ok: true, updateCount: 0 },
		nextPollState: { attempt: 0 },
		...overrides,
	};
}

function ownerState(): TransportOwnerState {
	return {
		version: 1,
		ownerId: "owner-A",
		pid: 100,
		startedAt: 1_000,
		heartbeatAt: 1_000,
		tokenFingerprint: "tok",
		chatIdFingerprint: "chat",
	};
}

function baseLoop(overrides: Partial<RunDaemonLoopOptions> = {}): RunDaemonLoopOptions {
	return {
		tick: async () => tickResult(),
		sleep: async () => {},
		readControl: async () => null,
		readOwner: async () => null,
		clearControl: async () => {},
		...overrides,
	};
}

describe("runDaemonLoop", () => {
	it("runs ticks until maxTicks and sleeps the base interval", async () => {
		let ticks = 0;
		const sleeps: number[] = [];
		const result = await runDaemonLoop(
			baseLoop({
				maxTicks: 3,
				baseIntervalMs: 1_500,
				tick: async () => {
					ticks += 1;
					return tickResult();
				},
				sleep: async ms => {
					sleeps.push(ms);
				},
			}),
		);
		expect(result).toEqual({ ticks: 3, reloads: 0, outcome: "max-ticks" });
		expect(ticks).toBe(3);
		expect(sleeps).toEqual([1_500, 1_500, 1_500]);
	});

	it("honors a stop request before ticking and runs onStop", async () => {
		let ticked = false;
		let stopped = false;
		const result = await runDaemonLoop(
			baseLoop({
				readControl: async () => ({ version: 1, kind: "stop", targetOwnerId: "owner-A", requestedAt: 2_000 }),
				readOwner: async () => ownerState(),
				tick: async () => {
					ticked = true;
					return tickResult();
				},
				onStop: () => {
					stopped = true;
				},
			}),
		);
		expect(result.outcome).toBe("stopped");
		expect(ticked).toBe(false);
		expect(stopped).toBe(true);
	});

	it("honors a reload request and reports it", async () => {
		const result = await runDaemonLoop(
			baseLoop({
				readControl: async () =>
					({ version: 1, kind: "reload", targetOwnerId: "owner-A", requestedAt: 2_000 }) as DaemonControlRequest,
				readOwner: async () => ownerState(),
			}),
		);
		expect(result).toEqual({ ticks: 0, reloads: 1, outcome: "reloaded" });
	});

	it("sleeps for the poll backoff when present", async () => {
		const sleeps: number[] = [];
		await runDaemonLoop(
			baseLoop({
				maxTicks: 1,
				tick: async () => tickResult({ poll: { ok: false, updateCount: 0, retryable: true, backoffMs: 4_000 } }),
				sleep: async ms => {
					sleeps.push(ms);
				},
			}),
		);
		expect(sleeps).toEqual([4_000]);
	});
});
