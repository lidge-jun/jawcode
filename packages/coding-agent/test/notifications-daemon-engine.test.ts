import { describe, expect, it } from "bun:test";
import { type RunDaemonTickOptions, runDaemonTick } from "../src/notifications/daemon-engine";
import type { TelegramUpdate } from "../src/notifications/telegram-api";
import { fingerprintSecret, type TransportOwnerState } from "../src/notifications/transport-state";

const TOKEN = "BOT:TOKEN";
const CHAT = "chat-1";

function ownerState(overrides: Partial<TransportOwnerState> = {}): TransportOwnerState {
	return {
		version: 1,
		ownerId: "other",
		pid: 9999,
		startedAt: 1_000,
		heartbeatAt: 1_000,
		tokenFingerprint: fingerprintSecret(TOKEN),
		chatIdFingerprint: fingerprintSecret(CHAT),
		...overrides,
	};
}

function baseOptions(overrides: Partial<RunDaemonTickOptions> = {}): RunDaemonTickOptions {
	return {
		agentDir: "/tmp/agent",
		token: TOKEN,
		chatId: CHAT,
		ownerId: "self",
		pid: 100,
		now: () => 2_000,
		readOwner: async () => null,
		writeOwner: async () => {},
		scan: async () => ({ observations: [], errors: [] }),
		getUpdates: async () => ({ ok: true, result: [] }),
		...overrides,
	};
}

function capturingWriter() {
	const box: { owner: TransportOwnerState | null } = { owner: null };
	return {
		box,
		writeOwner: async (_dir: string, owner: TransportOwnerState) => {
			box.owner = owner;
		},
	};
}

describe("runDaemonTick", () => {
	it("defers to a fresh live owner without writing", async () => {
		const writer = capturingWriter();
		const result = await runDaemonTick(
			baseOptions({
				readOwner: async () => ownerState({ ownerId: "other", pid: 9999, heartbeatAt: 1_995 }),
				writeOwner: writer.writeOwner,
				now: () => 2_000,
				heartbeatTtlMs: 20_000,
				pidAlive: () => true,
			}),
		);
		expect(result.decision.action).toBe("defer");
		expect(result.owned).toBe(false);
		expect(writer.box.owner).toBeNull();
		expect(result.poll).toBeUndefined();
	});

	it("claims when there is no owner, writes a heartbeat, scans, and polls", async () => {
		const writer = capturingWriter();
		const result = await runDaemonTick(
			baseOptions({
				readOwner: async () => null,
				writeOwner: writer.writeOwner,
				now: () => 2_000,
				scan: async () => ({
					observations: [{ sessionId: "s1", url: "ws://x", tokenMasked: null, inboundMode: "drop" }],
					errors: [],
				}),
				getUpdates: async () => ({ ok: true, result: [{ update_id: 7 }] as TelegramUpdate[] }),
			}),
		);
		expect(result.decision.action).toBe("claim");
		expect(result.owned).toBe(true);
		expect(writer.box.owner).toMatchObject({ ownerId: "self", pid: 100, heartbeatAt: 2_000, startedAt: 2_000 });
		expect(result.scannedSessions).toBe(1);
		expect(result.poll).toMatchObject({ ok: true, updateCount: 1, nextOffset: 8 });
		expect(result.nextPollState).toEqual({ offset: 8, attempt: 0 });
	});

	it("keeps self ownership and preserves startedAt", async () => {
		const writer = capturingWriter();
		const result = await runDaemonTick(
			baseOptions({
				pid: 100,
				readOwner: async () => ownerState({ ownerId: "self", pid: 100, startedAt: 500, heartbeatAt: 1_990 }),
				writeOwner: writer.writeOwner,
				now: () => 2_000,
				pidAlive: () => true,
			}),
		);
		expect(result.decision.reason).toBe("self-owner");
		expect(writer.box.owner).toMatchObject({ startedAt: 500, heartbeatAt: 2_000 });
	});

	it("keeps the offset and resets attempts on an empty poll", async () => {
		const result = await runDaemonTick(
			baseOptions({ pollState: { offset: 42, attempt: 3 }, getUpdates: async () => ({ ok: true, result: [] }) }),
		);
		expect(result.poll).toMatchObject({ ok: true, updateCount: 0, nextOffset: 42 });
		expect(result.nextPollState).toEqual({ offset: 42, attempt: 0 });
	});

	it("backs off and increments attempt on a retryable poll error", async () => {
		const result = await runDaemonTick(
			baseOptions({
				pollState: { offset: 10, attempt: 2 },
				getUpdates: async () => ({ ok: false, retryable: true, status: 503, reason: "server error" }),
			}),
		);
		expect(result.owned).toBe(true);
		expect(result.poll).toMatchObject({ ok: false, retryable: true, backoffMs: 2_000 });
		expect(result.nextPollState).toEqual({ offset: 10, attempt: 3 });
	});

	it("does not back off on a fatal 409 conflict but stays owner", async () => {
		const result = await runDaemonTick(
			baseOptions({
				pollState: { offset: 10, attempt: 1 },
				getUpdates: async () => ({ ok: false, retryable: false, status: 409, reason: "conflict" }),
			}),
		);
		expect(result.owned).toBe(true);
		expect(result.poll).toMatchObject({ ok: false, retryable: false, status: 409 });
		expect(result.poll?.backoffMs).toBeUndefined();
		expect(result.nextPollState).toEqual({ offset: 10, attempt: 1 });
	});
});
