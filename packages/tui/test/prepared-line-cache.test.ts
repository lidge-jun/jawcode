// MUST be first: pins terminal-capability env before @jawcode-dev/tui evaluates.
import "./render-goldens-env";
import { describe, expect, it } from "bun:test";
import { type Component, TUI, ViewportFill } from "@jawcode-dev/tui";
import { type PerfCounterEvent, renderMetrics } from "@jawcode-dev/tui/metrics";
import { VirtualTerminal } from "./virtual-terminal";

class StaticLines implements Component {
	#lines: string[];

	constructor(lines: string[]) {
		this.#lines = lines;
	}

	setLines(lines: string[]): void {
		this.#lines = lines;
	}

	render(_width: number): string[] {
		return this.#lines;
	}

	invalidate(): void {}
}

class ComposerStub implements Component {
	render(_width: number): string[] {
		return ["[status]", "> input"];
	}

	invalidate(): void {}
}

const FIXTURE_LINES = [
	"plain printable ascii",
	"\x1b[31mred ansi\x1b[0m",
	"\x1b]8;;https://example.test\x07osc8 link\x1b]8;;\x07 end",
	"wide 한글 😀 text",
	"combining e\u0301 mark",
	"tab\tseparated",
	"Thai normalization \u0e33 Lao \u0eb3",
	"this line is deliberately long enough to truncate at a narrow terminal width",
];

async function renderFixture(width = 32, height = 12): Promise<{ term: VirtualTerminal; tui: TUI }> {
	const term = new VirtualTerminal(width, height);
	const tui = new TUI(term);
	tui.addChild(new StaticLines(FIXTURE_LINES));
	tui.start();
	tui.requestRender(false, "prepared-cache-test");
	await term.waitForRender();
	return { term, tui };
}

async function renderAgain(term: VirtualTerminal, tui: TUI, force = false): Promise<void> {
	tui.requestRender(force, "prepared-cache-test");
	await term.waitForRender();
}

async function renderVisibleLines(lines: string[], width: number): Promise<string[]> {
	const term = new VirtualTerminal(width, Math.max(8, lines.length + 1));
	const tui = new TUI(term);
	tui.addChild(new StaticLines(lines));
	tui.start();
	try {
		tui.requestRender(false, "prepared-cache-visible");
		await term.waitForRender();
		return term.getViewport().slice(0, lines.length);
	} finally {
		tui.stop();
	}
}
function preparedRows(): PerfCounterEvent[] {
	return renderMetrics.events().filter(row => row.source === "tui.preparedLine" && row.labels?.owner === "render");
}

function lastPreparedRow(): PerfCounterEvent {
	const row = preparedRows().at(-1);
	expect(row).toBeDefined();
	return row!;
}

describe("prepared-line cache", () => {
	it("preserves rendered bytes and reports miss then hit rows", async () => {
		renderMetrics.reset();
		renderMetrics.enable();
		const { term, tui } = await renderFixture();
		try {
			const firstViewport = term.getViewport();
			const first = lastPreparedRow();
			expect(first.counters["normalize.miss"]).toBeGreaterThan(0);
			expect(first.counters["normalize.hit"]).toBe(0);

			await renderAgain(term, tui);
			const secondViewport = term.getViewport();
			const second = lastPreparedRow();

			expect(secondViewport).toEqual(firstViewport);
			expect(second.counters["normalize.hit"]).toBeGreaterThan(0);
			expect(second.counters["normalize.miss"]).toBe(0);
			expect(renderMetrics.snapshot().counters["tui.preparedLine.normalize.hit"]).toBeGreaterThan(0);
			expect(renderMetrics.snapshot().counters["tui.preparedLine.normalize.miss"]).toBeGreaterThan(0);
			expect(renderMetrics.snapshot().counters["tui.preparedLine.truncate.hit"]).toBeGreaterThan(0);
			expect(renderMetrics.snapshot().counters["tui.preparedLine.truncate.miss"]).toBeGreaterThan(0);
		} finally {
			tui.stop();
			renderMetrics.reset();
			renderMetrics.disable();
		}
	});

	it("clears cache on forced render and width change", async () => {
		renderMetrics.reset();
		renderMetrics.enable();
		const { term, tui } = await renderFixture();
		try {
			await renderAgain(term, tui);
			expect(lastPreparedRow().counters["normalize.hit"]).toBeGreaterThan(0);

			await renderAgain(term, tui, true);
			expect(lastPreparedRow().counters["normalize.miss"]).toBeGreaterThan(0);

			await renderAgain(term, tui);
			expect(lastPreparedRow().counters["normalize.hit"]).toBeGreaterThan(0);

			term.resize(40, 12);
			await term.waitForRender();
			expect(lastPreparedRow().counters["normalize.miss"]).toBeGreaterThan(0);
		} finally {
			tui.stop();
			renderMetrics.reset();
			renderMetrics.disable();
		}
	});

	it("starts a fresh cache for a new TUI after stop", async () => {
		renderMetrics.reset();
		renderMetrics.enable();
		const first = await renderFixture();
		first.tui.stop();

		const second = await renderFixture();
		try {
			expect(lastPreparedRow().counters["normalize.miss"]).toBeGreaterThan(0);
		} finally {
			second.tui.stop();
			renderMetrics.reset();
			renderMetrics.disable();
		}
	});

	it("uses the same preparation path for commitLines and normal render", async () => {
		renderMetrics.reset();
		renderMetrics.enable();
		const committedLines = [
			"\x1b[31mcommitted ansi\x1b[0m",
			"\x1b]8;;https://example.test/commit\x07committed osc8\x1b]8;;\x07 end",
			"committed wide 한글 and a deliberately long suffix that truncates",
		];
		const expectedVisible = await renderVisibleLines(committedLines, 40);
		const term = new VirtualTerminal(40, 12);
		const tui = new TUI(term);
		tui.addChild(new ViewportFill());
		tui.addChild(new StaticLines(["live-0", "live-1"]));
		tui.addChild(new ComposerStub());
		tui.start();
		try {
			tui.requestRender(false, "prepared-cache-commit-setup");
			await term.waitForRender();
			expect(tui.commitLines(committedLines)).toBe(true);
			await term.flush();

			const viewport = term.getViewport();
			expect(viewport.slice(5, 8)).toEqual(expectedVisible);
			const commitRows = renderMetrics
				.events()
				.filter(row => row.source === "tui.preparedLine" && row.labels?.owner === "commit");
			expect(commitRows.at(-1)?.counters["normalize.miss"]).toBeGreaterThan(0);
		} finally {
			tui.stop();
			renderMetrics.reset();
			renderMetrics.disable();
		}
	});
	it("keeps latest-window hits after streaming unique lines exceed the cache bound", async () => {
		renderMetrics.reset();
		renderMetrics.enable();
		const latestLines = Array.from({ length: 32 }, (_, index) => `latest-${index}`);
		const uniqueLines = Array.from({ length: 4200 }, (_, index) => `unique-${index}`);
		const term = new VirtualTerminal(80, 16);
		const component = new StaticLines(uniqueLines);
		const tui = new TUI(term);
		tui.addChild(component);
		tui.start();
		try {
			tui.requestRender(false, "prepared-cache-unique");
			await term.waitForRender();
			component.setLines(latestLines);
			await renderAgain(term, tui);
			expect(lastPreparedRow().counters["normalize.miss"]).toBeGreaterThan(0);
			await renderAgain(term, tui);
			expect(lastPreparedRow().counters["normalize.hit"]).toBeGreaterThan(0);
		} finally {
			tui.stop();
			renderMetrics.reset();
			renderMetrics.disable();
		}
	});
});
