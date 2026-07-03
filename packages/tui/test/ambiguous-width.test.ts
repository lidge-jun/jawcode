import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { type Component, TUI, ViewportFill } from "@jawcode-dev/tui";
import { Ellipsis, getAmbiguousWidthMode, setAmbiguousWidthMode, truncateToWidth, visibleWidth } from "../src/utils";
import { VirtualTerminal } from "./virtual-terminal";

/**
 * 260703 WP2.5 — ambiguous-width mode. East Asian AMBIGUOUS characters
 * (…, §, ·) render 1 or 2 cells depending on the terminal's context; the
 * mode switch feeds BOTH width tables (Bun.stringWidth and pi-natives) so
 * padding and truncation can never disagree, and a startup CPR probe learns
 * the real terminal's answer. Plan: devlog 21_wp25 (v2, post-audit).
 */

const stdoutIsTtyDescriptor = Object.getOwnPropertyDescriptor(process.stdout, "isTTY");
let previousTerm: string | undefined;

beforeEach(() => {
	previousTerm = process.env.TERM;
	process.env.TERM = "xterm-256color";
});

function stubTty(value: boolean): void {
	Object.defineProperty(process.stdout, "isTTY", { value, configurable: true });
}

function restoreTty(): void {
	if (stdoutIsTtyDescriptor) {
		Object.defineProperty(process.stdout, "isTTY", stdoutIsTtyDescriptor);
	} else {
		delete (process.stdout as unknown as Record<string, unknown>).isTTY;
	}
}

class ComposerStub implements Component {
	invalidate(): void {}
	render(_width: number): string[] {
		return ["> input"];
	}
}

async function flushRender(term: VirtualTerminal): Promise<void> {
	await new Promise<void>(resolve => process.nextTick(resolve));
	await Bun.sleep(17);
	await term.flush();
}

function setup(): { term: VirtualTerminal; tui: TUI } {
	const term = new VirtualTerminal(40, 10);
	const tui = new TUI(term);
	tui.addChild(new ViewportFill());
	tui.addChild(new ComposerStub());
	tui.start();
	return { term, tui };
}

afterEach(() => {
	// The mode is process-global (JS module state + native AtomicBool).
	setAmbiguousWidthMode("narrow");
	restoreTty();
	if (previousTerm === undefined) {
		delete process.env.TERM;
	} else {
		process.env.TERM = previousTerm;
	}
	delete Bun.env.JWC_AMBIGUOUS_WIDTH;
});

describe("ambiguous width mode (260703 WP2.5)", () => {
	it("switches both width tables together — measurement and truncation agree", () => {
		expect(visibleWidth("…§·")).toBe(3);
		expect(truncateToWidth("…§·ab", 4, Ellipsis.Omit)).toBe("…§·a");

		setAmbiguousWidthMode("wide");
		expect(getAmbiguousWidthMode()).toBe("wide");
		expect(visibleWidth("…§·")).toBe(6);
		// Native truncation must cut with the SAME table: 2 chars × 2 cells.
		expect(truncateToWidth("…§·ab", 4, Ellipsis.Omit)).toBe("…§");

		setAmbiguousWidthMode("narrow");
		expect(visibleWidth("…§·")).toBe(3);
	});

	it("CPR probe: a wide reply flips the mode and repaints; screen stays clean", async () => {
		stubTty(true);
		const { term, tui } = setup();
		const writes = term.getWriteLog().join("");
		expect(writes).toContain("\x1b[6n");
		expect(writes).toContain("§…·");

		// Terminal answers: cursor at column 7 after 3 probe chars → wide.
		term.sendInput("\x1b[1;7R");
		await flushRender(term);

		expect(getAmbiguousWidthMode()).toBe("wide");
		// Probe bytes were erased before the first frame — no residue on row 0.
		expect(term.getViewport()[0]).not.toContain("§");
		expect(term.getViewport().at(-1)).toBe("> input");
		tui.stop();
	});

	it("CPR probe: a narrow reply keeps the default without a forced repaint", async () => {
		stubTty(true);
		const { term, tui } = setup();
		term.sendInput("\x1b[1;4R");
		await flushRender(term);
		expect(getAmbiguousWidthMode()).toBe("narrow");
		tui.stop();
	});

	it("env override wins and skips the probe entirely", async () => {
		stubTty(true);
		Bun.env.JWC_AMBIGUOUS_WIDTH = "2";
		const { term, tui } = setup();
		expect(term.getWriteLog().join("")).not.toContain("\x1b[6n");
		expect(getAmbiguousWidthMode()).toBe("wide");
		tui.stop();
	});

	it("timeout keeps the current default and unblocks the commit lane", async () => {
		stubTty(true);
		const { term, tui } = setup();
		await flushRender(term);
		// Probe outstanding → commits are deferred to the virtual lane.
		expect(tui.commitLines(["c-0"])).toBe(false);

		await Bun.sleep(160); // past the 150ms probe window
		expect(getAmbiguousWidthMode()).toBe("narrow");
		expect(tui.commitLines(["c-0"])).toBe(true);
		tui.stop();
	});

	it("non-TTY stdout never probes (default for the test suite)", async () => {
		const { term, tui } = setup();
		await flushRender(term);
		expect(term.getWriteLog().join("")).not.toContain("\x1b[6n");
		expect(tui.commitLines(["c-0"])).toBe(true);
		tui.stop();
	});
});
