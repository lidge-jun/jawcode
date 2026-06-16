import { describe, expect, it } from "bun:test";
import type { CompactionProgressUpdate } from "../../../src/extensibility/extensions/types";
import { CompactionProgressPresenter, formatCompactionLoaderLine } from "../../../src/modes/utils/compaction-progress";

function update(overrides: Partial<CompactionProgressUpdate>): CompactionProgressUpdate {
	return {
		phase: "preparing",
		percent: 0,
		segment: "setup_prepare",
		message: "Preparing compaction…",
		trigger: "manual",
		mode: "context-full",
		...overrides,
	};
}

describe("compaction progress formatting", () => {
	it("renders a bounded percent bar with the cancel hint", () => {
		const line = formatCompactionLoaderLine({
			prefix: "Compacting context",
			percent: 73,
			message: "Summarizing conversation while preserving recent turns",
			cancelHint: "(esc to cancel)",
			width: 80,
		});

		expect(line).toContain("Compacting context");
		expect(line).toContain("73%");
		expect(line).toContain("█");
		expect(line).toContain("░");
		expect(line).toContain("(esc to cancel)");
		expect(line.length).toBeLessThanOrEqual(80);
	});

	it("sanitizes tabs and truncates to the available width", () => {
		const line = formatCompactionLoaderLine({
			prefix: "Compact\tcontext",
			percent: 150,
			message: "Remote\tsummarization with a very long status message that must not overflow",
			cancelHint: "(esc)",
			width: 44,
		});

		expect(line).not.toContain("\t");
		expect(line).toContain("100%");
		expect(line.length).toBeLessThanOrEqual(44);
	});
});

describe("CompactionProgressPresenter", () => {
	it("never decreases visible progress across boundary updates", () => {
		const messages: string[] = [];
		const presenter = new CompactionProgressPresenter({
			setMessage: message => messages.push(message),
			getWidth: () => 90,
			prefix: "Compacting context",
			cancelHint: "(esc to cancel)",
		});

		presenter.update(update({ phase: "summarizing_history", percent: 60, segment: "local_summary" }));
		presenter.update(update({ phase: "summarizing_short", percent: 40, segment: "short_summary" }));
		presenter.stop();

		const finalPercent = Number(messages.at(-1)?.match(/(\d+)%/)?.[1]);
		expect(finalPercent).toBeGreaterThanOrEqual(60);
	});
	it("renders cancellation at the terminal boundary and ignores later updates", () => {
		const messages: string[] = [];
		const presenter = new CompactionProgressPresenter({
			setMessage: message => messages.push(message),
			getWidth: () => 90,
			prefix: "Compacting context",
			cancelHint: "(esc to cancel)",
		});

		presenter.update(update({ phase: "summarizing_history", percent: 60, segment: "local_summary" }));
		presenter.update(
			update({ phase: "cancelled", percent: 0, segment: "terminal", message: "Compaction cancelled" }),
		);
		const terminalMessage = messages.at(-1);
		presenter.update(
			update({ phase: "completed", percent: 100, segment: "terminal", message: "Compaction complete" }),
		);

		expect(terminalMessage).toContain("0%");
		expect(terminalMessage).toContain("Compaction cancelled");
		expect(messages.at(-1)).toBe(terminalMessage);
	});
	it("renders failure at the terminal boundary and ignores later updates", () => {
		const messages: string[] = [];
		const presenter = new CompactionProgressPresenter({
			setMessage: message => messages.push(message),
			getWidth: () => 90,
			prefix: "Auto-compacting context",
			cancelHint: "(esc to cancel)",
		});

		presenter.update(update({ phase: "summarizing_history", percent: 74, segment: "local_summary" }));
		presenter.update(update({ phase: "failed", percent: 0, segment: "terminal", message: "Compaction failed" }));
		const terminalMessage = messages.at(-1);
		presenter.update(
			update({ phase: "completed", percent: 100, segment: "terminal", message: "Compaction complete" }),
		);

		expect(terminalMessage).toContain("0%");
		expect(terminalMessage).toContain("Compaction failed");
		expect(messages.at(-1)).toBe(terminalMessage);
	});

	it("renders terminal completion as 100 percent", () => {
		const messages: string[] = [];
		const presenter = new CompactionProgressPresenter({
			setMessage: message => messages.push(message),
			getWidth: () => 90,
			prefix: "Auto-compacting context",
			cancelHint: "(esc to background)",
		});

		presenter.update(
			update({ phase: "completed", percent: 100, segment: "terminal", message: "Compaction complete" }),
		);
		presenter.stop();

		expect(messages.at(-1)).toContain("100%");
		expect(messages.at(-1)).toContain("Compaction complete");
	});
});
