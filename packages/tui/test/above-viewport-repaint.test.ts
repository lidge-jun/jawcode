import { describe, expect, it } from "bun:test";
import { type Component, type Terminal, TUI, ViewportFill } from "@gajae-code/tui";
import { VirtualTerminal } from "./virtual-terminal";

/**
 * Above-viewport changes must never wipe the terminal (devlog 083.8 S3).
 *
 * The reported bug: a trailing thinking block streams expanded, then collapses
 * to a one-line summary at message_end. The collapse starts above the viewport
 * top, which used to route to fullRender(clear=true) — \x1b[2J\x1b[H\x1b[3J —
 * erasing the scrollback and repainting, perceived as the screen being "sucked
 * upward" right before the final response. The fix repaints only the visible
 * viewport (viewportRepaint) and leaves scrollback pixels alone.
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

describe("above-viewport shrink repaint (083.8 S3)", () => {
	it("collapsing a block above the viewport emits no 2J/3J and keeps scrollback", async () => {
		const term = new VirtualTerminal(60, 20);
		// Frame: [thinking ×40][answer tail ×10][composer] — overflows a 20-row
		// terminal, so the thinking block's head is far above the viewport top.
		const thinking = new MutableContent(lines("thinking", 40));
		const tail = new MutableContent(lines("answer", 10));
		const tui = new TUI(term);
		tui.addChild(new ViewportFill());
		tui.addChild(thinking);
		tui.addChild(tail);
		tui.addChild(new ComposerStub());
		tui.start();
		await flushRender(term);

		expect(term.getScrollBuffer()).toContain("thinking-0");
		term.clearWriteLog();

		// message_end: the trailing thinking block settles into its one-line
		// summary — a change whose first differing row is above the viewport.
		thinking.setLines(["Thinking … +40 lines"]);
		tui.requestRender();
		await flushRender(term);

		const writes = term.getWriteLog().join("");
		expect(writes.includes("\x1b[2J")).toBe(false);
		expect(writes.includes("\x1b[3J")).toBe(false);
		// Scrollback above the viewport is left alone — history survives.
		expect(term.getScrollBuffer()).toContain("thinking-0");
		// The visible viewport shows the collapsed transcript tail, composer on floor.
		const viewport = term.getViewport();
		expect(viewport.some(line => line.startsWith("answer-9"))).toBe(true);
		expect(viewport[viewport.length - 1]).toBe("> input");

		tui.stop();
	});

	it("a shrink larger than the terminal height also avoids 2J/3J", async () => {
		const term = new VirtualTerminal(60, 20);
		const content = new MutableContent(lines("bulk", 80));
		const tui = new TUI(term);
		tui.addChild(new ViewportFill());
		tui.addChild(content);
		tui.addChild(new ComposerStub());
		tui.start();
		await flushRender(term);
		term.clearWriteLog();

		// Collapse 80 rows to 3 — extraLines (77) far exceeds height (20).
		content.setLines(lines("bulk", 3));
		tui.requestRender();
		await flushRender(term);

		const writes = term.getWriteLog().join("");
		expect(writes.includes("\x1b[2J")).toBe(false);
		expect(writes.includes("\x1b[3J")).toBe(false);
		expect(term.getViewport()[term.getViewport().length - 1]).toBe("> input");

		tui.stop();
	});

	it("offscreen change plus growth appends tail without replaying full transcript", async () => {
		const term = new VirtualTerminal(60, 20);
		const thinking = new MutableContent(lines("thinking", 40));
		const tail = new MutableContent(lines("answer", 10));
		const tui = new TUI(term);
		tui.addChild(new ViewportFill());
		tui.addChild(thinking);
		tui.addChild(tail);
		tui.addChild(new ComposerStub());
		tui.start();
		await flushRender(term);

		expect(term.getScrollBuffer()).toContain("thinking-0");
		term.clearWriteLog();

		thinking.setLines(["thinking-updated", ...lines("thinking", 39).slice(1)]);
		tail.setLines([...lines("answer", 10), "answer-10", "answer-11"]);
		tui.requestRender();
		await flushRender(term);

		const writes = term.getWriteLog().join("");
		expect(writes.includes("\x1b[2J")).toBe(false);
		expect(writes.includes("\x1b[3J")).toBe(false);
		expect(writes).toContain("\x1b[20;1H");
		expect(writes).toContain("answer-10");
		expect(writes).toContain("answer-11");
		expect(writes).not.toContain("thinking-0");
		expect(writes).not.toContain("thinking-1");
		expect(term.getScrollBuffer()).toContain("thinking-0");
		expect(term.getViewport()[term.getViewport().length - 1]).toBe("> input");

		tui.stop();
	});

	it("known off-bottom viewport skips growth append and avoids full transcript replay", async () => {
		const term = new VirtualTerminal(60, 20);
		const thinking = new MutableContent(lines("thinking", 40));
		const tail = new MutableContent(lines("answer", 10));
		const tui = new TUI(term);
		tui.addChild(new ViewportFill());
		tui.addChild(thinking);
		tui.addChild(tail);
		tui.addChild(new ComposerStub());
		tui.start();
		await flushRender(term);

		const bottomY = term.getViewportY();
		expect(term.isViewportAtBottom()).toBe(true);
		term.scrollViewportUp(5);
		expect(term.getViewportY()).toBeLessThan(bottomY);
		expect(term.isViewportAtBottom()).toBe(false);
		term.clearWriteLog();

		thinking.setLines(["thinking-updated", ...lines("thinking", 39).slice(1)]);
		tail.setLines([...lines("answer", 10), "answer-10", "answer-11"]);
		tui.requestRender();
		await flushRender(term);

		const writes = term.getWriteLog().join("");
		expect(writes.includes("\x1b[2J")).toBe(false);
		expect(writes.includes("\x1b[3J")).toBe(false);
		expect(writes).not.toContain("\x1b[20;1H");
		expect(writes).toContain("answer-10");
		expect(writes).toContain("answer-11");
		expect(writes).not.toContain("thinking-0");
		expect(writes).not.toContain("thinking-1");
		expect(term.isViewportAtBottom()).toBe(false);

		tui.stop();
	});

	it("unknown viewport state skips growth append and avoids duplicate replay", async () => {
		const term = new VirtualTerminal(60, 20);
		const thinking = new MutableContent(lines("thinking", 40));
		const tail = new MutableContent(lines("answer", 10));
		const tui = new TUI(unknownViewportTerminal(term));
		tui.addChild(new ViewportFill());
		tui.addChild(thinking);
		tui.addChild(tail);
		tui.addChild(new ComposerStub());
		tui.start();
		await flushRender(term);

		expect(term.getScrollBuffer()).toContain("thinking-0");
		term.clearWriteLog();

		thinking.setLines(["thinking-updated", ...lines("thinking", 39).slice(1)]);
		tail.setLines([...lines("answer", 10), "answer-10", "answer-11"]);
		tui.requestRender();
		await flushRender(term);

		const writes = term.getWriteLog().join("");
		expect(writes.includes("\x1b[2J")).toBe(false);
		expect(writes.includes("\x1b[3J")).toBe(false);
		expect(writes).not.toContain("\x1b[20;1H");
		expect(writes).toContain("answer-10");
		expect(writes).toContain("answer-11");
		expect(writes).not.toContain("thinking-0");
		expect(writes).not.toContain("thinking-1");
		expect(term.getScrollBuffer()).toContain("thinking-0");
		expect(term.getViewport()[term.getViewport().length - 1]).toBe("> input");

		tui.stop();
	});

	it("compactViewportFill still performs a deliberate full rebuild (scrollback reconcile)", async () => {
		const term = new VirtualTerminal(60, 20);
		const content = new MutableContent(lines("chat", 40));
		const tui = new TUI(term);
		tui.addChild(new ViewportFill());
		tui.addChild(content);
		tui.addChild(new ComposerStub());
		tui.start();
		await flushRender(term);

		// Shrink while overflowing → sticky gap accrues (083.7 §9/§12).
		content.setLines(lines("chat", 25));
		tui.requestRender();
		await flushRender(term);
		term.clearWriteLog();

		// The compact (now fired at prompt submit, 083.8 S2) is the one place a
		// full clear is intended: it rewrites the whole logical transcript so
		// scrollback and #previousLines reconcile.
		tui.compactViewportFill();
		await flushRender(term);

		const writes = term.getWriteLog().join("");
		expect(writes.includes("\x1b[2J")).toBe(true);
		expect(term.getViewport()[term.getViewport().length - 1]).toBe("> input");

		tui.stop();
	});
});
