import { describe, expect, it } from "bun:test";
import { type Component, type Terminal, TUI, ViewportFill } from "@jawcode-dev/tui";
import { VirtualTerminal } from "./virtual-terminal";

/**
 * REPRO + FIX — misaligned-viewport drift and turn-boundary realign (260702).
 *
 * Drift: growth painted via viewportRepaint only (real terminals report
 * isViewportAtBottom === undefined, so an above-viewport change + tail growth
 * takes the repaint-only branch) inflates #maxLinesRendered beyond the
 * physically materialized #overflowFloor. A later plain-diff shrink then maps
 * the shrunken frame against the inflated viewport top: the frame tail is
 * painted at the TOP of the physical viewport with a blank band below —
 * composer mid-screen, stale rows persisting (the 260702 user screenshot).
 *
 * Fix under test: (1) the misaligned-viewport quarantine routes every render
 * through the absolute viewport repaint until logical and physical state
 * realign; (2) realignOverflowedFrame() scrolls the visible transcript tail
 * into the scrollback once at the turn boundary and resets the floor.
 */

class MutableContent implements Component {
	#lines: string[];
	constructor(lines: string[]) {
		this.#lines = [...lines];
	}
	setLines(lines: string[]): void {
		this.#lines = [...lines];
	}
	invalidate(): void {}
	render(_width: number): string[] {
		return [...this.#lines];
	}
}

class ComposerStub implements Component {
	invalidate(): void {}
	render(_width: number): string[] {
		return ["[status]", "> input"];
	}
}

async function flushRender(term: VirtualTerminal): Promise<void> {
	await new Promise<void>(resolve => process.nextTick(resolve));
	await Bun.sleep(17);
	await term.flush();
}

function lines(prefix: string, count: number): string[] {
	return Array.from({ length: count }, (_, i) => `${prefix}-${i}`);
}

/** Real terminals (ProcessTerminal) do not implement isViewportAtBottom. */
function unknownViewportTerminal(term: VirtualTerminal): Terminal {
	return {
		start: term.start.bind(term),
		stop: term.stop.bind(term),
		drainInput: term.drainInput.bind(term),
		write: term.write.bind(term),
		get available() {
			return term.available;
		},
		get columns() {
			return term.columns;
		},
		get rows() {
			return term.rows;
		},
		get kittyProtocolActive() {
			return term.kittyProtocolActive;
		},
		moveBy: term.moveBy.bind(term),
		hideCursor: term.hideCursor.bind(term),
		showCursor: term.showCursor.bind(term),
		clearLine: term.clearLine.bind(term),
		clearFromCursor: term.clearFromCursor.bind(term),
		clearScreen: term.clearScreen.bind(term),
		setTitle: term.setTitle.bind(term),
		setProgress: term.setProgress.bind(term),
		onAppearanceChange: term.onAppearanceChange.bind(term),
		get appearance() {
			return term.appearance;
		},
	};
}

/** Every marker row must exist at most once across scrollback + screen. */
function duplicatedMarkers(buffer: string[], prefixes: string[]): string[] {
	const counts = new Map<string, number>();
	for (const raw of buffer) {
		const line = raw.trimEnd();
		if (prefixes.some(p => line.startsWith(`${p}-`))) {
			counts.set(line, (counts.get(line) ?? 0) + 1);
		}
	}
	return [...counts.entries()].filter(([, n]) => n > 1).map(([line, n]) => `${line}×${n}`);
}

describe("misaligned viewport quarantine (260702)", () => {
	it("viewportRepaint-only growth followed by a plain shrink keeps the composer on the floor with no stale rows", async () => {
		const term = new VirtualTerminal(60, 20);
		// Phase 0 — materialize physically: [chat ×40][tool ×1][composer ×2].
		const chat = new MutableContent(lines("chat", 40));
		const tool = new MutableContent(["tool-summary"]);
		const tui = new TUI(unknownViewportTerminal(term));
		tui.addChild(new ViewportFill());
		tui.addChild(chat);
		tui.addChild(tool);
		tui.addChild(new ComposerStub());
		tui.start();
		await flushRender(term);

		// Phase 1 — repaint-only growth: an above-viewport row changes while
		// the live tail grows 1 → 15 (unknown viewport ⇒ no physical scroll,
		// #maxLinesRendered inflates beyond #overflowFloor).
		chat.setLines(["chat-0 (done)", ...lines("chat", 40).slice(1)]);
		tool.setLines(lines("live", 15));
		tui.requestRender();
		await flushRender(term);

		// Phase 2 — plain shrink below the floor (tool collapse + shed).
		chat.setLines(["chat-0 (done)", ...lines("chat", 40).slice(1, 37)]);
		tool.setLines(["tool-collapsed"]);
		tui.requestRender();
		await flushRender(term);

		const buffer = term.getScrollBuffer();
		expect(duplicatedMarkers(buffer, ["chat", "tool", "live"])).toEqual([]);

		// The collapsed live preview must not linger inside the viewport.
		const viewportY = term.getViewportY();
		const staleLive = buffer
			.slice(viewportY)
			.map(l => l.trimEnd())
			.filter(l => l.startsWith("live-"));
		expect(staleLive).toEqual([]);

		// Composer floor intact — this is exactly what the drift broke
		// (composer stranded mid-screen with a blank band below).
		const viewport = term.getViewport();
		expect(viewport[viewport.length - 1].trimEnd()).toBe("> input");

		tui.stop();
	});

	it("continued streaming after the quarantined shrink stays duplicate-free and consumes the residue", async () => {
		const term = new VirtualTerminal(60, 20);
		const chat = new MutableContent(lines("chat", 40));
		const tool = new MutableContent(["tool-summary"]);
		const tui = new TUI(unknownViewportTerminal(term));
		tui.addChild(new ViewportFill());
		tui.addChild(chat);
		tui.addChild(tool);
		tui.addChild(new ComposerStub());
		tui.start();
		await flushRender(term);

		// Inflate, then shrink (same shape as the repro above).
		chat.setLines(["chat-0 (done)", ...lines("chat", 40).slice(1)]);
		tool.setLines(lines("live", 15));
		tui.requestRender();
		await flushRender(term);
		tool.setLines(["tool-collapsed"]);
		tui.requestRender();
		await flushRender(term);

		// Keep streaming: the next tool grows and completes twice more.
		for (let round = 0; round < 2; round++) {
			tool.setLines([`tool-collapsed`, ...lines(`out${round}`, 8)]);
			tui.requestRender();
			await flushRender(term);
			tool.setLines([`tool-collapsed`, `out${round}-done`]);
			tui.requestRender();
			await flushRender(term);
		}

		const buffer = term.getScrollBuffer();
		expect(duplicatedMarkers(buffer, ["chat", "live", "out0", "out1"])).toEqual([]);
		const viewport = term.getViewport();
		expect(viewport[viewport.length - 1].trimEnd()).toBe("> input");

		tui.stop();
	});
});

describe("turn-boundary scroll-out realign (260702 F3)", () => {
	it("keeps the previous tail visible with the new content directly below it (no full-screen fill wall)", async () => {
		const term = new VirtualTerminal(60, 20);
		const chat = new MutableContent(lines("chat", 40));
		const tui = new TUI(unknownViewportTerminal(term));
		tui.addChild(new ViewportFill());
		tui.addChild(chat);
		tui.addChild(new ComposerStub());
		tui.start();
		await flushRender(term);

		// Turn boundary: realign + sweep + new user message land in the SAME
		// render flush (the real submit path is synchronous up to the tick).
		expect(tui.realignOverflowedFrame(2)).toBe(true);
		chat.setLines(["user-msg-1"]);
		tui.requestRender();
		await flushRender(term);

		const viewport = term.getViewport().map(l => l.trimEnd());
		// The previous turn's tail is still on screen (committed block) and
		// the new message sits DIRECTLY below it — not at the bottom of a
		// blank fill wall (user e2e 260702 follow-up 3).
		const tailIdx = viewport.indexOf("chat-39");
		const msgIdx = viewport.indexOf("user-msg-1");
		expect(tailIdx).toBeGreaterThan(-1);
		expect(msgIdx).toBe(tailIdx + 1);
		expect(viewport[viewport.length - 1]).toBe("> input");
		expect(duplicatedMarkers(term.getScrollBuffer(), ["chat"])).toEqual([]);

		tui.stop();
	});

	it("realignOverflowedFrame preserves the visible transcript tail in scrollback and unpins the floor", async () => {
		const term = new VirtualTerminal(60, 20);
		const chat = new MutableContent(lines("chat", 40));
		const composerRows = 2;
		const tui = new TUI(unknownViewportTerminal(term));
		tui.addChild(new ViewportFill());
		tui.addChild(chat);
		tui.addChild(new ComposerStub());
		tui.start();
		await flushRender(term);

		// Overflowed: 43-row frame on a 20-row terminal.
		expect(term.getScrollBuffer().map(l => l.trimEnd())).toContain("chat-0");

		// Turn boundary: realign, then the sweep empties the transcript from
		// the frame (committed cells are skipped at render time).
		const realigned = tui.realignOverflowedFrame(composerRows);
		expect(realigned).toBe(true);
		chat.setLines([]);
		tui.requestRender();
		await flushRender(term);

		const buffer = term.getScrollBuffer().map(l => l.trimEnd());
		// Every transcript row survives in the physical buffer exactly once —
		// including the tail rows that were only visible (never scrolled) at
		// realign time.
		for (let i = 0; i < 40; i++) {
			expect(buffer.filter(l => l === `chat-${i}`).length).toBe(1);
		}
		// The fresh frame is pinned again: composer at the terminal bottom.
		const viewport = term.getViewport();
		expect(viewport[viewport.length - 1].trimEnd()).toBe("> input");
		// No composer pixels entered the scrollback during the scroll-out.
		const viewportY = term.getViewportY();
		const composerCopies = buffer.slice(0, viewportY).filter(l => l === "> input");
		expect(composerCopies).toEqual([]);

		tui.stop();
	});

	it("does not stamp trailing blank rows into the scrollback at the turn boundary", async () => {
		const term = new VirtualTerminal(60, 20);
		// Turn-end shape: content, then a run of tombstone/spacing blanks
		// sitting between the transcript end and the composer cluster.
		const chat = new MutableContent([...lines("chat", 30), "", "", "", "", "", ""]);
		const tui = new TUI(unknownViewportTerminal(term));
		tui.addChild(new ViewportFill());
		tui.addChild(chat);
		tui.addChild(new ComposerStub());
		tui.start();
		await flushRender(term);

		expect(tui.realignOverflowedFrame(2)).toBe(true);
		chat.setLines([]);
		tui.requestRender();
		await flushRender(term);

		const buffer = term.getScrollBuffer().map(l => l.trimEnd());
		const lastContentIdx = buffer.lastIndexOf("chat-29");
		expect(lastContentIdx).toBeGreaterThan(-1);
		// History must end at the last content row — no blank band between the
		// finished turn and the fresh frame (user e2e 260702 follow-up 2).
		const viewportY = term.getViewportY();
		const trailing = buffer.slice(lastContentIdx + 1, viewportY).filter(l => l === "");
		expect(trailing.length).toBeLessThanOrEqual(1);
		// And nothing was lost or duplicated.
		expect(duplicatedMarkers(buffer, ["chat"])).toEqual([]);
		expect(buffer.filter(l => l === "chat-29").length).toBe(1);

		tui.stop();
	});

	it("stays realignable when the post-realign frame immediately re-overflows (floor 0, quarantined)", async () => {
		const term = new VirtualTerminal(60, 20);
		const chat = new MutableContent(lines("chat", 40));
		const tui = new TUI(unknownViewportTerminal(term));
		tui.addChild(new ViewportFill());
		tui.addChild(chat);
		tui.addChild(new ComposerStub());
		tui.start();
		await flushRender(term);

		// First turn boundary: realign succeeds, but the next turn's content
		// keeps the frame overflowing BEFORE the forced rebuild runs — the
		// rebuild downgrades to a viewport repaint (#hasCommittedHistory), so
		// the floor stays 0 while the logical frame exceeds the viewport.
		expect(tui.realignOverflowedFrame(2)).toBe(true);
		chat.setLines(lines("next", 40));
		tui.requestRender();
		await flushRender(term);

		// B-verify finding 1: the second turn boundary must still realign —
		// refusing here would permanently kill the commit lane again.
		expect(tui.realignOverflowedFrame(2)).toBe(true);
		chat.setLines([]);
		tui.requestRender();
		await flushRender(term);

		const buffer = term.getScrollBuffer().map(l => l.trimEnd());
		expect(duplicatedMarkers(buffer, ["chat", "next"])).toEqual([]);
		// The second turn's visible tail survived into history.
		expect(buffer.filter(l => l === "next-39").length).toBe(1);
		const viewport = term.getViewport();
		expect(viewport[viewport.length - 1].trimEnd()).toBe("> input");

		tui.stop();
	});

	it("legacy no-sentinel frames ignore the floor freeze (byte-identical contract)", async () => {
		const term = new VirtualTerminal(60, 20);
		// No ViewportFill child → legacy path, freeze must be inert. The
		// initial frame FITS the viewport (10 + 2 rows on 20), so any
		// physical scroll observed later happened strictly AFTER the freeze —
		// this pins the guard tightly (gpt-5.5 round-3 finding 2).
		const chat = new MutableContent(lines("chat", 10));
		const tui = new TUI(unknownViewportTerminal(term));
		tui.addChild(chat);
		tui.addChild(new ComposerStub());
		tui.start();
		await flushRender(term);
		expect(term.getViewportY()).toBe(0);
		tui.setOverflowFloorFrozen(true);

		// Tail growth past the screen bottom: legacy behavior physically
		// scrolls — the previous rows must enter the scrollback instead of
		// being repaint-swallowed by the (pin-model-only) freeze.
		chat.setLines(lines("chat", 45));
		tui.requestRender();
		await flushRender(term);

		const buffer = term.getScrollBuffer().map(l => l.trimEnd());
		const viewportY = term.getViewportY();
		expect(viewportY).toBeGreaterThan(0);
		expect(buffer.slice(0, viewportY)).toContain("chat-0");
		expect(buffer.filter(l => l === "chat-44").length).toBe(1);

		tui.stop();
	});

	it("realignOverflowedFrame is a strict no-op when preconditions fail", async () => {
		const term = new VirtualTerminal(60, 20);
		const chat = new MutableContent(lines("chat", 10));
		const tui = new TUI(unknownViewportTerminal(term));
		tui.addChild(new ViewportFill());
		tui.addChild(chat);
		tui.addChild(new ComposerStub());
		tui.start();
		await flushRender(term);
		term.clearWriteLog();

		// Not overflowed → refuse.
		expect(tui.realignOverflowedFrame(2)).toBe(false);
		// Invalid cluster measurement → refuse.
		expect(tui.realignOverflowedFrame(-1)).toBe(false);
		expect(tui.realignOverflowedFrame(Number.NaN)).toBe(false);
		expect(term.getWriteLog()).toEqual([]);

		tui.stop();
	});
});

describe("realign v3 committed-bottom (260703)", () => {
	/**
	 * Shared setup: turn end with 30 content rows + 6 trailing tombstone/spacing
	 * blanks (post ctrl+o collapse shape), composer cluster of 2 rows, 60x20
	 * terminal. The frame overflows (38 > 20), so the boundary realign parks the
	 * visible tail (12 content rows) at the screen top with a 6-row gap below.
	 */
	async function parkedBlockSetup() {
		const term = new VirtualTerminal(60, 20);
		const chat = new MutableContent([...lines("chat", 30), "", "", "", "", "", ""]);
		const tui = new TUI(unknownViewportTerminal(term));
		tui.addChild(new ViewportFill());
		tui.addChild(chat);
		tui.addChild(new ComposerStub());
		tui.start();
		await flushRender(term);
		expect(tui.realignOverflowedFrame(2)).toBe(true);
		return { term, chat, tui };
	}

	function blanksBetween(buffer: string[], lastOld: string, firstNew: string): number {
		const from = buffer.lastIndexOf(lastOld);
		const to = buffer.indexOf(firstNew);
		expect(from).toBeGreaterThan(-1);
		if (to === -1) return buffer.slice(from + 1).filter(l => l === "").length;
		return buffer.slice(from + 1, to).filter(l => l === "").length;
	}

	it("growth over a trailing-blank gap stamps no blank band into the scrollback", async () => {
		const { term, chat, tui } = await parkedBlockSetup();

		// New turn grows frame by frame, like streamed output.
		const growth = ["user-msg-1"];
		chat.setLines([...growth]);
		tui.requestRender();
		await flushRender(term);
		for (let i = 0; i < 25; i++) {
			growth.push(`new-${i}`);
			chat.setLines([...growth]);
			tui.requestRender();
			await flushRender(term);
		}

		// getScrollBuffer returns the WHOLE xterm buffer (scrollback + viewport).
		const buffer = term.getScrollBuffer().map(l => l.trimEnd());
		expect(blanksBetween(buffer, "chat-29", "user-msg-1")).toBeLessThanOrEqual(1);
		expect(duplicatedMarkers(buffer, ["chat", "new", "user-msg"])).toEqual([]);
		// Nothing lost: the parked tail and the whole new turn survive in order.
		expect(buffer.filter(l => l === "chat-29").length).toBe(1);
		expect(buffer.filter(l => l === "new-24").length).toBe(1);
		expect(buffer.indexOf("user-msg-1")).toBeGreaterThan(buffer.lastIndexOf("chat-29"));

		tui.stop();
	});

	it("consumes the on-screen gap once growth reaches the parked block", async () => {
		const { term, chat, tui } = await parkedBlockSetup();

		// Grow the live content past the 6-row gap (fill drops below the block
		// bottom), then check the viewport: new content sits directly below the
		// remaining block rows — no interior blank band.
		const content = ["user-msg-1", ...lines("new", 10)];
		chat.setLines(content);
		tui.requestRender();
		await flushRender(term);

		const viewport = term.getViewport().map(l => l.trimEnd());
		const lastBlock = viewport.lastIndexOf("chat-29");
		const msg = viewport.indexOf("user-msg-1");
		expect(msg).toBeGreaterThan(-1);
		if (lastBlock !== -1) {
			expect(viewport.slice(lastBlock + 1, msg).filter(l => l === "")).toEqual([]);
		}

		tui.stop();
	});

	it("forced clearing render after realign flushes content only", async () => {
		const { term, chat, tui } = await parkedBlockSetup();

		// ctrl+o-collapse shape: a fitting frame plus a forced rebuild right
		// after the boundary. The parked block must reach the scrollback intact
		// with no blank band, not be flushed as prevFill(=gap-sized) rows.
		chat.setLines(["user-msg-1"]);
		tui.requestRender(true, "test forced clear");
		await flushRender(term);

		// getScrollBuffer returns the WHOLE xterm buffer (scrollback + viewport).
		const buffer = term.getScrollBuffer().map(l => l.trimEnd());
		// The stamped HISTORY (rows above the viewport) must end at chat-29 with
		// no blank band; the fresh frame's on-screen fill prefix is not history.
		const history = buffer.slice(0, term.getViewportY());
		const lastContent = history.lastIndexOf("chat-29");
		expect(lastContent).toBeGreaterThan(-1);
		expect(history.slice(lastContent + 1).filter(l => l === "").length).toBeLessThanOrEqual(1);
		expect(duplicatedMarkers(buffer, ["chat"])).toEqual([]);
		expect(buffer.filter(l => l === "chat-29").length).toBe(1);
		expect(buffer.filter(l => l === "chat-18").length).toBe(1);

		tui.stop();
	});

	it("post-realign viewportRepaint flushes the block instead of wiping it", async () => {
		const { term, chat, tui } = await parkedBlockSetup();

		// Overflow the frame again, then force a render: fullRender downgrades
		// to viewportRepaint (committed history forbids the clearing replay).
		// The parked block must survive into the scrollback, exactly once.
		chat.setLines(lines("new", 40));
		tui.requestRender(true, "test forced overflow");
		await flushRender(term);

		// getScrollBuffer returns the WHOLE xterm buffer (scrollback + viewport).
		const buffer = term.getScrollBuffer().map(l => l.trimEnd());
		expect(buffer.filter(l => l === "chat-29").length).toBe(1);
		expect(buffer.filter(l => l === "chat-18").length).toBe(1);
		expect(duplicatedMarkers(buffer, ["chat"])).toEqual([]);

		tui.stop();
	});

	it("overlay after realign flushes the block instead of painting over it", async () => {
		const { term, chat, tui } = await parkedBlockSetup();

		chat.setLines(["user-msg-1"]);
		const handle = tui.showOverlay(new MutableContent(lines("overlay", 5)), { anchor: "center" });
		tui.requestRender();
		await flushRender(term);
		handle.hide();
		tui.requestRender();
		await flushRender(term);

		// getScrollBuffer returns the WHOLE xterm buffer (scrollback + viewport).
		const buffer = term.getScrollBuffer().map(l => l.trimEnd());
		expect(buffer.filter(l => l === "chat-29").length).toBe(1);
		expect(buffer.filter(l => l === "chat-18").length).toBe(1);
		expect(duplicatedMarkers(buffer, ["chat"])).toEqual([]);

		tui.stop();
	});
});
