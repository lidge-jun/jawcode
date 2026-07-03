import { afterAll, afterEach, beforeAll, describe, expect, it } from "bun:test";
import { ViewportFill } from "@jawcode-dev/tui";
import { resetSettingsForTest, Settings, settings } from "../src/config/settings";
import type { InteractiveModeContext } from "../src/modes/types";
import {
	canMarkEntireBacklog,
	commitFinalizedBacklog,
	commitFinalizedBacklogMidTurn,
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

describe("boundary adoption when realign refuses (260704 duplication fix)", () => {
	function makeAdoptCtx(opts: { realigns: boolean; overflowed: boolean }) {
		const calls: string[][] = [];
		const children = [
			{ render: () => ["err-a"], committed: false, invalidate() {} },
			{ render: () => ["err-b"], committed: false, invalidate() {} },
		];
		const ctx = {
			ui: {
				terminal: { columns: 80 },
				realignOverflowedFrame: () => opts.realigns,
				hasOverflowedIntoScrollback: () => opts.overflowed,
				commitLines(lines: string[]): boolean {
					calls.push(lines);
					return true;
				},
			},
			chatContainer: { children },
			pendingTools: new Map(),
			streamingComponent: undefined,
		} as unknown as InteractiveModeContext;
		return { ctx, calls, children };
	}

	it("adopts already-scrolled pixels (markOnly) when realign refuses on an overflowed frame", () => {
		const { ctx, calls, children } = makeAdoptCtx({ realigns: false, overflowed: true });
		const markable = true;
		const realigned = markable && (ctx.ui.realignOverflowedFrame?.(0) ?? false);
		const adopt = realigned || (markable && ctx.ui.hasOverflowedIntoScrollback?.() === true);
		commitFinalizedBacklog(ctx, { markOnly: adopt });
		// Marked committed WITHOUT a second insert-history write — the pixels
		// are already in the physical scrollback (copy #1); a write here (or a
		// no-op leaving them uncommitted) is what produced copy #2.
		expect(calls).toEqual([]);
		expect(children.every(c => c.committed)).toBe(true);
	});

	it("non-overflowed frames keep the normal write path", () => {
		const { ctx, calls, children } = makeAdoptCtx({ realigns: false, overflowed: false });
		const markable = true;
		const realigned = markable && (ctx.ui.realignOverflowedFrame?.(0) ?? false);
		const adopt = realigned || (markable && ctx.ui.hasOverflowedIntoScrollback?.() === true);
		commitFinalizedBacklog(ctx, { markOnly: adopt });
		expect(calls).toEqual([["err-a"], ["err-b"]]);
		expect(children.every(c => c.committed)).toBe(true);
	});
});
