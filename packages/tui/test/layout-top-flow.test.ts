import { describe, expect, it } from "bun:test";
import { type Component, TUI, ViewportFill } from "@jawcode-dev/tui";
import { VirtualTerminal } from "./virtual-terminal";

/**
 * 260704 FINAL FORM — top-flow layout: the fill sentinel sits BETWEEN the
 * transcript and the composer cluster, so content flows top-down under the
 * banner (standard terminal shape) and the only blank region is the
 * shrinking pad above the pinned composer. With the sentinel not at frame
 * line 0, #lastFillRows stays 0 → the mid-turn commit WRITE lane is inert;
 * the turn-boundary realign lane owns history (as-streamed pixels).
 */

function block(rows: string[]): Component {
	return { render: () => [...rows], invalidate() {} };
}

async function flushRender(term: VirtualTerminal): Promise<void> {
	await new Promise<void>(resolve => process.nextTick(resolve));
	await Bun.sleep(17);
	await term.flush();
}

describe("top-flow layout (260704 final form)", () => {
	it("content is contiguous from the top; the only blank run sits above the composer", async () => {
		const term = new VirtualTerminal(40, 16);
		const tui = new TUI(term);
		tui.addChild(block(["banner-0", "banner-1"]));
		tui.addChild(block(["chat-0", "chat-1", "chat-2"]));
		tui.addChild(new ViewportFill());
		tui.addChild(block(["[status]", "> input"]));
		tui.start();
		await flushRender(term);

		const viewport = term.getViewport();
		expect(viewport.slice(0, 5)).toEqual(["banner-0", "banner-1", "chat-0", "chat-1", "chat-2"]);
		expect(viewport.at(-1)).toBe("> input");
		// Exactly one blank region: rows 5..13 (the pad above the composer).
		const blanks = viewport.map((l, i) => (l.trim() === "" ? i : -1)).filter(i => i >= 0);
		expect(blanks).toEqual(Array.from({ length: 9 }, (_, i) => 5 + i));

		// The mid-turn write lane is inert in this layout (sentinel not first).
		expect(tui.viewportFillRows).toBe(0);
		expect(tui.commitLines(["x"])).toBe(false);
		tui.stop();
	});

	it("growth consumes the pad downward; composer stays pinned", async () => {
		const term = new VirtualTerminal(40, 12);
		const chat: Component & { lines: string[] } = {
			lines: ["chat-0"],
			invalidate() {},
			render() {
				return [...this.lines];
			},
		};
		const tui = new TUI(term);
		tui.addChild(chat);
		tui.addChild(new ViewportFill());
		tui.addChild(block(["> input"]));
		tui.start();
		await flushRender(term);

		chat.lines = ["chat-0", "chat-1", "chat-2", "chat-3"];
		tui.requestRender();
		await flushRender(term);

		const viewport = term.getViewport();
		expect(viewport.slice(0, 4)).toEqual(["chat-0", "chat-1", "chat-2", "chat-3"]);
		expect(viewport.at(-1)).toBe("> input");
		tui.stop();
	});
});
