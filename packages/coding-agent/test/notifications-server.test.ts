import { describe, expect, it } from "bun:test";
import * as fs from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";
import { notificationDiscoveryPath, readNotificationDiscoveryRecord } from "../src/notifications/discovery";
import type { NotificationServerFrame } from "../src/notifications/protocol";
import { NotificationLoopbackServer } from "../src/notifications/server";

async function startServer(sessionId: string): Promise<{ server: NotificationLoopbackServer; stateRoot: string }> {
	const stateRoot = await fs.mkdtemp(path.join(os.tmpdir(), "jwc-notif-server-"));
	const server = await NotificationLoopbackServer.start({ sessionId, stateRoot });
	return { server, stateRoot };
}

/** Minimal real-WebSocket client that buffers frames and lets a test await the next one. */
class Client {
	readonly ws: WebSocket;
	readonly #buffered: NotificationServerFrame[] = [];
	readonly #waiters: ((frame: NotificationServerFrame) => void)[] = [];

	constructor(url: string) {
		this.ws = new WebSocket(url);
		this.ws.addEventListener("message", (event: MessageEvent) => {
			const frame = JSON.parse(String(event.data)) as NotificationServerFrame;
			const waiter = this.#waiters.shift();
			if (waiter) waiter(frame);
			else this.#buffered.push(frame);
		});
	}

	opened(): Promise<boolean> {
		return new Promise(resolve => {
			this.ws.addEventListener("open", () => resolve(true));
			this.ws.addEventListener("error", () => resolve(false));
			this.ws.addEventListener("close", () => resolve(false));
		});
	}

	next(): Promise<NotificationServerFrame> {
		const queued = this.#buffered.shift();
		if (queued) return Promise.resolve(queued);
		return new Promise(resolve => this.#waiters.push(resolve));
	}

	send(frame: unknown): void {
		this.ws.send(JSON.stringify(frame));
	}

	close(): void {
		try {
			this.ws.close();
		} catch {
			// ignore close on an already-closing socket
		}
	}
}

describe("notification loopback server", () => {
	it("rejects connections with a missing or wrong token at upgrade", async () => {
		const { server, stateRoot } = await startServer("session-reject");
		const wrong = new Client(`${server.url}?token=wrong`);
		const missing = new Client(server.url);
		try {
			expect(await wrong.opened()).toBe(false);
			expect(await missing.opened()).toBe(false);
		} finally {
			wrong.close();
			missing.close();
			await server.stop();
			await fs.rm(stateRoot, { recursive: true, force: true });
		}
	});

	it("sends hello and replays buffered actions to authorized late joiners", async () => {
		const { server, stateRoot } = await startServer("session-replay");
		server.enqueueAction({ actionId: "a1", prompt: "Deploy?", options: ["yes", "no"] });
		const client = new Client(`${server.url}?token=${server.connectToken}`);
		try {
			expect(await client.opened()).toBe(true);
			expect(await client.next()).toEqual({ type: "hello", version: 1, sessionId: "session-replay" });
			expect(await client.next()).toEqual({
				type: "action_needed",
				actionId: "a1",
				prompt: "Deploy?",
				options: ["yes", "no"],
			});
		} finally {
			client.close();
			await server.stop();
			await fs.rm(stateRoot, { recursive: true, force: true });
		}
	});

	it("broadcasts action_needed enqueued after connect", async () => {
		const { server, stateRoot } = await startServer("session-live");
		const client = new Client(`${server.url}?token=${server.connectToken}`);
		try {
			expect(await client.opened()).toBe(true);
			expect((await client.next()).type).toBe("hello");
			server.enqueueAction({ actionId: "a2", prompt: "Ship?", options: ["yes"] });
			expect(await client.next()).toEqual({
				type: "action_needed",
				actionId: "a2",
				prompt: "Ship?",
				options: ["yes"],
			});
		} finally {
			client.close();
			await server.stop();
			await fs.rm(stateRoot, { recursive: true, force: true });
		}
	});

	it("resolves a remote reply and broadcasts action_resolved", async () => {
		const { server, stateRoot } = await startServer("session-remote");
		server.enqueueAction({ actionId: "a3", prompt: "Q", options: ["yes", "no"] });
		const client = new Client(`${server.url}?token=${server.connectToken}`);
		try {
			expect(await client.opened()).toBe(true);
			expect((await client.next()).type).toBe("hello");
			expect((await client.next()).type).toBe("action_needed");
			client.send({ type: "reply", actionId: "a3", value: "yes" });
			expect(await client.next()).toEqual({ type: "action_resolved", actionId: "a3" });
		} finally {
			client.close();
			await server.stop();
			await fs.rm(stateRoot, { recursive: true, force: true });
		}
	});

	it("lets a local answer win the race and rejects a later remote reply", async () => {
		const { server, stateRoot } = await startServer("session-race");
		server.enqueueAction({ actionId: "a4", prompt: "Q", options: ["yes"] });
		const client = new Client(`${server.url}?token=${server.connectToken}`);
		try {
			expect(await client.opened()).toBe(true);
			expect((await client.next()).type).toBe("hello");
			expect((await client.next()).type).toBe("action_needed");
			server.resolveLocal("a4");
			expect(await client.next()).toEqual({ type: "action_resolved", actionId: "a4" });
			client.send({ type: "reply", actionId: "a4", value: "yes" });
			expect(await client.next()).toEqual({
				type: "reply_rejected",
				actionId: "a4",
				reason: "already_answered",
				source: "telegram",
			});
		} finally {
			client.close();
			await server.stop();
			await fs.rm(stateRoot, { recursive: true, force: true });
		}
	});

	it("writes a 0600 discovery record while running and removes it on stop", async () => {
		const { server, stateRoot } = await startServer("session-discovery");
		try {
			const record = await readNotificationDiscoveryRecord(stateRoot, "session-discovery");
			expect(record).not.toBeNull();
			expect(record?.token).toBe(server.connectToken);
			expect(record?.host).toBe("127.0.0.1");
			expect(record?.port).toBe(server.port);
			if (process.platform !== "win32") {
				const file = notificationDiscoveryPath(stateRoot, "session-discovery");
				expect((await fs.stat(file)).mode & 0o777).toBe(0o600);
			}
			await server.stop();
			await server.stop(); // idempotent
			expect(await readNotificationDiscoveryRecord(stateRoot, "session-discovery")).toBeNull();
		} finally {
			await fs.rm(stateRoot, { recursive: true, force: true });
		}
	});

	it("answers ping with pong and tolerates malformed frames", async () => {
		const { server, stateRoot } = await startServer("session-ping");
		const client = new Client(`${server.url}?token=${server.connectToken}`);
		try {
			expect(await client.opened()).toBe(true);
			expect((await client.next()).type).toBe("hello");
			client.send({ type: "ping", nonce: "n1" });
			expect(await client.next()).toEqual({ type: "pong", nonce: "n1" });
			client.ws.send("not-json");
			client.send({ type: "ping", nonce: "n2" });
			expect(await client.next()).toEqual({ type: "pong", nonce: "n2" });
		} finally {
			client.close();
			await server.stop();
			await fs.rm(stateRoot, { recursive: true, force: true });
		}
	});
});
