import { describe, expect, it } from "bun:test";
import { type Component, TUI, ViewportFill } from "@jawcode-dev/tui";
import { VirtualTerminal } from "./virtual-terminal";

/**
 * 260703 WP3a — scroll-out repaint barrier. A DECSTBM scroll-out inside
 * #doRender (live-zone growth / overlay flush) shifts physical rows and
 * restores the cursor to a CLAMPED screen row while the relative diff lanes
 * still compute moves from the unclamped captured locals against unrotated
 * mirrors. The barrier finishes every such pass with the absolute viewport
 * repaint. Plan: devlog/_plan/260703_tui_resize_stability/30_wp3a.
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

describe("scroll-out repaint barrier (260703 WP3a)", () => {
	it("a growth pass that scrolls the committed block finishes absolute, not relative", async () => {
		const { term, content, tui } = setup(12, lines("live", 2));
		await flushRender(term);
		expect(tui.commitLines(["committed-0", "committed-1"])).toBe(true);
		await term.flush();
		term.clearWriteLog();

		// Live-zone growth shrinks the fill → the pre-paint scroll-out fires.
		content.setLines(lines("live", 6));
		tui.requestRender();
		await flushRender(term);

		const writes = term.getWriteLog().join("");
		// The scroll-out itself (DECSTBM region) must still have happened…
		expect(writes).toContain("\x1b[1;");
		// …and the pass must have ended in an absolute repaint of the live
		// zone (absolute CUP to the zone top), never in a relative cursor walk
		// over the shifted rows.
		expect(writes).toMatch(/\x1b\[\d+;1H\x1b\[2K/);

		// Physical outcome unchanged from the pre-barrier contract: committed
		// pixels land at the new fill bottom, live content below.
		const viewport = term.getViewport();
		expect(viewport[2]).toBe("committed-0");
		expect(viewport[3]).toBe("committed-1");
		expect(viewport[4]).toBe("live-0");
		expect(viewport[11]).toBe("> input");
		tui.stop();
	});

	it("no logical row is duplicated across scrollback+viewport by growth scroll-outs", async () => {
		const { term, content, tui } = setup(10, lines("live", 2));
		await flushRender(term);
		expect(tui.commitLines(["c-0", "c-1", "c-2"])).toBe(true);
		await term.flush();

		// Stream growth in steps so several scroll-out passes fire.
		for (let n = 3; n <= 7; n++) {
			content.setLines(lines("live", n));
			tui.requestRender();
			await flushRender(term);
		}

		// getScrollBuffer() is the ENTIRE physical buffer (scrollback rows plus
		// the live viewport) — the uniqueness domain for duplication checks.
		const all = term.getScrollBuffer().filter(l => l.trim() !== "");
		for (const marker of ["c-0", "c-1", "c-2", "live-0", "live-6", "> input"]) {
			const count = all.filter(l => l === marker).length;
			expect(`${marker}:${count}`).toBe(`${marker}:1`);
		}
		// Committed rows kept their order.
		const i0 = all.indexOf("c-0");
		expect(all.indexOf("c-1")).toBe(i0 + 1);
		expect(all.indexOf("c-2")).toBe(i0 + 2);
		tui.stop();
	});

	it("a subsequent pass without a scroll-out returns to the diff path", async () => {
		const { term, content, tui } = setup(12, lines("live", 2));
		await flushRender(term);
		expect(tui.commitLines(["committed-0"])).toBe(true);
		await term.flush();

		// Growth pass → barrier (absolute).
		content.setLines(lines("live", 4));
		tui.requestRender();
		await flushRender(term);

		// Same-height content change → no fill shrink, no scroll-out: the
		// cheap relative diff must be back (no ESC[H absolute home).
		term.clearWriteLog();
		content.setLines([...lines("live", 3), "live-3-changed"]);
		tui.requestRender();
		await flushRender(term);

		const writes = term.getWriteLog().join("");
		expect(writes.includes("\x1b[H")).toBe(false);
		expect(term.getViewport().some(l => l === "live-3-changed")).toBe(true);
		tui.stop();
	});
});
