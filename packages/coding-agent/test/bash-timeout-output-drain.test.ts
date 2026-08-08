/**
 * A timed-out command must still return the output it already produced.
 *
 * On timeout the executor sets `acceptingChunks = false` and immediately
 * dumps the sink. Anything the process had already written but that had not
 * yet been delivered through `onChunk` is discarded — so the very output that
 * explains WHY a command was still running is the output the user loses.
 *
 * A long build that prints progress and then stalls is the normal case here:
 * you get "Command timed out after N seconds" and nothing else.
 */
import { describe, expect, it } from "bun:test";
import { executeBash } from "@jawcode-dev/coding-agent/exec/bash-executor";

describe("bash timeout output drainage", () => {
	it("returns output produced before the timeout fired", async () => {
		// Print a marker, flush, then hang well past the timeout.
		const result = await executeBash("echo BEFORE_TIMEOUT_MARKER; sleep 30", { timeout: 1500 });

		expect(result.timedOut).toBe(true);
		// The marker was written a second before the deadline; losing it is the bug.
		expect(result.output).toContain("BEFORE_TIMEOUT_MARKER");
		expect(result.output).toContain("timed out");
	}, 30_000);

	it("returns output produced before an abort", async () => {
		const controller = new AbortController();
		setTimeout(() => controller.abort(), 1500);
		const result = await executeBash("echo BEFORE_ABORT_MARKER; sleep 30", { signal: controller.signal });

		expect(result.cancelled).toBe(true);
		expect(result.output).toContain("BEFORE_ABORT_MARKER");
	}, 30_000);

	it("keeps output that is still streaming as the deadline lands", async () => {
		// The narrow case: a command producing output continuously right up to the
		// timeout. Chunks in flight when `acceptingChunks` flips are the ones at
		// risk, and they are exactly the tail that explains where the command got
		// stuck.
		const result = await executeBash("i=0; while [ $i -lt 400 ]; do echo LINE_$i; i=$((i+1)); done; sleep 30", {
			timeout: 1500,
		});

		expect(result.timedOut).toBe(true);
		expect(result.output).toContain("LINE_0");
		// The tail matters more than the head: it is the last thing the command did.
		expect(result.output).toContain("LINE_399");
	}, 30_000);
});
