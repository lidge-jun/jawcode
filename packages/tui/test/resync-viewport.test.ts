import { describe, expect, it } from "bun:test";
import { type Component, TUI, ViewportFill } from "@jawcode-dev/tui";
import { VirtualTerminal } from "./virtual-terminal";

/**
 * 260703 WP1 — resyncViewport(): one-shot absolute viewport repaint that
 * re-synchronizes the physical screen with the renderer's row bookkeeping
 * after drift the diff path cannot detect (stale-width writes during a
 * resize race, terminal reflow, autowrap-inserted rows), plus the
 * resize-settle trigger that fires it automatically after a resize storm.
 * Plan: devlog/_plan/260703_tui_resize_stability/10_wp1_resync_viewport.md
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

describe("resyncViewport (260703 WP1)", () => {
	it("restores a viewport corrupted outside the renderer's knowledge", async () => {
		const term = new VirtualTerminal(60, 20);
		const content = new MutableContent(lines("row", 8));
		const tui = new TUI(term);
		tui.addChild(new ViewportFill());
		tui.addChild(content);
		tui.addChild(new ComposerStub());
		tui.start();
		await flushRender(term);

		// Corrupt the physical screen behind the renderer's back — the mirror
		// (#previousLines) still believes the old pixels are on screen, so a
		// plain diff render would never repaint these rows.
		term.write("\x1b[s\x1b[12;1HGARBAGE-A\x1b[13;1HGARBAGE-B\x1b[u");
		await term.flush();
		expect(term.getViewport().some(line => line.startsWith("GARBAGE-A"))).toBe(true);

		tui.resyncViewport();
		await flushRender(term);

		const viewport = term.getViewport();
		expect(viewport.some(line => line.includes("GARBAGE"))).toBe(false);
		expect(viewport.some(line => line.startsWith("row-7"))).toBe(true);
		expect(viewport[viewport.length - 1]).toBe("> input");

		tui.stop();
	});

	it("is one-shot: the following content render takes the diff path again", async () => {
		const term = new VirtualTerminal(60, 20);
		const content = new MutableContent(lines("row", 8));
		const tui = new TUI(term);
		tui.addChild(new ViewportFill());
		tui.addChild(content);
		tui.addChild(new ComposerStub());
		tui.start();
		await flushRender(term);

		tui.resyncViewport();
		await flushRender(term);
		term.clearWriteLog();

		content.setLines([...lines("row", 8), "appended"]);
		tui.requestRender();
		await flushRender(term);

		// Absolute repaints home the cursor with ESC[H; the diff path only
		// moves relatively. A second absolute repaint here would mean the
		// resync request leaked past its render.
		const writes = term.getWriteLog().join("");
		expect(writes.includes("\x1b[H")).toBe(false);
		expect(term.getViewport().some(line => line.startsWith("appended"))).toBe(true);

		tui.stop();
	});

	it("flip-back resize (A→B→A inside one render window) triggers an absolute resync", async () => {
		const term = new VirtualTerminal(60, 20);
		const content = new MutableContent(lines("row", 8));
		const tui = new TUI(term);
		tui.addChild(new ViewportFill());
		tui.addChild(content);
		tui.addChild(new ComposerStub());
		tui.start();
		await flushRender(term);

		const redrawsBefore = tui.fullRedraws;
		// Both resize events land before any render runs: the second returns to
		// the original dimensions, so widthChanged never trips — yet the real
		// terminal reflowed twice and may have moved the cursor. The flip-back
		// detection must route the next render through the absolute repaint.
		term.resize(50, 20);
		term.resize(60, 20);
		await flushRender(term);

		expect(tui.fullRedraws).toBeGreaterThan(redrawsBefore);
		const viewport = term.getViewport();
		expect(viewport.some(line => line.startsWith("row-0"))).toBe(true);
		expect(viewport[viewport.length - 1]).toBe("> input");

		tui.stop();
	});

	it("legacy short frame without a fill sentinel downgrades to the diff path", async () => {
		const term = new VirtualTerminal(60, 20);
		const content = new MutableContent(lines("legacy", 3));
		const tui = new TUI(term);
		tui.addChild(content);
		tui.start();
		await flushRender(term);
		term.clearWriteLog();

		// A 3-row no-sentinel frame may not be anchored at screen row 1, so an
		// ESC[H absolute repaint could stamp rows over shell history above the
		// app — the guard must drop the request instead.
		tui.resyncViewport();
		await flushRender(term);

		const writes = term.getWriteLog().join("");
		expect(writes.includes("\x1b[H")).toBe(false);
		expect(writes.includes("\x1b[2K")).toBe(false);

		tui.stop();
	});
});
