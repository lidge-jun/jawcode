import { afterEach, describe, expect, it } from "bun:test";
import {
	__testEvictOnProcessExit,
	__testGetRegisteredClient,
	__testSeedClientForExitRace,
	getActiveClients,
	isIdleCheckerActiveForTests,
	setIdleTimeout,
	shutdownAll,
} from "../src/lsp/client";
import type { LspClient } from "../src/lsp/types";

describe("LSP lifecycle cleanup", () => {
	afterEach(async () => {
		await shutdownAll();
	});

	it("shutdownAll stops the idle checker when no clients remain", async () => {
		setIdleTimeout(60_000);
		expect(isIdleCheckerActiveForTests()).toBe(true);

		await shutdownAll();

		expect(getActiveClients()).toEqual([]);
		expect(isIdleCheckerActiveForTests()).toBe(false);
	});

	it("a stale process exit does not evict a newer client registered under the same key", () => {
		const key = "fake-server:/tmp/fake-cwd";
		const staleClient = { name: key, pendingRequests: new Map() } as unknown as LspClient;
		const newerClient = { name: key, pendingRequests: new Map() } as unknown as LspClient;
		try {
			__testSeedClientForExitRace(key, newerClient);

			// The stale client's process exits AFTER the newer client was registered.
			__testEvictOnProcessExit(key, staleClient);
			expect(__testGetRegisteredClient(key)).toBe(newerClient);

			// The current owner's own exit still evicts.
			__testEvictOnProcessExit(key, newerClient);
			expect(__testGetRegisteredClient(key)).toBeUndefined();
		} finally {
			__testEvictOnProcessExit(key, __testGetRegisteredClient(key) as LspClient);
		}
	});
});
