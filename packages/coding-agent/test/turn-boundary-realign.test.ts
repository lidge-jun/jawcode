import { afterAll, afterEach, beforeAll, describe, expect, it } from "bun:test";
import { ViewportFill } from "@jawcode-dev/tui";
import { resetSettingsForTest, Settings, settings } from "../src/config/settings";
import type { InteractiveModeContext } from "../src/modes/types";
import {
	canMarkEntireBacklog,
	commitFinalizedBacklog,
	commitFinalizedBacklogMidTurn,
	commitPreamble,
	markPreambleCommitted,
	measureComposerClusterRows,
} from "../src/modes/utils/ui-helpers";

/**
 * 260702 F3 — turn-boundary realign wiring (coding-agent side).
 *
 * measureComposerClusterRows walks the REAL TUI child list below the chat
 * container (260703 v3: pendingMessagesContainer sits between chat and live
 * tools and MUST count as cluster, or queued-chip pixels get parked into the
 * committed block) so anonymous members (the breathing-room Spacer) stay
 * counted; commitFinalizedBacklog's markOnly mode flags cells committed
 * without a second insert-history write (the scroll-out realign already put
 * their as-streamed pixels into the scrollback).
 */

function fakeComponent(rows: number) {
	return {
		render: (_width: number) => Array.from({ length: rows }, (_, i) => `row-${i}`),
		invalidate() {},
	};
}

describe("measureComposerClusterRows (260702 F3 / 260703 v3)", () => {
	it("sums the rendered rows of every component below the chat container", () => {
		const chatContainer = fakeComponent(40);
		const ctx = {
			ui: {
				terminal: { columns: 80 },
				children: [fakeComponent(3), chatContainer, fakeComponent(0), fakeComponent(1), fakeComponent(2)],
			},
			chatContainer,
		} as unknown as InteractiveModeContext;
		expect(measureComposerClusterRows(ctx)).toBe(3);
	});

	it("counts queued-message chips between chat and live tools as cluster (260703 v3)", () => {
		const chatContainer = fakeComponent(40);
		const pendingChips = fakeComponent(3);
		const liveToolContainer = fakeComponent(0);
		const ctx = {
			ui: {
				terminal: { columns: 80 },
				children: [
					fakeComponent(3),
					chatContainer,
					pendingChips,
					liveToolContainer,
					fakeComponent(1),
					fakeComponent(2),
				],
			},
			chatContainer,
			liveToolContainer,
		} as unknown as InteractiveModeContext;
		// Chip rows are cluster, never transcript: 3 (chips) + 1 + 2.
		expect(measureComposerClusterRows(ctx)).toBe(6);
	});

	it("returns -1 when the chat container is not mounted on the UI", () => {
		const ctx = {
			ui: { terminal: { columns: 80 }, children: [fakeComponent(2)] },
			chatContainer: fakeComponent(0),
		} as unknown as InteractiveModeContext;
		expect(measureComposerClusterRows(ctx)).toBe(-1);
	});
});

describe("markPreambleCommitted (260702 F3 follow-up — duplicated welcome banner)", () => {
	it("marks preamble children committed, keeps ViewportFill live, stops at chatContainer", () => {
		const welcome = { render: () => ["jwc v1.1.2"], committed: false, invalidate() {} };
		const spacer = { render: () => [""], committed: false, invalidate() {} };
		const fill = new ViewportFill();
		const chatContainer = { children: [], render: () => [], committed: false, invalidate() {} };
		const composer = { render: () => ["> input"], committed: false, invalidate() {} };
		const ctx = {
			ui: { children: [spacer, welcome, fill, chatContainer, composer] },
			chatContainer,
		} as unknown as InteractiveModeContext;
		markPreambleCommitted(ctx);
		expect(spacer.committed).toBe(true);
		expect(welcome.committed).toBe(true);
		expect((fill as { committed?: boolean }).committed).not.toBe(true);
		expect(chatContainer.committed).toBe(false);
		expect(composer.committed).toBe(false);
	});
});

