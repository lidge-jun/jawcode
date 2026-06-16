/**
 * `Bun.sleep` / `Bun.sleepSync` Node 22 implementation (100.03 / inventory E).
 * Promise.race-compatible: a plain timers/promises timeout.
 */
import { setTimeout as sleepTimeout } from "node:timers/promises";

export function bunSleep(ms: number | Date): Promise<void> {
	const delay = ms instanceof Date ? Math.max(0, ms.getTime() - Date.now()) : ms;
	return sleepTimeout(delay) as Promise<void>;
}

export function bunSleepSync(ms: number): void {
	Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, Math.max(0, ms));
}
