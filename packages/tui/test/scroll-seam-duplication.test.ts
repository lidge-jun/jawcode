import { describe, expect, it } from "bun:test";
import { type Component, type Terminal, TUI, ViewportFill } from "@jawcode-dev/tui";
import { VirtualTerminal } from "./virtual-terminal";

/**
 * REPRO — scrollback/viewport seam duplication (260630).
 *
 * User-observed: while a response streams and the frame overflows the
 * viewport, expanding then collapsing current-turn output (ctrl+o, or the
 * automatic thinking-block collapse at message_end) makes the rows at the
 * viewport top ALSO appear directly above the viewport when scrolling up.
 *
 * Hypothesis: the sticky gap (083.7 §10/§12) inserts the shrink residue at
 * the frame TOP (the ViewportFill sentinel). That shifts every content row
 * DOWN by K in frame coordinates. viewportRepaint then paints frame rows
 * [len-h, len) — whose top K rows are content that was already physically
 * scrolled out — duplicating them at the screen top.
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

describe("scroll seam duplication repro (260630)", () => {
	it("collapsing an expanded block while overflowed must not duplicate scrolled-out rows at the viewport top", async () => {
		const term = new VirtualTerminal(60, 20);
		// Frame: [fill sentinel][chat ×40][expanded tool ×12][composer ×2] = 54
		// rows on a 20-row terminal → rows 0..33 are physically in scrollback.
		const chat = new MutableContent(lines("chat", 40));
		const tool = new MutableContent(lines("tool", 12));
		const tui = new TUI(unknownViewportTerminal(term));
		tui.addChild(new ViewportFill());
		tui.addChild(chat);
		tui.addChild(tool);
		tui.addChild(new ComposerStub());
		tui.start();
		await flushRender(term);

		expect(term.getScrollBuffer()).toContain("chat-0");
		expect(duplicatedMarkers(term.getScrollBuffer(), ["chat", "tool"])).toEqual([]);
		term.clearWriteLog();

		// ctrl+o collapse (or thinking settle at message_end): the expanded tool
		// block shrinks 12 → 1 while the frame overflows the viewport.
		tool.setLines(["tool … +12 lines"]);
		tui.requestRender();
		await flushRender(term);

		// The physical buffer (scrollback + screen) must not contain any content
		// row twice: the viewport top must continue the scrollback seamlessly.
		const dups = duplicatedMarkers(term.getScrollBuffer(), ["chat", "tool"]);
		expect(dups).toEqual([]);

		// And the row directly above the visible viewport must not equal the
		// viewport's own top row (the user's exact symptom while scrolling up).
		const viewportY = term.getViewportY();
		const buffer = term.getScrollBuffer();
		if (viewportY > 0) {
			expect(buffer[viewportY - 1].trimEnd()).not.toBe(buffer[viewportY].trimEnd());
		}

		// Floor stays intact.
		const viewport = term.getViewport();
		expect(viewport[viewport.length - 1]).toBe("> input");

		tui.stop();
	});

	it("expand followed by collapse (round trip) must leave the buffer duplicate-free", async () => {
		const term = new VirtualTerminal(60, 20);
		const chat = new MutableContent(lines("chat", 40));
		const tool = new MutableContent(["tool … +12 lines"]);
		const tui = new TUI(unknownViewportTerminal(term));
		tui.addChild(new ViewportFill());
		tui.addChild(chat);
		tui.addChild(tool);
		tui.addChild(new ComposerStub());
		tui.start();
		await flushRender(term);

		// ctrl+o expand: grow 1 → 12.
		tool.setLines(lines("tool", 12));
		tui.requestRender();
		await flushRender(term);

		// ctrl+o collapse: back to the folded summary.
		tool.setLines(["tool … +12 lines"]);
		tui.requestRender();
		await flushRender(term);

		const dups = duplicatedMarkers(term.getScrollBuffer(), ["chat", "tool"]);
		expect(dups).toEqual([]);

		tui.stop();
	});

	it("mid-frame shed with simultaneous tail growth (083.9 P3 streaming) stays duplicate-free", async () => {
		const term = new VirtualTerminal(60, 20);
		// Streaming shape: settled blocks shed from the frame while the active
		// tail keeps growing — a net shrink above/inside the viewport top plus
		// growth at the bottom, every few events during a long response.
		const settled = new MutableContent(lines("settled", 30));
		const tail = new MutableContent(lines("live", 20));
		const tui = new TUI(unknownViewportTerminal(term));
		tui.addChild(new ViewportFill());
		tui.addChild(settled);
		tui.addChild(tail);
		tui.addChild(new ComposerStub());
		tui.start();
		await flushRender(term);

		expect(duplicatedMarkers(term.getScrollBuffer(), ["settled", "live"])).toEqual([]);

		// Shed the settled head (frame forgets it) while the live tail grows.
		settled.setLines([]);
		tail.setLines(lines("live", 24));
		tui.requestRender();
		await flushRender(term);

		expect(duplicatedMarkers(term.getScrollBuffer(), ["settled", "live"])).toEqual([]);

		// Keep streaming: growth must consume the shed tombstones in place.
		tail.setLines(lines("live", 40));
		tui.requestRender();
		await flushRender(term);

		expect(duplicatedMarkers(term.getScrollBuffer(), ["settled", "live"])).toEqual([]);
		const viewport = term.getViewport();
		expect(viewport[viewport.length - 1]).toBe("> input");
		expect(viewport.some(line => line.startsWith("live-39"))).toBe(true);

		tui.stop();
	});

	it("frozen-floor transient expansion (ctrl+o) round trip restores the exact pre-expansion buffer", async () => {
		const term = new VirtualTerminal(60, 20);
		// Production shape: committed history exists (3J forbidden), the frame
		// overflows, and the user expands then collapses the current turn.
		const chat = new MutableContent(lines("chat", 5));
		const tool = new MutableContent(["tool … +30 lines"]);
		const tui = new TUI(term);
		tui.addChild(new ViewportFill());
		tui.addChild(chat);
		tui.addChild(tool);
		tui.addChild(new ComposerStub());
		tui.start();
		await flushRender(term);
		expect(tui.commitLines(["committed-0"])).toBe(true);
		await flushRender(term);

		// The session grows past the viewport (physically materialized).
		chat.setLines(lines("chat", 40));
		tui.requestRender();
		await flushRender(term);
		const before = term.getScrollBuffer();

		// ctrl+o expand: transient — the floor freezes so the expansion never
		// scrolls rows into the scrollback (mirrors setToolsExpanded).
		tui.setOverflowFloorFrozen(true);
		tool.setLines(lines("tool", 30));
		tui.requestRender();
		await flushRender(term);
		expect(term.getViewport().some(line => line.startsWith("tool-29"))).toBe(true);
		expect(duplicatedMarkers(term.getScrollBuffer(), ["chat", "tool"])).toEqual([]);
		// Nothing entered the scrollback during the expansion.
		expect(term.getScrollBuffer().length).toBe(before.length);

		// ctrl+o collapse: unfreeze + forced render (mirrors requestRender(true)).
		tui.setOverflowFloorFrozen(false);
		tool.setLines(["tool … +30 lines"]);
		tui.requestRender(true, "tools collapse");
		await flushRender(term);

		// The screen is restored exactly — no blank residue, no duplication.
		expect(term.getScrollBuffer()).toEqual(before);

		tui.stop();
	});

	it("compactViewportFill after committed history must not replay the frame head into scrollback", async () => {
		const term = new VirtualTerminal(60, 20);
		// Start small so the fill region exists and the commit lane can engage.
		const chat = new MutableContent(lines("chat", 5));
		const tool = new MutableContent([]);
		const tui = new TUI(term);
		tui.addChild(new ViewportFill());
		tui.addChild(chat);
		tui.addChild(tool);
		tui.addChild(new ComposerStub());
		tui.start();
		await flushRender(term);

		// Commit one early cell — scrollback becomes canonical, 3J forbidden.
		expect(tui.commitLines(["committed-0"])).toBe(true);
		await flushRender(term);

		// The session then grows past the viewport and a block collapses,
		// leaving a sticky gap.
		chat.setLines(lines("chat", 40));
		tool.setLines(lines("tool", 12));
		tui.requestRender();
		await flushRender(term);
		tool.setLines(["tool … +12 lines"]);
		tui.requestRender();
		await flushRender(term);

		// Prompt submit fires compactViewportFill → requestRender(true).
		tui.compactViewportFill();
		await flushRender(term);

		const dups = duplicatedMarkers(term.getScrollBuffer(), ["chat", "tool"]);
		expect(dups).toEqual([]);

		tui.stop();
	});
});
