import { describe, expect, it } from "bun:test";
import * as fs from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";
import { writeDaemonControl } from "../src/notifications/daemon-control";
import { runManagedDaemon } from "../src/notifications/daemon-runtime";
import { fingerprintSecret, readTransportOwner, writeTransportOwner } from "../src/notifications/transport-state";

const TOKEN = "BOT:TOKEN";
const CHAT = "chat-1";
const noSleep = async (): Promise<void> => {};

function fetchOk(): typeof fetch {
	return (async () =>
		new Response(JSON.stringify({ ok: true, result: [] }), {
			status: 200,
			headers: { "content-type": "application/json" },
		})) as unknown as typeof fetch;
}

async function tmpAgentDir(): Promise<string> {
	return fs.mkdtemp(path.join(os.tmpdir(), "jwc-managed-daemon-"));
}

describe("runManagedDaemon (10.030 smoke)", () => {
	it("claims the owner slot and polls for a bounded run", async () => {
		const agentDir = await tmpAgentDir();
		try {
			const result = await runManagedDaemon({
				agentDir,
				token: TOKEN,
				chatId: CHAT,
				ownerId: "d1",
				pid: 1,
				now: () => 1_000,
				sleep: noSleep,
				maxTicks: 2,
				fetchImpl: fetchOk(),
			});
			expect(result.outcome).toBe("max-ticks");
			expect(result.ticks).toBe(2);
			const owner = await readTransportOwner(agentDir);
			expect(owner?.ownerId).toBe("d1");
			expect(owner?.heartbeatAt).toBe(1_000);
		} finally {
			await fs.rm(agentDir, { recursive: true, force: true });
		}
	});

	it("does not let a second daemon take a live owner's slot", async () => {
		const agentDir = await tmpAgentDir();
		try {
			await writeTransportOwner(agentDir, {
				version: 1,
				ownerId: "d1",
				pid: 111,
				startedAt: 1_000,
				heartbeatAt: 1_000,
				tokenFingerprint: fingerprintSecret(TOKEN),
				chatIdFingerprint: fingerprintSecret(CHAT),
			});
			await runManagedDaemon({
				agentDir,
				token: TOKEN,
				chatId: CHAT,
				ownerId: "d2",
				pid: 222,
				now: () => 1_500,
				sleep: noSleep,
				maxTicks: 1,
				heartbeatTtlMs: 20_000,
				pidAlive: () => true,
				fetchImpl: fetchOk(),
			});
			const owner = await readTransportOwner(agentDir);
			expect(owner?.ownerId).toBe("d1"); // d2 deferred; owner unchanged
			expect(owner?.pid).toBe(111);
		} finally {
			await fs.rm(agentDir, { recursive: true, force: true });
		}
	});

	it("honors an owner-scoped stop control and marks the owner stopped", async () => {
		const agentDir = await tmpAgentDir();
		try {
			await writeTransportOwner(agentDir, {
				version: 1,
				ownerId: "d1",
				pid: 1,
				startedAt: 1_000,
				heartbeatAt: 1_000,
				tokenFingerprint: fingerprintSecret(TOKEN),
				chatIdFingerprint: fingerprintSecret(CHAT),
			});
			await writeDaemonControl(agentDir, { version: 1, kind: "stop", targetOwnerId: "d1", requestedAt: 2_000 });
			const result = await runManagedDaemon({
				agentDir,
				token: TOKEN,
				chatId: CHAT,
				ownerId: "d1",
				pid: 1,
				now: () => 3_000,
				sleep: noSleep,
				fetchImpl: fetchOk(),
			});
			expect(result.outcome).toBe("stopped");
			const owner = await readTransportOwner(agentDir);
			expect(owner?.stoppedAt).toBe(3_000);
		} finally {
			await fs.rm(agentDir, { recursive: true, force: true });
		}
	});
});
