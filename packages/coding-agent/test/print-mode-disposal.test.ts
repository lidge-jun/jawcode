import { afterEach, beforeEach, describe, expect, it, vi } from "bun:test";
import type { AssistantMessage } from "@jawcode-dev/ai";
import { PRINT_MODE_DISPOSE_BUDGET_MS, runPrintMode } from "../src/modes/print-mode";
import type { AgentSession } from "../src/session/agent-session";

function assistant(stopReason: "stop" | "error"): AssistantMessage {
	return {
		role: "assistant",
		content: [],
		api: "anthropic-messages",
		provider: "anthropic",
		model: "claude-sonnet-4-5",
		stopReason,
		errorMessage: stopReason === "error" ? "failed" : undefined,
		usage: {
			input: 0,
			output: 0,
			cacheRead: 0,
			cacheWrite: 0,
			totalTokens: 0,
			cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 },
		},
		timestamp: Date.now(),
	};
}

async function waitForCall(calls: string[]): Promise<void> {
	for (let attempt = 0; attempt < 20 && calls.length === 0; attempt++) await Promise.resolve();
}

function sessionWithHangingDispose(message: AssistantMessage, calls: string[], hangEveryCall = true): AgentSession {
	let disposeCalls = 0;
	return {
		state: { messages: [message] },
		sessionManager: { getHeader: () => undefined },
		extensionRunner: undefined,
		subscribe: () => () => {},
		prompt: async () => {},
		dispose: async () => {
			disposeCalls++;
			calls.push("dispose");
			if (hangEveryCall || disposeCalls === 1) await new Promise<void>(() => {});
		},
	} as unknown as AgentSession;
}

describe("print-mode bounded disposal", () => {
	beforeEach(() => {
		vi.useFakeTimers();
		vi.spyOn(process.stdout, "write").mockImplementation((...args: unknown[]) => {
			const callback = args.find(arg => typeof arg === "function");
			if (typeof callback === "function") callback();
			return true;
		});
		vi.spyOn(process.stderr, "write").mockImplementation(() => true);
	});

	afterEach(() => {
		vi.useRealTimers();
		vi.restoreAllMocks();
	});

	it("uses the finite disposal budget on normal completion", async () => {
		const calls: string[] = [];
		const run = runPrintMode(sessionWithHangingDispose(assistant("stop"), calls), { mode: "text" });
		await waitForCall(calls);
		vi.advanceTimersByTime(PRINT_MODE_DISPOSE_BUDGET_MS - 1);
		await Promise.resolve();
		expect(calls).toEqual(["dispose"]);
		let settled = false;
		void run.then(() => {
			settled = true;
		});
		await Promise.resolve();
		expect(settled).toBe(false);
		vi.advanceTimersByTime(1);
		await Promise.resolve();
		await run;
	});

	it("disposes with the same finite budget before hard-error exit", async () => {
		const calls: string[] = [];
		const exit = vi.spyOn(process, "exit").mockImplementation(() => {
			calls.push("exit");
			return undefined as never;
		});
		const run = runPrintMode(sessionWithHangingDispose(assistant("error"), calls, false), { mode: "text" });
		await waitForCall(calls);
		vi.advanceTimersByTime(PRINT_MODE_DISPOSE_BUDGET_MS - 1);
		await Promise.resolve();
		expect(calls).toEqual(["dispose"]);
		vi.advanceTimersByTime(1);
		await Promise.resolve();
		await run;
		expect(calls).toEqual(["dispose", "exit", "dispose"]);
		expect(exit).toHaveBeenCalledWith(1);
	});
});