describe("canMarkEntireBacklog (260702 F3, gpt-5.5 review blocker)", () => {
	it("is false while a pending background tool component sits uncommitted in the chat", () => {
		const parked = { render: () => ["bg-tool"], committed: false, invalidate() {} };
		const ctx = {
			chatContainer: { children: [{ render: () => ["done"], committed: true, invalidate() {} }, parked] },
			pendingTools: new Map([["call-1", parked]]),
			streamingComponent: undefined,
		} as unknown as InteractiveModeContext;
		expect(canMarkEntireBacklog(ctx)).toBe(false);
	});

	it("is true when every uncommitted cell is finalized", () => {
		const ctx = {
			chatContainer: {
				children: [
					{ render: () => ["a"], committed: true, invalidate() {} },
					{ render: () => ["b"], committed: false, invalidate() {} },
				],
			},
			pendingTools: new Map(),
			streamingComponent: undefined,
		} as unknown as InteractiveModeContext;
		expect(canMarkEntireBacklog(ctx)).toBe(true);
	});

	it("is false while a running user bash/eval execution sits uncommitted in the chat", () => {
		const running = {
			render: () => ["! sleep 100"],
			committed: false,
			invalidate() {},
			isBacklogCommittable: () => false,
		};
		const ctx = {
			chatContainer: { children: [running] },
			pendingTools: new Map(),
			streamingComponent: undefined,
		} as unknown as InteractiveModeContext;
		expect(canMarkEntireBacklog(ctx)).toBe(false);
		// …and true once the execution finished.
		running.isBacklogCommittable = () => true;
		expect(canMarkEntireBacklog(ctx)).toBe(true);
	});

	it("the sweep stops at a running execution in both modes (contiguous prefix preserved)", () => {
		const done = { render: () => ["done"], committed: false, invalidate() {} };
		const running = {
			render: () => ["! sleep 100"],
			committed: false,
			invalidate() {},
			isBacklogCommittable: () => false,
		};
		const after = { render: () => ["later"], committed: false, invalidate() {} };
		const ctx = {
			ui: { terminal: { columns: 80 }, commitLines: () => true },
			chatContainer: { children: [done, running, after] },
			pendingTools: new Map(),
			streamingComponent: undefined,
		} as unknown as InteractiveModeContext;
		commitFinalizedBacklog(ctx, { markOnly: true });
		expect(done.committed).toBe(true);
		expect(running.committed).toBe(false);
		expect(after.committed).toBe(false);
	});

	it("is false while the streaming component is still in the chat", () => {
		const streaming = { render: () => ["…"], committed: false, invalidate() {} };
		const ctx = {
			chatContainer: { children: [streaming] },
			pendingTools: new Map(),
			streamingComponent: streaming,
		} as unknown as InteractiveModeContext;
		expect(canMarkEntireBacklog(ctx)).toBe(false);
	});
});

describe("commitFinalizedBacklog markOnly mode (260702 F3)", () => {
	function makeCtx(commitLinesResult: boolean) {
		const calls: string[][] = [];
		const children = [
			{ render: () => ["cell-a"], committed: false, invalidate() {} },
			{ render: () => ["cell-b"], committed: false, invalidate() {} },
		];
		const ctx = {
			ui: {
				terminal: { columns: 80 },
				commitLines(lines: string[]): boolean {
					calls.push(lines);
					return commitLinesResult;
				},
			},
			chatContainer: { children },
			pendingTools: new Map(),
			streamingComponent: undefined,
		} as unknown as InteractiveModeContext;
		return { ctx, calls, children };
	}

	it("marks cells committed WITHOUT writing when markOnly is set", () => {
		const { ctx, calls, children } = makeCtx(true);
		commitFinalizedBacklog(ctx, { markOnly: true });
		expect(calls).toEqual([]);
		expect(children.every(c => c.committed)).toBe(true);
	});

	it("keeps the normal insert-history write path by default", () => {
		const { ctx, calls, children } = makeCtx(true);
		commitFinalizedBacklog(ctx);
		expect(calls).toEqual([["cell-a"], ["cell-b"]]);
		expect(children.every(c => c.committed)).toBe(true);
	});

	it("default mode still stops at the first failed commit (virtual-lane fallback)", () => {
		const { ctx, calls, children } = makeCtx(false);
		commitFinalizedBacklog(ctx);
		expect(calls).toEqual([["cell-a"]]);
		expect(children[0].committed).toBe(false);
		expect(children[1].committed).toBe(false);
	});
});

describe("commitFinalizedBacklogMidTurn (260703 WP6b)", () => {
	beforeAll(async () => {
		await Settings.init({ inMemory: true });
	});

	afterAll(() => {
		resetSettingsForTest();
	});

	afterEach(() => {
		settings.set("tool.renderMode", undefined);
		delete process.env.JWC_COMMIT_ON_COMPLETION;
	});

	function makeMidTurnCtx() {
		const calls: string[][] = [];
		const streaming = { render: () => ["streaming"], committed: false, invalidate() {} };
		const children = [
			{ render: () => ["done-a"], committed: false, invalidate() {} },
			{ render: () => ["done-b"], committed: false, invalidate() {} },
			streaming,
		];
		const ctx = {
			ui: {
				terminal: { columns: 80 },
				commitLines(lines: string[]): boolean {
					calls.push(lines);
					return true;
				},
			},
			chatContainer: { children },
			pendingTools: new Map(),
			streamingComponent: streaming,
		} as unknown as InteractiveModeContext;
		return { ctx, calls, children, streaming };
	}

	it("commits the finalized prefix mid-turn and never passes the streaming component", () => {
		settings.set("tool.renderMode", "commit");
		const { ctx, calls, children, streaming } = makeMidTurnCtx();
		commitFinalizedBacklogMidTurn(ctx);
		expect(calls).toEqual([["done-a"], ["done-b"]]);
		expect(children[0].committed).toBe(true);
		expect(children[1].committed).toBe(true);
		expect(streaming.committed).toBe(false);
	});

	it("JWC_COMMIT_ON_COMPLETION=0 keeps the turn-boundary-only cadence", () => {
		settings.set("tool.renderMode", "commit");
		process.env.JWC_COMMIT_ON_COMPLETION = "0";
		const { ctx, calls } = makeMidTurnCtx();
		commitFinalizedBacklogMidTurn(ctx);
		expect(calls).toEqual([]);
	});

	it("verbose mode never commits mid-turn (renderCommitted would force-collapse it)", () => {
		settings.set("tool.renderMode", "verbose");
		const { ctx, calls } = makeMidTurnCtx();
		commitFinalizedBacklogMidTurn(ctx);
		expect(calls).toEqual([]);
	});
});

