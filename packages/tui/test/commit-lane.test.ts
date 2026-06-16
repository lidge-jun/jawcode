import { describe, expect, it } from "bun:test";
import { type Component, TUI, ViewportFill } from "@gajae-code/tui";
import { VirtualTerminal } from "./virtual-terminal";

/**
 * TUI commit lane integration (devlog 083.9 P2-a): commitLines() writes
 * finalized lines above the live zone (fill region = history region), the
 * committed pixels survive live-zone growth via the pre-paint scroll-out
 * rule (§3b-3), and clearing renders flush them into scrollback first.
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

function setup(rows: number, contentLines: string[]): { term: VirtualTerminal; content: MutableContent; tui: TUI } {
	const term = new VirtualTerminal(40, rows);
	const content = new MutableContent(contentLines);
	const tui = new TUI(term);
	tui.addChild(new ViewportFill());
	tui.addChild(content);
	tui.addChild(new ComposerStub());
	tui.start();
	return { term, content, tui };
}

describe("TUI commit lane (083.9 P2-a)", () => {
	it("commitLines writes into the fill region and reports success", async () => {
		const { term, tui } = setup(12, lines("live", 2));
		await flushRender(term);

		expect(tui.commitLines(["committed-0", "committed-1"])).toBe(true);
		await term.flush();

		const viewport = term.getViewport();
		// Fill region = rows 0..7 (12 - 2 content - 2 composer). The committed
		// block sits at the fill bottom, directly above the live content.
		expect(viewport[6]).toBe("committed-0");
		expect(viewport[7]).toBe("committed-1");
		expect(viewport[8]).toBe("live-0");
		expect(viewport[11]).toBe("> input");
		tui.stop();
	});

	it("committed pixels survive live-zone growth (pre-paint scroll-out)", async () => {
		const { term, content, tui } = setup(12, lines("live", 2));
		await flushRender(term);
		expect(tui.commitLines(["committed-0", "committed-1"])).toBe(true);
		await term.flush();

		// Live zone grows by 4 rows → fill shrinks 8 → 4. Without the scroll-out
		// rule the diff would paint live content over the committed pixels.
		content.setLines(lines("live", 6));
		tui.requestRender();
		await flushRender(term);

		const viewport = term.getViewport();
		expect(viewport[2]).toBe("committed-0"); // landed at the new fill bottom
		expect(viewport[3]).toBe("committed-1");
		expect(viewport[4]).toBe("live-0");
		expect(viewport[11]).toBe("> input");
		tui.stop();
	});

	it("growth past the committed block pushes it into the scrollback in order", async () => {
		const { term, content, tui } = setup(10, lines("live", 2));
		await flushRender(term);
		expect(tui.commitLines(["c-0", "c-1", "c-2"])).toBe(true);
		await term.flush();

		// Live zone takes (almost) the whole screen — fill 6 → 1.
		content.setLines(lines("live", 7));
		tui.requestRender();
		await flushRender(term);

		const all = [...term.getScrollBuffer(), ...term.getViewport()];
		const i0 = all.indexOf("c-0");
		const i1 = all.indexOf("c-1");
		const i2 = all.indexOf("c-2");
		expect(i0).toBeGreaterThanOrEqual(0);
		expect(i1).toBeGreaterThan(i0);
		expect(i2).toBeGreaterThan(i1);
		// Live zone intact below.
		expect(term.getViewport()[term.getViewport().length - 1]).toBe("> input");
		tui.stop();
	});

	it("a clearing full render flushes committed pixels into scrollback first", async () => {
		const { term, tui } = setup(12, lines("live", 2));
		await flushRender(term);
		expect(tui.commitLines(["precious-0", "precious-1"])).toBe(true);
		await term.flush();

		tui.requestRender(true); // forced clear (2J/3J) — e.g. /redraw
		await flushRender(term);

		// The committed lines crossed into scrollback before the clear.
		const scrollback = term.getScrollBuffer();
		expect(scrollback).toContain("precious-0");
		expect(scrollback).toContain("precious-1");
		expect(term.getViewport()[11]).toBe("> input");
		tui.stop();
	});

	it("committed lines survive a terminal width change (resize flush, 083.10 §3)", async () => {
		const { term, tui } = setup(12, lines("live", 2));
		await flushRender(term);
		expect(tui.commitLines(["resize-safe-0", "resize-safe-1"])).toBe(true);
		await term.flush();

		term.resize(50, 12); // width change → clearing full render path
		await flushRender(term);

		// The flush-before-clear rule pushed the committed pixels into the
		// scrollback, and the 3J ban keeps the scrollback alive afterwards.
		const all = [...term.getScrollBuffer(), ...term.getViewport()];
		expect(all).toContain("resize-safe-0");
		expect(all).toContain("resize-safe-1");
		expect(term.getViewport()[11]).toBe("> input");
		tui.stop();
	});

	it("returns false when the live zone owns the whole screen (caller falls back)", async () => {
		const { term, tui } = setup(8, lines("live", 20)); // overflow: no fill
		await flushRender(term);
		expect(tui.commitLines(["x"])).toBe(false);
		tui.stop();
	});
});
