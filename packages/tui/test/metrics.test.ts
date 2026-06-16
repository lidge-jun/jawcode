import { describe, expect, it } from "bun:test";
import * as path from "node:path";
import {
	flushPerfEvents,
	isPerfJsonlFlushEnabled,
	isPerfMetricsEnabled,
	PERF_EVENT_SCHEMA,
	REPAINT_STORM_THRESHOLD,
	RenderMetrics,
	resolvePerfLogPath,
	serializePerfEvent,
} from "@jawcode-dev/tui/metrics";
import { getLogsDir } from "@jawcode-dev/utils";

describe("RenderMetrics", () => {
	it("is a no-op when disabled (negligible default overhead)", () => {
		const m = new RenderMetrics(false);
		expect(m.enabled).toBe(false);
		m.recordRequest("input");
		m.recordRender(5);
		m.recordFullRedraw("extraLines > height");
		m.sampleRss();
		m.setOwnerGauge("o", 3);
		m.setTimerGauge("t", 1);
		m.recordCounter("dynamic", "counter");
		m.recordEvent("dynamic", { value: 1 });
		const s = m.snapshot();
		expect(s.enabled).toBe(false);
		expect(s.renderCount).toBe(0);
		expect(s.fullRedrawCount).toBe(0);
		expect(Object.keys(s.requestSources)).toHaveLength(0);
		expect(s.rss.samples).toBe(0);
		expect(Object.keys(s.ownerGauges)).toHaveLength(0);
		expect(Object.keys(s.timerGauges)).toHaveLength(0);
		expect(s.counters).toEqual({});
		expect(s.eventsBuffered).toBe(0);
		expect(s.eventsDropped).toBe(0);
	});

	it("computes duration percentiles when enabled", () => {
		const m = new RenderMetrics(true);
		for (let i = 1; i <= 100; i++) m.recordRender(i);
		const s = m.snapshot();
		expect(s.renderCount).toBe(100);
		expect(s.renderDurations.count).toBe(100);
		expect(s.renderDurations.maxMs).toBe(100);
		expect(s.renderDurations.p50Ms).toBeGreaterThan(49);
		expect(s.renderDurations.p50Ms).toBeLessThan(52);
		expect(s.renderDurations.p95Ms).toBeGreaterThan(93);
		expect(s.renderDurations.p95Ms).toBeLessThanOrEqual(100);
	});
	it("resolves JWC_PERF and PI_TUI_METRICS through one enable helper", () => {
		expect(isPerfMetricsEnabled({})).toBe(false);
		expect(isPerfMetricsEnabled({ JWC_PERF: "1" })).toBe(true);
		expect(isPerfMetricsEnabled({ PI_TUI_METRICS: "1" })).toBe(true);
		expect(isPerfMetricsEnabled({ JWC_PERF: "0", PI_TUI_METRICS: "0" })).toBe(false);
		expect(isPerfJsonlFlushEnabled({})).toBe(false);
		expect(isPerfJsonlFlushEnabled({ JWC_PERF: "1" })).toBe(true);
		expect(isPerfJsonlFlushEnabled({ JWC_PERF_LOG: "/tmp/perf.jsonl" })).toBe(true);
		expect(isPerfJsonlFlushEnabled({ JWC_PERF_LOG: "" })).toBe(false);
		expect(isPerfJsonlFlushEnabled({ PI_TUI_METRICS: "1" })).toBe(false);
	});

	it("records counters and bounded event summaries when enabled", () => {
		const m = new RenderMetrics(true);
		m.recordCounter("tui.frame", "frame.count", 1);
		m.recordEvent("tui.preparedLine", { "normalize.hit": 0, "normalize.miss": 0 }, { placeholder: "true" });
		const s = m.snapshot();
		expect(s.counters["tui.frame.frame.count"]).toBe(1);
		expect(s.counters["tui.preparedLine.normalize.hit"]).toBe(0);
		expect(s.counters["tui.preparedLine.normalize.miss"]).toBe(0);
		expect(s.eventsBuffered).toBe(2);
		expect(s.eventsDropped).toBe(0);
	});

	it("serializes compact JSONL event rows and resolves override paths", async () => {
		const event = {
			schema: PERF_EVENT_SCHEMA,
			ts: new Date(0).toISOString(),
			source: "tui.frame",
			counters: { "frame.count": 1 },
		};
		const serialized = serializePerfEvent(event);
		expect(serialized).toBe(JSON.stringify(event));
		expect(serialized.includes("\n")).toBe(false);

		const override = path.join(process.cwd(), "tmp-perf.jsonl");
		expect(resolvePerfLogPath({ JWC_PERF_LOG: override })).toBe(override);
		expect(resolvePerfLogPath({})).toBe(path.join(getLogsDir(), "perf.jsonl"));

		const m = new RenderMetrics(true);
		m.recordCounter("tui.frame", "frame.count", 1);
		const tmpPath = path.join(process.cwd(), `.tmp-${Date.now()}-perf-events.jsonl`);
		try {
			await flushPerfEvents(m, tmpPath);
			const text = await Bun.file(tmpPath).text();
			expect(text.endsWith("\n")).toBe(true);
			expect(text.trim().split("\n")).toHaveLength(1);
		} finally {
			await Bun.file(tmpPath)
				.delete()
				.catch(() => {});
		}
	});

	it("attributes request sources", () => {
		const m = new RenderMetrics(true);
		m.recordRequest("input");
		m.recordRequest("input");
		m.recordRequest("resize");
		const s = m.snapshot();
		expect(s.requestSources.input).toBe(2);
		expect(s.requestSources.resize).toBe(1);
	});

	it("detects repaint storms from consecutive unexpected full redraws", () => {
		const m = new RenderMetrics(true);
		for (let i = 0; i < REPAINT_STORM_THRESHOLD; i++) {
			m.recordFullRedraw("extraLines > height");
			m.recordRender(1);
		}
		let s = m.snapshot();
		expect(s.maxConsecutiveFullRedraws).toBe(REPAINT_STORM_THRESHOLD);
		expect(s.repaintStorms).toBe(1);
		expect(s.fullRedrawCauses["extraLines > height"]).toBe(REPAINT_STORM_THRESHOLD);

		// A normal render with no preceding full redraw breaks the run.
		m.recordRender(1);
		s = m.snapshot();
		expect(s.maxConsecutiveFullRedraws).toBe(REPAINT_STORM_THRESHOLD);
	});

	it("does not count expected full redraws (resize/width/first) as storms", () => {
		const m = new RenderMetrics(true);
		for (let i = 0; i < REPAINT_STORM_THRESHOLD + 2; i++) {
			m.recordFullRedraw("terminal width changed");
			m.recordRender(1);
		}
		const s = m.snapshot();
		expect(s.fullRedrawCount).toBe(REPAINT_STORM_THRESHOLD + 2);
		expect(s.repaintStorms).toBe(0);
		expect(s.maxConsecutiveFullRedraws).toBe(0);
	});

	it("tracks RSS baseline/peak/growth and owner/timer gauges", () => {
		const m = new RenderMetrics(true);
		const first = m.sampleRss();
		m.sampleRss();
		expect(first).toBeGreaterThan(0);
		m.setOwnerGauge("transcript", 7);
		m.setTimerGauge("render", 1);
		const s = m.snapshot();
		expect(s.rss.samples).toBe(2);
		expect(s.rss.baselineBytes).not.toBeNull();
		expect(s.rss.growthBytes).toBeGreaterThanOrEqual(0);
		expect(s.ownerGauges.transcript).toBe(7);
		expect(s.timerGauges.render).toBe(1);
	});

	it("reset clears collected data but keeps enabled state", () => {
		const m = new RenderMetrics(true);
		m.recordRender(5);
		m.recordRequest("input");
		m.recordCounter("tui.frame", "frame.count", 1);
		m.recordEvent("tui.frame", { "frame.lines": 2 });
		m.reset();
		const s = m.snapshot();
		expect(s.renderCount).toBe(0);
		expect(Object.keys(s.requestSources)).toHaveLength(0);
		expect(s.counters).toEqual({});
		expect(s.eventsBuffered).toBe(0);
		expect(s.eventsDropped).toBe(0);
		expect(s.enabled).toBe(true);
	});
});
