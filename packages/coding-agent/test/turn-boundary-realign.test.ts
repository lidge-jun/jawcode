import { describe, expect, it } from "bun:test";
import { ViewportFill } from "@jawcode-dev/tui";
import type { InteractiveModeContext } from "../src/modes/types";
import {
	canMarkEntireBacklog,
	commitFinalizedBacklog,
	markPreambleCommitted,
	measureComposerClusterRows,
} from "../src/modes/utils/ui-helpers";

/**
 * 260702 F3 — turn-boundary realign wiring (coding-agent side).
 *
 * measureComposerClusterRows walks the REAL TUI child list below the live
 * tool container so anonymous members (the breathing-room Spacer) stay
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

describe("measureComposerClusterRows (260702 F3)", () => {
	it("sums the rendered rows of every component below the live tool container", () => {
		const liveToolContainer = fakeComponent(0);
		const ctx = {
			ui: {
				terminal: { columns: 80 },
				children: [fakeComponent(3), fakeComponent(40), liveToolContainer, fakeComponent(1), fakeComponent(2)],
			},
			liveToolContainer,
		} as unknown as InteractiveModeContext;
		expect(measureComposerClusterRows(ctx)).toBe(3);
	});

	it("returns -1 when the live tool container is not mounted on the UI", () => {
		const ctx = {
			ui: { terminal: { columns: 80 }, children: [fakeComponent(2)] },
			liveToolContainer: fakeComponent(0),
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
