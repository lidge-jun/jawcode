import { type DaemonControlRequest, decideDaemonControl } from "./daemon-control";
import type { DaemonTickResult } from "./daemon-engine";
import type { TransportOwnerState } from "./transport-state";

export type DaemonLoopOutcome = "stopped" | "reloaded" | "max-ticks";

export interface DaemonLoopResult {
	ticks: number;
	reloads: number;
	outcome: DaemonLoopOutcome;
}

export interface RunDaemonLoopOptions {
	tick: () => Promise<DaemonTickResult>;
	sleep: (ms: number) => Promise<void>;
	readControl: () => Promise<DaemonControlRequest | null>;
	readOwner: () => Promise<TransportOwnerState | null>;
	clearControl: () => Promise<void>;
	/** Invoked when a stop is honored (e.g. mark the owner record stopped). */
	onStop?: () => Promise<void> | void;
	baseIntervalMs?: number;
	/** Bound the run (tests / finite runs); omit for an unbounded daemon. */
	maxTicks?: number;
}

/**
 * Run the daemon loop: before each tick, check the owner-scoped control request. Honor a stop
 * (run `onStop`, return `stopped`) or a reload (return `reloaded` so a supervisor relaunches; the
 * fresh owner defers via `decideOwnerClaim` until the old pid dies). Otherwise run one tick and sleep
 * for the poll's backoff (or the base interval). Injectable tick/sleep/I/O — no real timers.
 */
export async function runDaemonLoop(options: RunDaemonLoopOptions): Promise<DaemonLoopResult> {
	const baseIntervalMs = options.baseIntervalMs ?? 1_000;
	let ticks = 0;
	let reloads = 0;

	for (;;) {
		const [request, owner] = await Promise.all([options.readControl(), options.readOwner()]);
		const decision = decideDaemonControl({ current: owner, request });

		if (decision.action === "honor-stop") {
			await options.clearControl();
			await options.onStop?.();
			return { ticks, reloads, outcome: "stopped" };
		}
		if (decision.action === "honor-reload") {
			await options.clearControl();
			reloads += 1;
			return { ticks, reloads, outcome: "reloaded" };
		}

		if (options.maxTicks !== undefined && ticks >= options.maxTicks) {
			return { ticks, reloads, outcome: "max-ticks" };
		}

		const result = await options.tick();
		ticks += 1;
		await options.sleep(result.poll?.backoffMs ?? baseIntervalMs);
	}
}
