import { describe, expect, it } from "bun:test";
import * as fs from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";
import {
	DEFAULT_TRANSPORT_HEARTBEAT_TTL_MS,
	fingerprintSecret,
	isFreshLiveTransportOwner,
	markTransportOwnerStopped,
	readTransportOwner,
	readTransportRoots,
	registerTransportRoot,
	sameTransportIdentity,
	type TransportOwnerState,
	transportPaths,
	writeTransportOwner,
	writeTransportRoots,
} from "../src/notifications/transport-state";

function owner(overrides: Partial<TransportOwnerState> = {}): TransportOwnerState {
	return {
		version: 1,
		ownerId: "owner-1",
		pid: 123,
		tokenFingerprint: fingerprintSecret("telegram-token-secret"),
		chatIdFingerprint: fingerprintSecret("chat-id-secret"),
		startedAt: 1782586800000,
		heartbeatAt: 1782586800000,
		...overrides,
	};
}

describe("notification transport state", () => {
	it("fingerprints secrets and compares transport identities without raw values", () => {
		const tokenFingerprint = fingerprintSecret("telegram-token-secret");
		const chatIdFingerprint = fingerprintSecret("chat-id-secret");

		expect(tokenFingerprint).toHaveLength(12);
		expect(chatIdFingerprint).toHaveLength(12);
		expect(tokenFingerprint).not.toContain("telegram-token-secret");
		expect(sameTransportIdentity(owner(), { tokenFingerprint, chatIdFingerprint })).toBe(true);
		expect(sameTransportIdentity(owner(), { tokenFingerprint: fingerprintSecret("other"), chatIdFingerprint })).toBe(
			false,
		);
	});

	it("treats only same-identity live fresh owners as reusable", () => {
		const now = 1782586800000 + 1_000;
		const current = owner();
		const identity = {
			tokenFingerprint: current.tokenFingerprint,
			chatIdFingerprint: current.chatIdFingerprint,
		};

		expect(
			isFreshLiveTransportOwner({
				owner: current,
				now,
				ttlMs: DEFAULT_TRANSPORT_HEARTBEAT_TTL_MS,
				pidAlive: () => true,
				...identity,
			}),
		).toBe(true);
		expect(
			isFreshLiveTransportOwner({
				owner: current,
				now: now + DEFAULT_TRANSPORT_HEARTBEAT_TTL_MS + 1,
				ttlMs: DEFAULT_TRANSPORT_HEARTBEAT_TTL_MS,
				pidAlive: () => true,
				...identity,
			}),
		).toBe(false);
		expect(
			isFreshLiveTransportOwner({
				owner: current,
				now,
				ttlMs: DEFAULT_TRANSPORT_HEARTBEAT_TTL_MS,
				pidAlive: () => false,
				...identity,
			}),
		).toBe(false);
		expect(
			isFreshLiveTransportOwner({
				owner: markTransportOwnerStopped(current, now),
				now,
				ttlMs: DEFAULT_TRANSPORT_HEARTBEAT_TTL_MS,
				pidAlive: () => true,
				...identity,
			}),
		).toBe(false);
		expect(
			isFreshLiveTransportOwner({
				owner: current,
				now,
				ttlMs: DEFAULT_TRANSPORT_HEARTBEAT_TTL_MS,
				pidAlive: () => true,
				tokenFingerprint: fingerprintSecret("rotated"),
				chatIdFingerprint: current.chatIdFingerprint,
			}),
		).toBe(false);
	});

	it("writes private owner state without raw token or chat id", async () => {
		const agentDir = await fs.mkdtemp(path.join(os.tmpdir(), "jwc-transport-owner-"));
		try {
			await writeTransportOwner(agentDir, owner());
			const paths = transportPaths(agentDir);
			const raw = await fs.readFile(paths.ownerFile, "utf8");

			expect(await readTransportOwner(agentDir)).toEqual(owner());
			expect(raw).not.toContain("telegram-token-secret");
			expect(raw).not.toContain("chat-id-secret");
			if (process.platform !== "win32") {
				expect((await fs.stat(paths.dir)).mode & 0o777).toBe(0o700);
				expect((await fs.stat(paths.ownerFile)).mode & 0o777).toBe(0o600);
			}
		} finally {
			await fs.rm(agentDir, { recursive: true, force: true });
		}
	});

	it("registers absolute discovery state roots with dedupe and lock-safe writes", async () => {
		const agentDir = await fs.mkdtemp(path.join(os.tmpdir(), "jwc-transport-roots-"));
		const stateRoot = await fs.mkdtemp(path.join(os.tmpdir(), "jwc-state-root-"));
		try {
			await writeTransportRoots(agentDir, { version: 1, roots: [], sessions: { forward: "compatible" } });
			await registerTransportRoot(agentDir, stateRoot, 1);
			await registerTransportRoot(agentDir, stateRoot, 2);

			const roots = await readTransportRoots(agentDir);
			expect(roots.roots).toEqual([{ stateRoot: path.resolve(stateRoot), updatedAt: 2 }]);
			expect(roots.sessions).toEqual({ forward: "compatible" });
			if (process.platform !== "win32") {
				const paths = transportPaths(agentDir);
				expect((await fs.stat(paths.rootsFile)).mode & 0o777).toBe(0o600);
			}
		} finally {
			await fs.rm(agentDir, { recursive: true, force: true });
			await fs.rm(stateRoot, { recursive: true, force: true });
		}
	});
});