describe("boundary heal-and-retry when realign refuses (260704, fable-reviewed)", () => {
	function makeCtx(realignResults: boolean[], overflowed: boolean) {
		const calls: string[][] = [];
		let realignCalls = 0;
		const children = [
			{ render: () => ["err-a"], committed: false, invalidate() {} },
			{ render: () => ["err-b"], committed: false, invalidate() {} },
		];
		const ctx = {
			ui: {
				terminal: { columns: 80 },
				requestRender() {},
				realignOverflowedFrame: () => realignResults[Math.min(realignCalls++, realignResults.length - 1)],
				hasOverflowedIntoScrollback: () => overflowed,
				commitLines(lines: string[]): boolean {
					calls.push(lines);
					return false; // overflowed frame: the write lane refuses
				},
			},
			chatContainer: { children },
			pendingTools: new Map(),
			streamingComponent: undefined,
		} as unknown as InteractiveModeContext;
		return { ctx, calls, children, realignCallCount: () => realignCalls };
	}

	async function runBoundary(ctx: InteractiveModeContext) {
		// Mirrors the input-controller submit-boundary logic (heal + retry once).
		const markable = true;
		let realigned = markable && (ctx.ui.realignOverflowedFrame?.(0) ?? false);
		if (!realigned && markable && ctx.ui.hasOverflowedIntoScrollback?.() === true) {
			ctx.ui.requestRender(false, "realign heal");
			await new Promise(resolve => setTimeout(resolve, 1));
			realigned = ctx.ui.realignOverflowedFrame?.(0) ?? false;
		}
		commitFinalizedBacklog(ctx, { markOnly: realigned });
		return realigned;
	}

	it("heals and retries once; a successful retry adopts (markOnly, no write)", async () => {
		const { ctx, calls, children, realignCallCount } = makeCtx([false, true], true);
		expect(await runBoundary(ctx)).toBe(true);
		expect(realignCallCount()).toBe(2);
		expect(calls).toEqual([]); // as-streamed pixels adopted, no second write
		expect(children.every(c => c.committed)).toBe(true);
	});

	it("a persistent refusal NEVER blanket-adopts — loss is unrecoverable, duplication is", async () => {
		const { ctx, calls, children } = makeCtx([false, false], true);
		expect(await runBoundary(ctx)).toBe(false);
		// Write path attempted and refused by the overflowed frame → children
		// stay UNcommitted (retried next boundary) instead of being dropped.
		expect(calls.length).toBe(1);
		expect(children.every(c => !c.committed)).toBe(true);
	});
});

describe("commitPreamble (260704 top-flow layout)", () => {
	function makePreambleCtx(commitResult = true) {
		const calls: string[][] = [];
		const fill = new ViewportFill();
		const banner = { render: () => ["jwc v1.1.2", "bite · build · ship"], committed: false, invalidate() {} };
		const chatContainer = { children: [], render: () => [], committed: false, invalidate() {} };
		const composer = { render: () => ["> input"], committed: false, invalidate() {} };
		const ctx = {
			ui: {
				terminal: { columns: 80 },
				children: [fill, banner, chatContainer, composer],
				commitLines(lines: string[]): boolean {
					calls.push(lines);
					return commitResult;
				},
			},
			chatContainer,
		} as unknown as InteractiveModeContext;
		return { ctx, calls, banner, chatContainer, composer, fill };
	}

	it("commits preamble children to the seam, skips the fill, stops at chatContainer", () => {
		const { ctx, calls, banner, chatContainer, composer } = makePreambleCtx(true);
		commitPreamble(ctx);
		expect(calls).toEqual([["jwc v1.1.2", "bite · build · ship"]]);
		expect(banner.committed).toBe(true);
		expect(chatContainer.committed).toBe(false);
		expect(composer.committed).toBe(false);
	});

	it("is idempotent and retries cleanly after a refusal", () => {
		const { ctx, calls, banner } = makePreambleCtx(false);
		commitPreamble(ctx);
		expect(banner.committed).toBe(false); // refusal → stays virtual, retried later
		expect(calls.length).toBe(1);
		(ctx.ui as unknown as { commitLines: (l: string[]) => boolean }).commitLines = (l: string[]) => {
			calls.push(l);
			return true;
		};
		commitPreamble(ctx);
		expect(banner.committed).toBe(true);
		commitPreamble(ctx); // committed → no further writes
		expect(calls.length).toBe(2);
	});
});
