import { describe, expect, it, vi } from "bun:test";
import type { Browser, Target } from "puppeteer-core";
import { type BrowserHandle, releaseBrowser } from "../src/tools/browser/registry";
import { getTabsMapForTest, releaseTab, type TabSession } from "../src/tools/browser/tab-supervisor";
import { ToolError } from "../src/tools/tool-errors";

function never(): Promise<never> {
	return Promise.withResolvers<never>().promise;
}

describe("browser disposal deadlines", () => {
	it("forces a headless browser disconnect and process kill when Browser.close stalls", async () => {
		const disconnect = vi.fn();
		const kill = vi.fn();
		const browser = {
			connected: true,
			close: never,
			disconnect,
			process: () => ({ kill }),
		} as unknown as Browser;
		const handle: BrowserHandle = {
			key: "headless:1",
			kind: { kind: "headless", headless: true },
			browser,
			refCount: 1,
			stealth: { browserSession: null, override: null },
		};

		await expect(releaseBrowser(handle, { kill: false, timeoutMs: 10, resource: "test tab" })).rejects.toThrow(
			"forced browser disconnect/kill",
		);
		expect(disconnect).toHaveBeenCalledTimes(1);
		expect(kill).toHaveBeenCalledTimes(1);
	});

	it("bounds orphan target cleanup and still evicts the tab registry entry", async () => {
		const target = {
			_targetId: "target_1",
			page: async () => ({ close: never }),
		} as unknown as Target;
		const browser = {
			connected: true,
			targets: () => [target],
		} as unknown as Browser;
		const browserHandle: BrowserHandle = {
			key: "headless:1",
			kind: { kind: "headless", headless: true },
			browser,
			refCount: 2,
			stealth: { browserSession: null, override: null },
		};
		const tab = {
			name: "stalled-orphan",
			browser: browserHandle,
			targetId: "target_1",
			worker: {
				mode: "worker",
				send: () => {
					throw new Error("worker unavailable");
				},
				terminate: async () => {},
			},
			state: "alive",
			info: {},
			pending: new Map(),
			kindTag: "headless",
		} as unknown as TabSession;
		const tabs = getTabsMapForTest() as Map<string, TabSession>;
		tabs.set(tab.name, tab);

		const error = await releaseTab(tab.name, { timeoutMs: 10 }).catch(cause => cause);

		expect(error).toBeInstanceOf(ToolError);
		expect((error as Error).message).toContain("orphan target");
		expect(tabs.has(tab.name)).toBe(false);
	});
});
