import { describe, expect, it } from "bun:test";

import { formatIdleTimeoutMessage, IdleTimeoutWatchdog } from "../src/exec/idle-timeout-watchdog";

const sleep = (ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms));

describe("IdleTimeoutWatchdog", () => {
	it("aborts on idle timeout and reports timedOut + onAbort reason", async () => {
		const reasons: string[] = [];
		const watchdog = new IdleTimeoutWatchdog({
			timeoutMs: 20,
			hardTimeoutGraceMs: 0,
			onAbort: reason => reasons.push(reason),
		});

		expect(watchdog.timedOut).toBe(false);
		expect(watchdog.signal.aborted).toBe(false);

		await sleep(60);

		expect(watchdog.timedOut).toBe(true);
		expect(watchdog.signal.aborted).toBe(true);
		expect(reasons).toEqual(["idle-timeout"]);

		watchdog.dispose();
	});

	it("touch() resets the idle timer so the abort is deferred", async () => {
		const watchdog = new IdleTimeoutWatchdog({ timeoutMs: 50, hardTimeoutGraceMs: 0 });

		await sleep(35);
		expect(watchdog.timedOut).toBe(false);
		// reset the window — without touch this would fire around 50ms
		watchdog.touch();

		await sleep(35); // ~70ms total, but only ~35ms since touch
		expect(watchdog.timedOut).toBe(false);

		await sleep(40); // now ~75ms since touch — past the reset window
		expect(watchdog.timedOut).toBe(true);

		watchdog.dispose();
	});

	it("aborts when an external signal aborts and exposes abortedBySignal", () => {
		const controller = new AbortController();
		const reasons: string[] = [];
		const watchdog = new IdleTimeoutWatchdog({
			hardTimeoutGraceMs: 0,
			signal: controller.signal,
			onAbort: reason => reasons.push(reason),
		});

		expect(watchdog.abortedBySignal).toBe(false);
		controller.abort();

		expect(watchdog.abortedBySignal).toBe(true);
		expect(watchdog.timedOut).toBe(false);
		expect(watchdog.signal.aborted).toBe(true);
		expect(reasons).toEqual(["signal"]);

		watchdog.dispose();
	});

	it("aborts immediately when constructed with an already-aborted signal", () => {
		const controller = new AbortController();
		controller.abort();
		const watchdog = new IdleTimeoutWatchdog({
			hardTimeoutGraceMs: 0,
			signal: controller.signal,
		});

		expect(watchdog.abortedBySignal).toBe(true);
		expect(watchdog.signal.aborted).toBe(true);

		watchdog.dispose();
	});

	it("resolves hardTimeoutPromise after the grace window following an abort", async () => {
		const watchdog = new IdleTimeoutWatchdog({ timeoutMs: 10, hardTimeoutGraceMs: 20 });
		const result = await watchdog.hardTimeoutPromise;
		expect(result).toBe("hard-timeout");
		watchdog.dispose();
	});

	it("dispose() cancels the idle timer and detaches the signal listener (no late abort)", async () => {
		const controller = new AbortController();
		const reasons: string[] = [];
		const watchdog = new IdleTimeoutWatchdog({
			timeoutMs: 20,
			hardTimeoutGraceMs: 0,
			signal: controller.signal,
			onAbort: reason => reasons.push(reason),
		});

		watchdog.dispose();
		await sleep(50);
		// idle timer cleared
		expect(watchdog.timedOut).toBe(false);
		// signal listener detached → late abort is ignored
		controller.abort();
		expect(watchdog.abortedBySignal).toBe(false);
		expect(reasons).toEqual([]);
	});

	it("only fires onAbort once — the idle timer is cleared by a signal abort", async () => {
		const controller = new AbortController();
		const reasons: string[] = [];
		const watchdog = new IdleTimeoutWatchdog({
			timeoutMs: 20,
			hardTimeoutGraceMs: 0,
			signal: controller.signal,
			onAbort: reason => reasons.push(reason),
		});

		controller.abort(); // signal wins before the idle timer
		await sleep(50); // idle timer would have fired by now if not cleared

		expect(reasons).toEqual(["signal"]);
		expect(watchdog.abortedBySignal).toBe(true);

		watchdog.dispose();
	});
});

describe("formatIdleTimeoutMessage", () => {
	it("formats a generic message when no timeout is provided", () => {
		expect(formatIdleTimeoutMessage()).toBe("Command timed out without output");
	});

	it("formats seconds (rounded, min 1) when a timeout is provided", () => {
		expect(formatIdleTimeoutMessage(5000)).toBe("Command timed out after 5 seconds without output");
		expect(formatIdleTimeoutMessage(200)).toBe("Command timed out after 1 seconds without output");
	});
});
