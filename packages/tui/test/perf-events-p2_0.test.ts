// MUST be first: pins terminal-capability env before @gajae-code/tui evaluates.
import "./render-goldens-env";
import { describe, expect, it } from "bun:test";
import * as path from "node:path";
import { Text, TUI } from "@gajae-code/tui";
import { renderMetrics } from "@gajae-code/tui/metrics";
import { VirtualTerminal } from "./virtual-terminal";

function tempPath(name: string): string {
	return path.join(process.cwd(), `.tmp-${Date.now()}-${Math.random().toString(36).slice(2)}-${name}.jsonl`);
}

async function renderOnce(tui: TUI, term: VirtualTerminal): Promise<void> {
	tui.addChild(new Text("perf events fixture", 1, 0));
	tui.requestRender(true, "perf-events-test");
	await term.waitForRender();
}

function parseRows(text: string): Array<{
	schema: string;
	ts: string;
	source: string;
	counters: Record<string, number>;
	labels?: Record<string, string>;
}> {
	return text
		.trim()
		.split("\n")
		.filter(Boolean)
		.map(line => JSON.parse(line));
}

async function withPerfLog<T>(filePath: string, fn: () => Promise<T>): Promise<T> {
	const previousLog = process.env.JWC_PERF_LOG;
	const previousPerf = process.env.JWC_PERF;
	process.env.JWC_PERF_LOG = filePath;
	delete process.env.JWC_PERF;
	try {
		return await fn();
	} finally {
		if (previousLog === undefined) delete process.env.JWC_PERF_LOG;
		else process.env.JWC_PERF_LOG = previousLog;
		if (previousPerf === undefined) delete process.env.JWC_PERF;
		else process.env.JWC_PERF = previousPerf;
	}
}

describe("P2.0a perf event JSONL", () => {
	it("flushes real TUI render-path rows from TUI.stop", async () => {
		const filePath = tempPath("tui-stop");
		await withPerfLog(filePath, async () => {
			renderMetrics.reset();
			renderMetrics.enable();
			const term = new VirtualTerminal(80, 20);
			const tui = new TUI(term);
			tui.start();
			try {
				await renderOnce(tui, term);
			} finally {
				tui.stop();
				tui.stop();
				renderMetrics.disable();
			}
		});

		try {
			const rows = parseRows(await Bun.file(filePath).text());
			expect(rows.length).toBeGreaterThanOrEqual(5);
			for (const row of rows) {
				expect(row.schema).toBe("jwc.perf-events/1");
				expect(Number.isNaN(Date.parse(row.ts))).toBe(false);
				expect(typeof row.source).toBe("string");
				expect(row.counters).toBeDefined();
			}

			const countRows = rows.filter(row => row.source === "tui.frame" && row.counters["frame.count"] === 1);
			const lineRows = rows.filter(
				row => row.source === "tui.frame" && typeof row.counters["frame.lines"] === "number",
			);
			expect(countRows).toHaveLength(1);
			expect(lineRows).toHaveLength(1);
			const emittedPlaceholderRows = rows.filter(
				row =>
					row.source === "tui.frame" &&
					row.counters["frame.emittedLines"] === 0 &&
					row.labels?.placeholder === "true",
			);
			expect(emittedPlaceholderRows).toHaveLength(1);
			const preparedRows = rows.filter(
				row =>
					row.source === "tui.preparedLine" &&
					typeof row.counters["normalize.hit"] === "number" &&
					typeof row.counters["normalize.miss"] === "number" &&
					typeof row.counters["truncate.hit"] === "number" &&
					typeof row.counters["truncate.miss"] === "number" &&
					row.labels?.owner === "render",
			);
			expect(preparedRows).toHaveLength(1);
			const textPlaceholderRows = rows.filter(
				row =>
					row.source === "tui.text" &&
					row.counters["wrap.calls"] === 0 &&
					row.counters["visibleWidth.calls"] === 0 &&
					row.labels?.placeholder === "true",
			);
			expect(textPlaceholderRows).toHaveLength(1);
		} finally {
			await Bun.file(filePath)
				.delete()
				.catch(() => {});
			renderMetrics.reset();
			renderMetrics.disable();
		}
	});

	it("does not auto-flush when only programmatically enabled", async () => {
		const filePath = tempPath("programmatic-only");
		await Bun.write(filePath, "seed\n");
		const previousLog = process.env.JWC_PERF_LOG;
		const previousPerf = process.env.JWC_PERF;
		delete process.env.JWC_PERF_LOG;
		delete process.env.JWC_PERF;
		renderMetrics.reset();
		renderMetrics.enable();
		const term = new VirtualTerminal(80, 20);
		const tui = new TUI(term);
		tui.start();
		try {
			await renderOnce(tui, term);
			tui.stop();
			expect(renderMetrics.snapshot().eventsBuffered).toBeGreaterThan(0);
			expect(await Bun.file(filePath).text()).toBe("seed\n");
		} finally {
			await Bun.file(filePath)
				.delete()
				.catch(() => {});
			renderMetrics.reset();
			renderMetrics.disable();
			if (previousLog === undefined) delete process.env.JWC_PERF_LOG;
			else process.env.JWC_PERF_LOG = previousLog;
			if (previousPerf === undefined) delete process.env.JWC_PERF;
			else process.env.JWC_PERF = previousPerf;
		}
	});
	it("does not auto-flush for PI_TUI_METRICS-only compatibility collection", async () => {
		const filePath = tempPath("compat-only");
		await Bun.write(filePath, "seed\n");
		const previousLog = process.env.JWC_PERF_LOG;
		const previousPerf = process.env.JWC_PERF;
		const previousCompat = process.env.PI_TUI_METRICS;
		delete process.env.JWC_PERF_LOG;
		delete process.env.JWC_PERF;
		process.env.PI_TUI_METRICS = "1";
		renderMetrics.reset();
		renderMetrics.enable();
		const term = new VirtualTerminal(80, 20);
		const tui = new TUI(term);
		tui.start();
		try {
			await renderOnce(tui, term);
			tui.stop();
			expect(renderMetrics.snapshot().eventsBuffered).toBeGreaterThan(0);
			expect(await Bun.file(filePath).text()).toBe("seed\n");
		} finally {
			await Bun.file(filePath)
				.delete()
				.catch(() => {});
			renderMetrics.reset();
			renderMetrics.disable();
			if (previousLog === undefined) delete process.env.JWC_PERF_LOG;
			else process.env.JWC_PERF_LOG = previousLog;
			if (previousPerf === undefined) delete process.env.JWC_PERF;
			else process.env.JWC_PERF = previousPerf;
			if (previousCompat === undefined) delete process.env.PI_TUI_METRICS;
			else process.env.PI_TUI_METRICS = previousCompat;
		}
	});

	it("disabled metrics append zero bytes to an isolated perf log", async () => {
		const filePath = tempPath("disabled");
		await Bun.write(filePath, "seed\n");
		await withPerfLog(filePath, async () => {
			renderMetrics.reset();
			renderMetrics.disable();
			const term = new VirtualTerminal(80, 20);
			const tui = new TUI(term);
			tui.start();
			try {
				await renderOnce(tui, term);
			} finally {
				tui.stop();
			}
		});

		try {
			expect(await Bun.file(filePath).text()).toBe("seed\n");
		} finally {
			await Bun.file(filePath)
				.delete()
				.catch(() => {});
			renderMetrics.reset();
			renderMetrics.disable();
		}
	});
});
