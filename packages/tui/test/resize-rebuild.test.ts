import { describe, expect, it } from "bun:test";
import { type Component, TUI, ViewportFill } from "@jawcode-dev/tui";
import { VirtualTerminal } from "./virtual-terminal";

/**
 * 260704 RESIZE REBUILD — replayTranscript replaces the ENTIRE terminal
 * contents (screen + scrollback) with the transcript re-rendered at the
 * current width; a full replace cannot duplicate, and it heals hard-wrapped
 * committed rows after width changes. The next render appends the live
 * frame directly below the replayed tail.
 */

async function flushRender(term: VirtualTerminal): Promise<void> {
	await new Promise<void>(resolve => process.nextTick(resolve));
	await Bun.sleep(17);
	await term.flush();
}

describe("resize transcript rebuild (260704)", () => {
	it("replayTranscript fully replaces history and the live frame appends below", async () => {
		const term = new VirtualTerminal(40, 12);
		const live: Component & { committed?: boolean } = {
			invalidate() {},
			render: () => ["live-0", "live-1"],
		};
		const tui = new TUI(term);
		tui.addChild(live);
		tui.addChild(new ViewportFill());
		tui.addChild({ invalidate() {}, render: () => ["> input"] });
		tui.start();
		await flushRender(term);
		// Seed some old (would-be mangled) history.
		expect(tui.commitLines(["old-wrapped-a", "old-wrapped-b"])).toBe(true);
		await term.flush();

		tui.replayTranscript(["rewrapped-a", "rewrapped-b", "rewrapped-c"]);
		await flushRender(term);

		const buffer = term.getScrollBuffer();
		// The pre-rebuild copies are GONE (full replace, no duplication)…
		expect(buffer.filter(l => l.startsWith("old-wrapped")).length).toBe(0);
		// …the rebuilt transcript is present exactly once, in order…
		const iA = buffer.indexOf("rewrapped-a");
		expect(iA).toBeGreaterThanOrEqual(0);
		expect(buffer.indexOf("rewrapped-b")).toBe(iA + 1);
		expect(buffer.indexOf("rewrapped-c")).toBe(iA + 2);
		// …and the live frame renders below the replayed tail.
		expect(buffer.indexOf("live-0")).toBeGreaterThan(iA + 2);
		expect(term.getViewport().at(-1)).toBe("> input");
		tui.stop();
	});

	it("onResizeSettled fires once after a width-change storm settles", async () => {
		const term = new VirtualTerminal(40, 12);
		const tui = new TUI(term);
		tui.addChild({ invalidate() {}, render: () => ["content"] });
		tui.addChild(new ViewportFill());
		tui.addChild({ invalidate() {}, render: () => ["> input"] });
		let fired = 0;
		tui.onResizeSettled = () => {
			fired++;
		};
		tui.start();
		await flushRender(term);

		term.resize(35, 12);
		await flushRender(term);
		term.resize(30, 12);
		await flushRender(term);
		expect(fired).toBe(0); // still inside the settle window
		await Bun.sleep(300);
		expect(fired).toBe(1);
		tui.stop();
	});
});

describe("bottom-anchored rebuild (260704 user UX round 3)", () => {
	it("keeps the tail visible above the floor cluster; older rows in scrollback once", async () => {
		const term = new VirtualTerminal(40, 12);
		const tui = new TUI(term);
		tui.addChild(new ViewportFill());
		tui.addChild({ invalidate() {}, render: () => ["◐ spinner", "> input"] });
		tui.start();
		await new Promise<void>(resolve => process.nextTick(resolve));
		await Bun.sleep(17);
		await term.flush();

		const transcript = Array.from({ length: 20 }, (_, i) => `t-${i}`);
		tui.replayTranscript(transcript, { clusterRows: 2 });
		await new Promise<void>(resolve => process.nextTick(resolve));
		await Bun.sleep(17);
		await term.flush();

		// Viewport: last 10 transcript rows at the top, cluster on the floor.
		const viewport = term.getViewport();
		expect(viewport.slice(0, 10)).toEqual(transcript.slice(10));
		expect(viewport.slice(10)).toEqual(["◐ spinner", "> input"]);
		// Scrollback: the earlier rows, exactly once, in order.
		const buffer = term.getScrollBuffer();
		const i0 = buffer.indexOf("t-0");
		expect(i0).toBeGreaterThanOrEqual(0);
		for (let i = 0; i < 20; i++) {
			expect(buffer.indexOf(`t-${i}`)).toBe(i0 + i);
			expect(buffer.filter(l => l === `t-${i}`).length).toBe(1);
		}
		tui.stop();
	});

	it("short transcript: tail fully visible, no scrollback, cluster on the floor", async () => {
		const term = new VirtualTerminal(40, 12);
		const tui = new TUI(term);
		tui.addChild(new ViewportFill());
		tui.addChild({ invalidate() {}, render: () => ["> input"] });
		tui.start();
		await new Promise<void>(resolve => process.nextTick(resolve));
		await Bun.sleep(17);
		await term.flush();

		tui.replayTranscript(["a", "b", "c"], { clusterRows: 1 });
		await new Promise<void>(resolve => process.nextTick(resolve));
		await Bun.sleep(17);
		await term.flush();

		const viewport = term.getViewport();
		expect(viewport.slice(0, 3)).toEqual(["a", "b", "c"]);
		expect(viewport.at(-1)).toBe("> input");
		expect(term.getScrollBuffer().length).toBe(12); // no scrollback rows
		tui.stop();
	});
});
