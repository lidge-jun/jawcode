import { describe, expect, it } from "bun:test";
import { Text, TUI, visibleWidth } from "@jawcode-dev/tui";
import { VirtualTerminal } from "./virtual-terminal";

async function flushRender(term: VirtualTerminal): Promise<void> {
	await new Promise<void>(resolve => process.nextTick(resolve));
	await Bun.sleep(17);
	await term.flush();
}

describe("Korean transcript rebuild", () => {
	it("keeps Hangul tone-mark rows bounded and lossless during replay", async () => {
		const term = new VirtualTerminal(2, 4);
		const tui = new TUI(term);
		tui.start();
		try {
			await flushRender(term);
			const transcript = new Text("가\u302eX", 0, 0).render(2);
			expect(transcript).toEqual(["가\u302e", "X "]);
			for (const row of transcript) expect(visibleWidth(row)).toBeLessThanOrEqual(2);

			tui.replayTranscript(transcript);
			await flushRender(term);
			expect(term.getScrollBuffer().filter(row => row === "가\u302e")).toHaveLength(1);
			expect(term.getScrollBuffer().filter(row => row === "X ")).toHaveLength(1);
		} finally {
			tui.stop();
		}
	});
});
