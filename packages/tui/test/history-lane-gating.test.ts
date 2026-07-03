import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { type Component, type Terminal, TUI, ViewportFill } from "@jawcode-dev/tui";
import { VirtualTerminal } from "./virtual-terminal";

/**
 * 260703 WP3b-min — history-lane gating. While a streaming phase is active
 * and the user may be scrolled off-bottom, DECSTBM history insertions fight
 * native scrolling (the top-pinned-block symptom): new commits defer to the
 * virtual lane; parked rows flush once at the streaming boundaries.
 * Policy: GPT Pro round-5 spec, devlog 40_wp3b_min_history_gating.md.
 */

let previousTerm: string | undefined;
let previousTmux: string | undefined;

beforeEach(() => {
	previousTerm = process.env.TERM;
	previousTmux = process.env.TMUX;
	process.env.TERM = "xterm-256color";
	delete process.env.TMUX;
});

afterEach(() => {
	if (previousTerm === undefined) delete process.env.TERM;
	else process.env.TERM = previousTerm;
	if (previousTmux === undefined) delete process.env.TMUX;
	else process.env.TMUX = previousTmux;
	delete Bun.env.JWC_TUI_DEFER_UNKNOWN_BOTTOM;
});

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

/** Wrap a VirtualTerminal, overriding what isViewportAtBottom reports. */
function withViewportBottom(term: VirtualTerminal, bottom: boolean | undefined): Terminal {
	const wrapped: Terminal = {
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
	if (bottom !== undefined) {
		wrapped.isViewportAtBottom = () => bottom;
	}
	return wrapped;
}

async function setup(bottom: boolean | undefined): Promise<{ term: VirtualTerminal; tui: TUI }> {
	const term = new VirtualTerminal(40, 12);
	const tui = new TUI(withViewportBottom(term, bottom));
	tui.addChild(new ViewportFill());
	tui.addChild(new ComposerStub());
	tui.start();
	await flushRender(term);
	return { term, tui };
}

describe("history-lane gating (260703 WP3b-min)", () => {
	it("streaming + off-bottom defers new commits; idle allows them", async () => {
		const { tui } = await setup(false);
		tui.setStreamingActive(true);
		expect(tui.commitLines(["c-0"])).toBe(false);
		tui.setStreamingActive(false);
		expect(tui.commitLines(["c-0"])).toBe(true);
		tui.stop();
	});

	it("streaming + at-bottom commits normally", async () => {
		const { tui } = await setup(true);
		tui.setStreamingActive(true);
		expect(tui.commitLines(["c-0"])).toBe(true);
		tui.stop();
	});

	it("streaming + unknown bottom: allowed in direct terminals, deferred in multiplexers and under the env flag", async () => {
		const direct = await setup(undefined);
		direct.tui.setStreamingActive(true);
		expect(direct.tui.commitLines(["c-0"])).toBe(true);
		direct.tui.stop();

		process.env.TMUX = "/tmp/tmux-1000/default,1234,0";
		const mux = await setup(undefined);
		mux.tui.setStreamingActive(true);
		expect(mux.tui.commitLines(["c-0"])).toBe(false);
		mux.tui.stop();
		delete process.env.TMUX;

		Bun.env.JWC_TUI_DEFER_UNKNOWN_BOTTOM = "1";
		const conservative = await setup(undefined);
		conservative.tui.setStreamingActive(true);
		expect(conservative.tui.commitLines(["c-0"])).toBe(false);
		conservative.tui.stop();
	});

	it("flushHistoryLane pushes parked rows into scrollback in order and is idempotent", async () => {
		const { term, tui } = await setup(true);
		expect(tui.commitLines(["c-0", "c-1"])).toBe(true);
		await term.flush();

		tui.flushHistoryLane();
		await flushRender(term);

		const all = term.getScrollBuffer().filter(l => l.trim() !== "");
		const i0 = all.indexOf("c-0");
		expect(i0).toBeGreaterThanOrEqual(0);
		expect(all.indexOf("c-1")).toBe(i0 + 1);
		// Exactly once each (flush + resync must not duplicate).
		expect(all.filter(l => l === "c-0").length).toBe(1);
		expect(all.filter(l => l === "c-1").length).toBe(1);
		// Live zone intact.
		expect(term.getViewport().at(-1)).toBe("> input");

		const writesBefore = term.getWriteLog().length;
		tui.flushHistoryLane(); // nothing parked → no-op
		expect(term.getWriteLog().length).toBe(writesBefore);
		tui.stop();
	});
});
