import { describe, expect, it } from "bun:test";
import { type Component, TUI, ViewportFill } from "@jawcode-dev/tui";
import { VirtualTerminal } from "./virtual-terminal";

/**
 * 260704 BOTTOM-UP FLOW — the production frame mounts the fill FIRST: the
 * transcript + live cluster + composer ride the terminal floor as one
 * contiguous block (spinner right above the composer; new content pushes
 * older rows UP). With the sentinel at frame line 0 the S5-2 live-zone
 * flush refuses by design; history goes through the boundary realign lane.
 */

function block(rows: string[]): Component {
	return { render: () => [...rows], invalidate() {} };
}

async function flushRender(term: VirtualTerminal): Promise<void> {
	await new Promise<void>(resolve => process.nextTick(resolve));
	await Bun.sleep(17);
	await term.flush();
}

describe("bottom-up layout (260704 user UX round 3)", () => {
	it("the whole cluster hugs the floor; the only blank run is at the top", async () => {
		const term = new VirtualTerminal(40, 16);
		const tui = new TUI(term);
		tui.addChild(new ViewportFill());
		tui.addChild(block(["banner-0", "banner-1"]));
		tui.addChild(block(["chat-0", "chat-1"]));
		tui.addChild(block(["◐ spinner", "> input"]));
		tui.start();
		await flushRender(term);

		const viewport = term.getViewport();
		expect(viewport.slice(10)).toEqual(["banner-0", "banner-1", "chat-0", "chat-1", "◐ spinner", "> input"]);
		const blanks = viewport.map((l, i) => (l.trim() === "" ? i : -1)).filter(i => i >= 0);
		expect(blanks).toEqual(Array.from({ length: 10 }, (_, i) => i));

		// The live-zone flush lane refuses under fill-first geometry — the
		// boundary realign lane owns history here.
		expect(tui.commitLines(["x"])).toBe(false);
		tui.stop();
	});

	it("growth pushes the cluster upward; spinner stays glued above the composer", async () => {
		const term = new VirtualTerminal(40, 12);
		const chat: Component & { lines: string[] } = {
			lines: ["chat-0"],
			invalidate() {},
			render() {
				return [...this.lines];
			},
		};
		const tui = new TUI(term);
		tui.addChild(new ViewportFill());
		tui.addChild(chat);
		tui.addChild(block(["◐ spinner", "> input"]));
		tui.start();
		await flushRender(term);
		expect(term.getViewport().slice(9)).toEqual(["chat-0", "◐ spinner", "> input"]);

		chat.lines = ["chat-0", "chat-1", "chat-2", "chat-3"];
		tui.requestRender();
		await flushRender(term);

		const viewport = term.getViewport();
		expect(viewport.slice(6)).toEqual(["chat-0", "chat-1", "chat-2", "chat-3", "◐ spinner", "> input"]);
		tui.stop();
	});
});
