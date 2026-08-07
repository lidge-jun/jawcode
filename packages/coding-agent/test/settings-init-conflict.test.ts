/**
 * `Settings.init()` is first-wins, and used to drop a later caller's options
 * without a word.
 *
 * That is fine when the later caller passed nothing — 17 in-tree call sites do
 * exactly that. It is not fine when an embedder explicitly passes a different
 * `cwd` or `agentDir`: they point at one project, silently get another, and
 * nothing in the logs explains it.
 *
 * The singleton behavior is deliberately unchanged; only the silence is.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "bun:test";
import { logger } from "@jawcode-dev/utils";
import { resetSettingsForTest, Settings } from "../src/config/settings";

/** One captured `logger.warn(message, fields)` call. */
type WarnCall = [string, { conflicts: string[] }];

const warnCalls: WarnCall[] = [];

function conflictWarnings(): WarnCall[] {
	return warnCalls.filter(([message]) => message.includes("conflicting options"));
}

beforeEach(() => {
	resetSettingsForTest();
	warnCalls.length = 0;
	vi.spyOn(logger, "warn").mockImplementation((message: string, fields?: unknown) => {
		warnCalls.push([message, fields as { conflicts: string[] }]);
	});
});

afterEach(() => {
	vi.restoreAllMocks();
	resetSettingsForTest();
});

describe("Settings.init option conflicts", () => {
	it("warns when a later caller asks for a different agentDir", async () => {
		const first = await Settings.init({ inMemory: true, agentDir: "/tmp/jwc-a" });
		const second = await Settings.init({ inMemory: true, agentDir: "/tmp/jwc-b" });

		const warnings = conflictWarnings();
		expect(warnings).toHaveLength(1);
		expect(warnings[0]?.[1].conflicts).toEqual(["agentDir"]);
		// First-wins is the contract; the fix adds a diagnostic, not a new instance.
		expect(second).toBe(first);
	});

	it("warns for a different cwd", async () => {
		await Settings.init({ inMemory: true, cwd: "/tmp/jwc-one" });
		await Settings.init({ inMemory: true, cwd: "/tmp/jwc-two" });
		expect(conflictWarnings()).toHaveLength(1);
	});

	it("stays silent for a bare re-init, which means 'use what is configured'", async () => {
		// This is the common case: 17 call sites call Settings.init() with no
		// arguments. Warning on those would make the diagnostic worthless noise.
		await Settings.init({ inMemory: true, cwd: "/tmp/jwc-one" });
		await Settings.init();
		expect(conflictWarnings()).toHaveLength(0);
	});

	it("stays silent when the same options are passed again", async () => {
		await Settings.init({ inMemory: true, cwd: "/tmp/jwc-same" });
		await Settings.init({ inMemory: true, cwd: "/tmp/jwc-same" });
		expect(conflictWarnings()).toHaveLength(0);
	});

	it("ignores key order rather than treating it as a conflict", async () => {
		await Settings.init({ inMemory: true, cwd: "/tmp/jwc-order" });
		await Settings.init({ cwd: "/tmp/jwc-order", inMemory: true });
		expect(conflictWarnings()).toHaveLength(0);
	});

	it("compares overrides structurally, not by object identity", async () => {
		await Settings.init({ inMemory: true, overrides: { "retry.enabled": true } });
		await Settings.init({ inMemory: true, overrides: { "retry.enabled": true } });
		expect(conflictWarnings()).toHaveLength(0);

		await Settings.init({ inMemory: true, overrides: { "retry.enabled": false } });
		expect(conflictWarnings()).toHaveLength(1);
	});

	it("names every conflicting field at once", async () => {
		await Settings.init({ inMemory: true, cwd: "/tmp/jwc-a", agentDir: "/tmp/agent-a" });
		await Settings.init({ inMemory: true, cwd: "/tmp/jwc-b", agentDir: "/tmp/agent-b" });
		expect(conflictWarnings()[0]?.[1].conflicts.sort()).toEqual(["agentDir", "cwd"]);
	});
});
