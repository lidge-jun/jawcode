import { describe, expect, it } from "bun:test";
import { buildInsertHistorySequence, detectHistoryLaneMode } from "@jawcode-dev/tui";
import { VirtualTerminal } from "./virtual-terminal";

/**
 * Scrollback commit primitive (devlog 083.9 P1). Verified against xterm
 * semantics via @xterm/headless: lines pushed out of a `CSI 1;N r` region's
 * top enter the scrollback, and the live zone below the region is untouched.
 */

/** Paint a known full screen: history rows hist-0.., live rows live-0.. */
async function paintScreen(term: VirtualTerminal, liveZoneTop: number, rows: number): Promise<void> {
	let buffer = "\x1b[2J\x1b[H";
	for (let row = 0; row < rows; row++) {
		buffer += `\x1b[${row + 1};1H`;
		buffer += row < liveZoneTop ? `hist-${row}` : `live-${row - liveZoneTop}`;
	}
	term.write(buffer);
	await term.flush();
}

describe("insert-history commit primitive (083.9 P1)", () => {
	it("commits lines into scrollback and leaves the live zone untouched", async () => {
		const rows = 12;
		const liveZoneTop = 8; // rows 0..7 = history region, 8..11 = live zone
		const term = new VirtualTerminal(40, rows);
		await paintScreen(term, liveZoneTop, rows);

		const seq = buildInsertHistorySequence(["committed-0", "committed-1", "committed-2"], {
			liveZoneTop,
			liveZoneBottom: rows,
			screenRows: rows,
			cursor: { row: rows - 1, col: 0 },
		});
		term.write(seq);
		await term.flush();

		// The 3 oldest history rows scrolled out of the region top → scrollback.
		const scrollback = term.getScrollBuffer();
		expect(scrollback).toContain("hist-0");
		expect(scrollback).toContain("hist-1");
		expect(scrollback).toContain("hist-2");
		// Committed lines now sit at the bottom of the history region.
		const viewport = term.getViewport();
		expect(viewport[liveZoneTop - 3]).toBe("committed-0");
		expect(viewport[liveZoneTop - 2]).toBe("committed-1");
		expect(viewport[liveZoneTop - 1]).toBe("committed-2");
		// Live zone pixels are untouched.
		for (let i = 0; i < rows - liveZoneTop; i++) {
			expect(viewport[liveZoneTop + i]).toBe(`live-${i}`);
		}
		// Cursor restored to where the live zone expects it.
		expect(term.getCursorRow()).toBe(rows - 1);
	});

	it("commits are pixel-monotonic: a second commit never rewrites earlier ones", async () => {
		const rows = 10;
		const liveZoneTop = 6;
		const term = new VirtualTerminal(40, rows);
		await paintScreen(term, liveZoneTop, rows);
		const geometry = {
			liveZoneTop,
			liveZoneBottom: rows,
			screenRows: rows,
			cursor: { row: rows - 1, col: 0 },
		};

		term.write(buildInsertHistorySequence(["first-0", "first-1"], geometry));
		await term.flush();
		term.clearWriteLog();
		term.write(buildInsertHistorySequence(["second-0"], geometry));
		await term.flush();

		// Second commit's bytes never mention the first commit's content
		// (no rewrite of committed pixels) and never clear the screen.
		const writes = term.getWriteLog().join("");
		expect(writes.includes("first-0")).toBe(false);
		expect(writes.includes("\x1b[2J")).toBe(false);
		expect(writes.includes("\x1b[3J")).toBe(false);
		// Both commits are present in order in the buffer.
		const all = [...term.getScrollBuffer(), ...term.getViewport()];
		const firstIdx = all.indexOf("first-0");
		const secondIdx = all.indexOf("second-0");
		expect(firstIdx).toBeGreaterThanOrEqual(0);
		expect(secondIdx).toBeGreaterThan(firstIdx);
	});

	it("pushes the live zone down via RI when it is not flush with the bottom", async () => {
		const rows = 12;
		const liveZoneTop = 4;
		const liveZoneBottom = 8; // 4 blank rows below the live zone
		const term = new VirtualTerminal(40, rows);
		await paintScreen(term, liveZoneTop, rows);

		const seq = buildInsertHistorySequence(["c-0", "c-1"], {
			liveZoneTop,
			liveZoneBottom,
			screenRows: rows,
			cursor: { row: liveZoneBottom - 1, col: 0 },
		});
		expect(seq).toContain("\x1bM"); // phase 1 engaged
		term.write(seq);
		await term.flush();

		const viewport = term.getViewport();
		// Live zone content moved down by 2 rows.
		expect(viewport[liveZoneTop + 2]).toBe("live-0");
		// Committed lines occupy the rows directly above the pushed-down live zone.
		expect(viewport[liveZoneTop]).toBe("c-0");
		expect(viewport[liveZoneTop + 1]).toBe("c-1");
	});

	it("returns empty when the live zone owns the whole screen", () => {
		const seq = buildInsertHistorySequence(["x"], {
			liveZoneTop: 0,
			liveZoneBottom: 10,
			screenRows: 10,
			cursor: { row: 9, col: 0 },
		});
		expect(seq).toBe("");
	});

	it("detects lane mode from env", () => {
		expect(detectHistoryLaneMode({})).toBe("standard");
		expect(detectHistoryLaneMode({ TMUX: "/tmp/tmux-1" })).toBe("standard");
		expect(detectHistoryLaneMode({ ZELLIJ: "0" })).toBe("zellij-raw");
		expect(detectHistoryLaneMode({ TERM: "dumb" })).toBe("unsupported");
	});
});
