import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { existsSync } from "node:fs";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import * as path from "node:path";

import { isUnixSocketAlive } from "../src/modes/rpc/rpc-mode";

/**
 * In-process regression guard for the `runRpcMode` `--listen` startup sequence
 * (rpc-mode.ts: `if (await isUnixSocketAlive) throw "already in use"; else fs.rm(force)`).
 *
 * The subprocess clobber-refusal integration test lives in
 * `rpc-listen-socket-guard.test.ts` but requires Bun >= 1.3.14 via `Bun.spawnSync`.
 * These tests exercise the recovery/preservation contract without spawning a subprocess,
 * so the behavior stays guarded on any Bun runtime.
 */
describe("rpc --listen startup guard (in-process)", () => {
	let workspace: string;

	beforeEach(async () => {
		workspace = await mkdtemp(path.join(tmpdir(), "rpc-listen-startup-"));
	});

	afterEach(async () => {
		await rm(workspace, { recursive: true, force: true });
	});

	test("stale socket file is cleared and the path becomes listenable again", async () => {
		const socketPath = path.join(workspace, "stale.sock");

		// A leftover file with no live listener behind it (stale).
		await writeFile(socketPath, "");
		expect(existsSync(socketPath)).toBe(true);
		expect(await isUnixSocketAlive(socketPath)).toBe(false);

		// Startup recovery path: not alive → remove the stale file, then bind.
		await rm(socketPath, { force: true });
		const server = Bun.listen({
			unix: socketPath,
			socket: { data() {}, open() {}, close() {}, error() {} },
		});
		try {
			expect(await isUnixSocketAlive(socketPath)).toBe(true);
		} finally {
			server.stop(true);
		}
		expect(await isUnixSocketAlive(socketPath)).toBe(false);
	});

	test("a live socket is detected and its file is preserved (refuse without steal)", async () => {
		const socketPath = path.join(workspace, "live.sock");
		const server = Bun.listen({
			unix: socketPath,
			socket: { data() {}, open() {}, close() {}, error() {} },
		});
		try {
			// Startup precondition: alive → the guard throws before any fs.rm,
			// so the live endpoint is never unlinked/stolen.
			expect(await isUnixSocketAlive(socketPath)).toBe(true);
			expect(existsSync(socketPath)).toBe(true);
		} finally {
			server.stop(true);
		}
	});

	test("a missing socket path reports not-alive without creating a file", async () => {
		const socketPath = path.join(workspace, "missing.sock");
		expect(existsSync(socketPath)).toBe(false);
		expect(await isUnixSocketAlive(socketPath)).toBe(false);
		expect(existsSync(socketPath)).toBe(false);
	});
});
