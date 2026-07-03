import { describe, expect, it } from "bun:test";
import { getTtyWinsize } from "../native/index.js";

/**
 * 260703 WP4 — kernel-truth terminal size. getTtyWinsize reads
 * ioctl(TIOCGWINSZ) directly so render-time dimensions never trail SIGWINCH
 * processing (the resize-race corruption class). Under bun test every stdio
 * fd is a pipe, so the interesting assertions are the refusal paths; the
 * positive path is exercised by any interactive run.
 */
describe("getTtyWinsize (260703 WP4)", () => {
	it("returns null for a non-TTY fd", () => {
		// stdout under the test runner is a pipe.
		expect(getTtyWinsize(1)).toBeNull();
	});

	it("returns null for an invalid fd", () => {
		expect(getTtyWinsize(987)).toBeNull();
	});

	it("agrees with the runtime when a real TTY is attached", () => {
		const size = getTtyWinsize(1);
		if (process.stdout.isTTY && size) {
			expect(size.cols).toBe(process.stdout.columns);
			expect(size.rows).toBe(process.stdout.rows);
			expect(size.cols).toBeGreaterThan(0);
		} else {
			// Non-interactive runner: refusal path already covered above.
			expect(size).toBeNull();
		}
	});
});
