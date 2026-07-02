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
