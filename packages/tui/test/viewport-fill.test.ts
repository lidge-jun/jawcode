import { describe, expect, it } from "bun:test";
import { type Component, CURSOR_MARKER, TUI, ViewportFill } from "@jawcode-dev/tui";
import { VirtualTerminal } from "./virtual-terminal";

/**
 * Composer bottom pin (devlog 083.7): a ViewportFill mounted between the
 * transcript and the composer cluster expands to the viewport remainder so
 * the composer row stays constant while content above grows or collapses
 * (083.1/083.5 auto-collapse no longer makes the editor bounce — 083.6).
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
	constructor(private readonly withCursor = false) {}
	invalidate(): void {}
	render(_width: number): string[] {
		const inputLine = this.withCursor ? `> input${CURSOR_MARKER}` : "> input";
		return ["[status]", inputLine, "[footer]"];
	}
}

async function flushRender(term: VirtualTerminal): Promise<void> {
	await new Promise<void>(resolve => process.nextTick(resolve));
	await Bun.sleep(17);
	await term.flush();
}

function composerRow(term: VirtualTerminal): number {
	return term.getViewport().findIndex(line => line.startsWith("[status]"));
}

function pinnedTui(term: VirtualTerminal, content: Component, composer: Component = new ComposerStub()): TUI {
	// §11 layout: the fill sits ABOVE the chat so content+composer hug the floor.
	const tui = new TUI(term);
	tui.addChild(new ViewportFill());
	tui.addChild(content);
	tui.addChild(composer);
	return tui;
}

describe("ViewportFill composer pin (083.7)", () => {
	it("keeps the composer row constant across grow/collapse cycles", async () => {
		const term = new VirtualTerminal(60, 20);
		const content = new MutableContent(["chat-0", "chat-1", "chat-2", "chat-3", "chat-4"]);
		const tui = pinnedTui(term, content);
		tui.start();
		await flushRender(term);

		const pinnedRow = composerRow(term);
		expect(pinnedRow).toBe(20 - 3); // composer cluster = 3 lines, on the floor

		const base = ["chat-0", "chat-1", "chat-2", "chat-3", "chat-4"];
		for (let cycle = 0; cycle < 3; cycle++) {
			// Tool preview grows by 8 lines mid-turn…
			content.setLines([...base, ...Array.from({ length: 8 }, (_v, i) => `tool-${cycle}-${i}`)]);
			tui.requestRender();
			await flushRender(term);
			expect(composerRow(term)).toBe(pinnedRow);

			// …then minimizes back to one line (083.1 auto-collapse).
			content.setLines([...base, `tool-${cycle}-collapsed`]);
			base.push(`tool-${cycle}-collapsed`);
			tui.requestRender();
			await flushRender(term);
			expect(composerRow(term)).toBe(pinnedRow);
		}
		tui.stop();
	});

	it("does not trigger clearOnShrink full redraws while pinned", async () => {
		const term = new VirtualTerminal(60, 20);
		const content = new MutableContent(["chat-0"]);
		const tui = pinnedTui(term, content);
		tui.setClearOnShrink(true);
		tui.start();
		await flushRender(term);
		const redrawsAfterStart = tui.fullRedraws;

		for (let cycle = 0; cycle < 3; cycle++) {
			content.setLines(["chat-0", ...Array.from({ length: 8 }, (_v, i) => `tool-${i}`)]);
			tui.requestRender();
			await flushRender(term);
			content.setLines(["chat-0", "tool-collapsed"]);
			tui.requestRender();
			await flushRender(term);
		}
		// Frame length is constant (= viewport height) while pinned, so the
		// shrink path never fires.
		expect(tui.fullRedraws).toBe(redrawsAfterStart);
		tui.stop();
	});

	it("expands only the first sentinel and drops extras", async () => {
		const term = new VirtualTerminal(40, 10);
		const tui = new TUI(term);
		tui.addChild(new MutableContent(["top"]));
		tui.addChild(new ViewportFill());
		tui.addChild(new MutableContent(["middle"]));
		tui.addChild(new ViewportFill()); // misuse — must be dropped, not expanded
		tui.addChild(new MutableContent(["bottom"]));
		tui.start();
		await flushRender(term);

		const viewport = term.getViewport();
		expect(viewport[0]).toBe("top");
		// middle+bottom pinned to the floor as a contiguous cluster.
		expect(viewport[8]).toBe("middle");
		expect(viewport[9]).toBe("bottom");
		tui.stop();
	});

	it("leaves no trace once content exceeds the viewport and keeps scrollback gapless", async () => {
		const term = new VirtualTerminal(40, 10);
		const content = new MutableContent(["chat-0"]);
		const tui = pinnedTui(term, content);
		tui.start();
		await flushRender(term);

		// Grow well past the viewport (fill collapses to 0, natural scroll).
		content.setLines(Array.from({ length: 30 }, (_v, i) => `chat-${i}`));
		tui.requestRender();
		await flushRender(term);

		const viewport = term.getViewport();
		expect(viewport[9]).toBe("[footer]"); // composer still on the floor
		expect(viewport[6]).toBe("chat-29"); // content directly above the composer

		// Scrolled-out region must contain real content, not blank fill pages.
		const buffer = term.getScrollBuffer();
		const scrolledOut = buffer.slice(0, buffer.length - 10);
		const blankRun = scrolledOut.filter(line => line.trim() === "").length;
		expect(blankRun).toBeLessThan(scrolledOut.length); // not a blank page
		expect(scrolledOut.some(line => line.startsWith("chat-"))).toBeTrue();
		tui.stop();
	});

	it("renders identically with the fill disabled (legacy escape hatch)", async () => {
		const renderWith = async (mount: (tui: TUI) => void): Promise<string[]> => {
			const term = new VirtualTerminal(40, 12);
			const tui = new TUI(term);
			mount(tui);
			tui.start();
			await flushRender(term);
			const viewport = term.getViewport();
			tui.stop();
			return viewport;
		};

		const disabled = new ViewportFill();
		disabled.setEnabled(false);
		const withDisabledFill = await renderWith(tui => {
			tui.addChild(new MutableContent(["a", "b"]));
			tui.addChild(disabled);
			tui.addChild(new ComposerStub());
		});
		const withoutFill = await renderWith(tui => {
			tui.addChild(new MutableContent(["a", "b"]));
			tui.addChild(new ComposerStub());
		});
		expect(withDisabledFill).toEqual(withoutFill);
	});

	it("keeps the hardware cursor on the pinned editor row", async () => {
		const term = new VirtualTerminal(40, 12);
		const tui = pinnedTui(term, new MutableContent(["chat-0"]), new ComposerStub(true));
		tui.setShowHardwareCursor(true);
		tui.start();
		await flushRender(term);

		// Editor input line is the middle of the 3-line composer on the floor.
		expect(term.getCursorRow()).toBe(12 - 2);
		tui.stop();
	});

	it("re-pins the composer after terminal resizes", async () => {
		const term = new VirtualTerminal(60, 24);
		const content = new MutableContent(["chat-0", "chat-1"]);
		const tui = pinnedTui(term, content);
		tui.start();
		await flushRender(term);
		expect(composerRow(term)).toBe(24 - 3);

		term.resize(60, 12);
		await flushRender(term);
		expect(composerRow(term)).toBe(12 - 3);

		term.resize(60, 24);
		await flushRender(term);
		expect(composerRow(term)).toBe(24 - 3);
		tui.stop();
	});
});

describe("ViewportFill boundary crossing (083.6 worst case)", () => {
	it("re-pins the composer when a big collapse drops the frame back below the viewport", async () => {
		const term = new VirtualTerminal(60, 12);
		const content = new MutableContent(["chat-0"]);
		const tui = pinnedTui(term, content);
		tui.start();
		await new Promise<void>(resolve => process.nextTick(resolve));
		await Bun.sleep(17);
		await term.flush();

		// Huge tool preview pushes the frame well past the viewport (fill = 0).
		content.setLines(Array.from({ length: 40 }, (_v, i) => `tool-${i}`));
		tui.requestRender();
		await new Promise<void>(resolve => process.nextTick(resolve));
		await Bun.sleep(17);
		await term.flush();
		expect(term.getViewport()[11]).toBe("[footer]"); // bottom-anchored while overflowing

		// The cell collapses to one line — frame plunges below the viewport.
		content.setLines(["chat-0", "tool-collapsed"]);
		tui.requestRender();
		await new Promise<void>(resolve => process.nextTick(resolve));
		await Bun.sleep(17);
		await term.flush();

		const viewport = term.getViewport();
		// Composer must be back on the floor, not floating mid-screen.
		expect(viewport[9]).toBe("[status]");
		expect(viewport[10]).toBe("> input");
		expect(viewport[11]).toBe("[footer]");
		// §11: content hugs the composer from above; the fill absorbs the top.
		expect(viewport[7]).toBe("chat-0");
		expect(viewport[8]).toBe("tool-collapsed");
		// No stale tool lines left visible above the content.
		for (let row = 0; row < 7; row++) {
			expect(viewport[row].trim()).toBe("");
		}
		tui.stop();
	});
});

describe("ViewportFill post-overflow shrink floor (083.7 §9)", () => {
	it("keeps the composer on the floor when the frame shrinks in place while still overflowing (autocomplete close)", async () => {
		const term = new VirtualTerminal(60, 12);
		const content = new MutableContent(Array.from({ length: 30 }, (_v, i) => `chat-${i}`));
		const tui = pinnedTui(term, content);
		tui.start();
		await flushRender(term);
		expect(term.getViewport()[11]).toBe("[footer]");

		// Tail-only shrink: like the slash-autocomplete dropdown closing — the
		// first 25 lines stay byte-identical, the frame just loses 5 rows.
		content.setLines(Array.from({ length: 25 }, (_v, i) => `chat-${i}`));
		tui.requestRender();
		await flushRender(term);

		const viewport = term.getViewport();
		// Composer must remain on the terminal floor — the regression was a
		// floating composer with permanently blank buffer rows below it.
		expect(viewport[9]).toBe("[status]");
		expect(viewport[10]).toBe("> input");
		expect(viewport[11]).toBe("[footer]");
		tui.stop();
	});

	it("keeps the composer on the floor when a tool collapses while the transcript still overflows", async () => {
		const term = new VirtualTerminal(60, 12);
		const base = Array.from({ length: 20 }, (_v, i) => `chat-${i}`);
		const content = new MutableContent([...base, ...Array.from({ length: 10 }, (_v, i) => `tool-${i}`)]);
		const tui = pinnedTui(term, content);
		tui.start();
		await flushRender(term);
		expect(term.getViewport()[11]).toBe("[footer]");

		// 083.1 auto-collapse: the 10-line preview becomes one line mid-turn.
		content.setLines([...base, "tool-collapsed"]);
		tui.requestRender();
		await flushRender(term);

		const viewport = term.getViewport();
		expect(viewport[9]).toBe("[status]");
		expect(viewport[10]).toBe("> input");
		expect(viewport[11]).toBe("[footer]");
		tui.stop();
	});
});

describe("ViewportFill gap compaction (083.7 §10)", () => {
	it("compactViewportFill collapses the post-overflow gap so content hugs the composer", async () => {
		const term = new VirtualTerminal(60, 12);
		const content = new MutableContent(Array.from({ length: 30 }, (_v, i) => `chat-${i}`));
		const tui = pinnedTui(term, content);
		tui.start();
		await flushRender(term);

		// Shrink while overflowing — the floor keeps the composer pinned with a
		// 5-row gap above it (§9 behavior).
		content.setLines(Array.from({ length: 25 }, (_v, i) => `chat-${i}`));
		tui.requestRender();
		await flushRender(term);
		// §11: the floor gap sits above the content (scrollback side), so the
		// viewport already shows content hugging the composer…
		expect(term.getViewport()[11]).toBe("[footer]");
		expect(term.getViewport()[8]).toBe("chat-24");
		// …and the gap stays logical-only (083.8 S3): the shrink repaints just the
		// viewport, so scrollback keeps the pre-shrink rows instead of being
		// rewritten with blank fill rows.
		const blanksBefore = term.getScrollBuffer().filter(line => line.trim() === "").length;
		expect(blanksBefore).toBe(0);
		expect(term.getScrollBuffer().some(line => line === "chat-0")).toBeTrue();

		// Turn end: compact — buffer rebuilt without the dead blank region.
		tui.compactViewportFill();
		await flushRender(term);

		const viewport = term.getViewport();
		expect(viewport[8]).toBe("chat-24"); // content still hugs the composer
		expect(viewport[9]).toBe("[status]");
		expect(viewport[11]).toBe("[footer]");
		// Scrollback rebuilt consistently — earlier transcript still reachable.
		expect(term.getScrollBuffer().some(line => line === "chat-0")).toBeTrue();

		// No gap → second call is a no-op (no extra full redraw).
		const redraws = tui.fullRedraws;
		tui.compactViewportFill();
		await flushRender(term);
		expect(tui.fullRedraws).toBe(redraws);
		tui.stop();
	});
});

describe("ViewportFill slash restore (99.20.03 표면 3 시각 보장)", () => {
	it("keeps content+composer on the floor when the composer cluster shrinks back (selector close)", async () => {
		const term = new VirtualTerminal(60, 16);
		const content = new MutableContent(["chat-0", "chat-1", "chat-2"]);
		const cluster = new MutableContent(["[status]", "> input", "[footer]"]);
		const tui = new TUI(term);
		tui.addChild(new ViewportFill());
		tui.addChild(content);
		tui.addChild(cluster);
		tui.start();
		await flushRender(term);
		expect(term.getViewport()[15]).toBe("[footer]");
		expect(term.getViewport()[12]).toBe("chat-2"); // content hugs the cluster

		// Slash selector opens — the cluster grows by 6 rows in place of the editor.
		cluster.setLines(["[status]", ...Array.from({ length: 6 }, (_v, i) => `option-${i}`), "[footer]"]);
		tui.requestRender();
		await flushRender(term);
		expect(term.getViewport()[15]).toBe("[footer]");

		// Selector closes — the editor is restored (cluster shrinks back).
		cluster.setLines(["[status]", "> input", "[footer]"]);
		tui.requestRender();
		await flushRender(term);

		const viewport = term.getViewport();
		// Everything re-renders at the bottom: footer on the floor, content
		// directly above the restored composer — nothing stranded at the top.
		expect(viewport[15]).toBe("[footer]");
		expect(viewport[14]).toBe("> input");
		expect(viewport[13]).toBe("[status]");
		expect(viewport[12]).toBe("chat-2");
		expect(viewport[0].trim()).toBe(""); // gap absorbed at the top
		tui.stop();
	});
});

describe("ViewportFill oversized selector restore (사용자 260613 00:04 스크린샷 시나리오)", () => {
	it("returns the restored composer to the floor after a selector taller than the viewport closes", async () => {
		const term = new VirtualTerminal(60, 12);
		const content = new MutableContent(["chat-0", "chat-1"]);
		const cluster = new MutableContent(["[status]", "> input", "[footer]"]);
		const tui = new TUI(term);
		tui.addChild(new ViewportFill());
		tui.addChild(content);
		tui.addChild(cluster);
		tui.start();
		await flushRender(term);
		expect(term.getViewport()[11]).toBe("[footer]");

		// Selector taller than the viewport opens — frame overflows and scrolls
		// ("스크롤이 내려가서"). Bottom anchored: the selector tail is visible.
		cluster.setLines(["[status]", ...Array.from({ length: 20 }, (_v, i) => `option-${i}`), "[footer]"]);
		tui.requestRender();
		await flushRender(term);
		expect(term.getViewport()[11]).toBe("[footer]");
		expect(term.getViewport()[10]).toBe("option-19");

		// Selector closes — editor restored. The frame shrinks massively while
		// the buffer cannot un-scroll; the regression was a composer stranded
		// mid-screen with blank rows BELOW it (B1 §9 behavior).
		cluster.setLines(["[status]", "> input", "[footer]"]);
		tui.requestRender();
		await flushRender(term);

		const viewport = term.getViewport();
		expect(viewport[11]).toBe("[footer]"); // composer back on the floor
		expect(viewport[10]).toBe("> input");
		expect(viewport[9]).toBe("[status]");
		expect(viewport[8]).toBe("chat-1"); // content hugs the restored composer
		tui.stop();
	});
});

describe("ViewportFill sticky gap (083.7 §12 — append diff-storm regression)", () => {
	it("does not full-redraw on streaming appends while an overflow gap exists", async () => {
		const term = new VirtualTerminal(60, 12);
		const content = new MutableContent(Array.from({ length: 30 }, (_v, i) => `chat-${i}`));
		const tui = pinnedTui(term, content);
		tui.start();
		await flushRender(term);

		// Collapse creates the gap (one full redraw here is fine).
		content.setLines(Array.from({ length: 25 }, (_v, i) => `chat-${i}`));
		tui.requestRender();
		await flushRender(term);
		const baseline = tui.fullRedraws;

		// Streaming: 5 single-line appends — each must be an append-only diff.
		// (Regression: the gap used to shrink from the top, shifting every row
		// below and forcing a 2J/3J full redraw per chunk — visible as the
		// viewport "jumping to the top" mid-turn in VS Code.)
		const lines = Array.from({ length: 25 }, (_v, i) => `chat-${i}`);
		for (let i = 0; i < 5; i++) {
			lines.push(`stream-${i}`);
			content.setLines(lines);
			tui.requestRender();
			await flushRender(term);
		}
		expect(tui.fullRedraws).toBe(baseline);
		// Composer still pinned, content still hugging it.
		const viewport = term.getViewport();
		expect(viewport[11]).toBe("[footer]");
		expect(viewport[8]).toBe("stream-4");
		tui.stop();
	});
});
