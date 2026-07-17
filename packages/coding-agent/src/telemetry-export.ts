/** OTLP trace, log, and metric export bootstrap for the JWC CLI host. */
import type {
	AgentRunCoverage,
	AgentRunSummary,
	AgentTelemetryConfig,
	AgentTelemetryWarning,
	ChatUsageEvent,
	ToolStatus,
} from "@jawcode-dev/agent-core";
import { logger, postmortem } from "@jawcode-dev/utils";
import {
	type Attributes,
	type AttributeValue,
	type Counter,
	context,
	type Histogram,
	type Meter,
	metrics,
} from "@opentelemetry/api";
import { type LogAttributes, logs, type Logger as OtelLogger, SeverityNumber } from "@opentelemetry/api-logs";
import { AsyncLocalStorageContextManager } from "@opentelemetry/context-async-hooks";
import { OTLPLogExporter } from "@opentelemetry/exporter-logs-otlp-proto";
import { OTLPMetricExporter } from "@opentelemetry/exporter-metrics-otlp-proto";
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-proto";
import { resourceFromAttributes } from "@opentelemetry/resources";
import { BatchLogRecordProcessor, LoggerProvider } from "@opentelemetry/sdk-logs";
import { MeterProvider, PeriodicExportingMetricReader } from "@opentelemetry/sdk-metrics";
import { BatchSpanProcessor } from "@opentelemetry/sdk-trace-base";
import { NodeTracerProvider } from "@opentelemetry/sdk-trace-node";

const FLUSH_INTERVAL_MS = 30_000;
const SERVICE_NAME = "jawcode";

type TelemetrySignal = "trace" | "log" | "metric";
type OtelLogLevel = "none" | logger.LogLevel;

interface SignalConfig {
	readonly trace: boolean;
	readonly log: boolean;
	readonly metric: boolean;
}

const LOG_SEVERITY: Record<logger.LogLevel, SeverityNumber> = {
	error: SeverityNumber.ERROR,
	warn: SeverityNumber.WARN,
	info: SeverityNumber.INFO,
	debug: SeverityNumber.DEBUG,
};

const LOG_LEVEL_WEIGHT: Record<logger.LogLevel, number> = { error: 0, warn: 1, info: 2, debug: 3 };
const TOOL_STATUSES = ["ok", "error", "skipped", "blocked", "timeout", "aborted"] satisfies readonly ToolStatus[];

let traceProvider: NodeTracerProvider | undefined;
let logProvider: LoggerProvider | undefined;
let meterProvider: MeterProvider | undefined;
let metricRecorder: AgentMetricRecorder | undefined;
let otelLogger: OtelLogger | undefined;
let unregisterLogSink: (() => void) | undefined;
let initPromise: Promise<void> | undefined;

export function isTelemetryExportEnabled(): boolean {
	return Boolean(traceProvider || logProvider || meterProvider);
}

export function createTelemetryExportConfig(
	config: AgentTelemetryConfig | undefined,
): AgentTelemetryConfig | undefined {
	if (!isTelemetryExportEnabled()) return config;
	return {
		...config,
		onChatUsage: event => {
			config?.onChatUsage?.(event);
			metricRecorder?.recordChatUsage(event);
		},
		onRunEnd: (summary, coverage) => {
			config?.onRunEnd?.(summary, coverage);
			metricRecorder?.recordRun(summary, coverage);
			emitRunSummaryLog(summary, coverage);
		},
		onTelemetryWarning: warning => {
			config?.onTelemetryWarning?.(warning);
			emitTelemetryWarningLog(warning);
		},
	};
}

export async function initTelemetryExport(): Promise<void> {
	if (isTelemetryExportEnabled()) return;
	if (initPromise) return initPromise;
	if (process.env.OTEL_SDK_DISABLED?.trim().toLowerCase() === "true") return;

	const signals = resolveSignalConfig();
	if (!signals.trace && !signals.log && !signals.metric) return;
	initPromise = registerProviders(signals);
	return initPromise;
}

async function registerProviders(signals: SignalConfig): Promise<void> {
	const resource = resourceFromAttributes({
		"service.name": process.env.OTEL_SERVICE_NAME ?? SERVICE_NAME,
	});

	if (signals.trace) {
		traceProvider = new NodeTracerProvider({
			resource,
			spanProcessors: [new BatchSpanProcessor(new OTLPTraceExporter())],
		});
		traceProvider.register({ contextManager: new AsyncLocalStorageContextManager().enable() });
	}

	if (signals.metric) {
		meterProvider = new MeterProvider({
			resource,
			readers: [new PeriodicExportingMetricReader({ exporter: new OTLPMetricExporter() })],
		});
		metrics.setGlobalMeterProvider(meterProvider);
		metricRecorder = new AgentMetricRecorder(metrics.getMeter("@jawcode-dev/coding-agent"));
	}

	if (signals.log) {
		logProvider = new LoggerProvider({
			resource,
			processors: [new BatchLogRecordProcessor(new OTLPLogExporter())],
		});
		logs.setGlobalLoggerProvider(logProvider);
		otelLogger = logs.getLogger("@jawcode-dev/coding-agent");
		unregisterLogSink = logger.registerLogSink(event => {
			emitOtelLog(event.level, event.message, logAttributesFromContext(event.context), "jwc.log", event.timestamp);
		});
	}

	const flushTimer = setInterval(() => void flushTelemetryExport().catch(() => {}), FLUSH_INTERVAL_MS);
	flushTimer.unref();
	postmortem.register("otel-export", async () => {
		clearInterval(flushTimer);
		unregisterLogSink?.();
		unregisterLogSink = undefined;
		const shutdowns: Promise<void>[] = [];
		if (traceProvider) shutdowns.push(traceProvider.shutdown());
		if (logProvider) shutdowns.push(logProvider.shutdown());
		if (meterProvider) shutdowns.push(meterProvider.shutdown());
		await Promise.all(shutdowns);
	});
}

function resolveSignalConfig(): SignalConfig {
	return {
		trace: signalEnabled(
			"trace",
			process.env.OTEL_EXPORTER_OTLP_TRACES_ENDPOINT ?? process.env.OTEL_EXPORTER_OTLP_ENDPOINT,
			process.env.OTEL_TRACES_EXPORTER,
			process.env.OTEL_EXPORTER_OTLP_TRACES_PROTOCOL ?? process.env.OTEL_EXPORTER_OTLP_PROTOCOL,
		),
		log: signalEnabled(
			"log",
			process.env.OTEL_EXPORTER_OTLP_LOGS_ENDPOINT ?? process.env.OTEL_EXPORTER_OTLP_ENDPOINT,
			process.env.OTEL_LOGS_EXPORTER,
			process.env.OTEL_EXPORTER_OTLP_LOGS_PROTOCOL ?? process.env.OTEL_EXPORTER_OTLP_PROTOCOL,
		),
		metric: signalEnabled(
			"metric",
			process.env.OTEL_EXPORTER_OTLP_METRICS_ENDPOINT ?? process.env.OTEL_EXPORTER_OTLP_ENDPOINT,
			process.env.OTEL_METRICS_EXPORTER,
			process.env.OTEL_EXPORTER_OTLP_METRICS_PROTOCOL ?? process.env.OTEL_EXPORTER_OTLP_PROTOCOL,
		),
	};
}

function signalEnabled(
	signal: TelemetrySignal,
	endpoint: string | undefined,
	exporterSelection: string | undefined,
	protocolSelection: string | undefined,
): boolean {
	if (exporterSelection?.split(",").some(entry => entry.trim().toLowerCase() === "none")) return false;
	if (!endpoint) return false;
	const protocol = protocolSelection?.trim().toLowerCase();
	if (protocol && protocol !== "http/protobuf") {
		logger.warn(`OTEL ${signal} export disabled: unsupported protocol`, { protocol, supported: "http/protobuf" });
		return false;
	}
	return true;
}

class AgentMetricRecorder {
	readonly #tokenUsage: Histogram<Attributes>;
	readonly #chatCostUsd: Counter<Attributes>;
	readonly #runs: Counter<Attributes>;
	readonly #steps: Counter<Attributes>;
	readonly #chatCalls: Counter<Attributes>;
	readonly #chatDurationMs: Histogram<Attributes>;
	readonly #toolCalls: Counter<Attributes>;
	readonly #toolDurationMs: Histogram<Attributes>;
	readonly #errors: Counter<Attributes>;

	constructor(meter: Meter) {
		this.#tokenUsage = meter.createHistogram("gen_ai.client.token.usage", { unit: "{token}" });
		this.#chatCostUsd = meter.createCounter("jwc.agent.chat.cost.estimated_usd", { unit: "USD" });
		this.#runs = meter.createCounter("jwc.agent.runs", { unit: "{run}" });
		this.#steps = meter.createCounter("jwc.agent.steps", { unit: "{step}" });
		this.#chatCalls = meter.createCounter("jwc.agent.chat.calls", { unit: "{call}" });
		this.#chatDurationMs = meter.createHistogram("jwc.agent.chat.duration", { unit: "ms" });
		this.#toolCalls = meter.createCounter("jwc.agent.tool.calls", { unit: "{call}" });
		this.#toolDurationMs = meter.createHistogram("jwc.agent.tool.duration", { unit: "ms" });
		this.#errors = meter.createCounter("jwc.agent.errors", { unit: "{error}" });
	}

	recordChatUsage(event: ChatUsageEvent): void {
		const attrs = metricAttributes({
			"gen_ai.operation.name": "chat",
			"gen_ai.provider.name": event.provider,
			"gen_ai.request.model": event.model,
			"gen_ai.response.service_tier": event.serviceTier,
			"jwc.agent.id": event.agent?.id,
			"jwc.agent.name": event.agent?.name,
		});
		this.#recordToken(event.usage.inputTokens, attrs, "input");
		this.#recordToken(event.usage.outputTokens, attrs, "output");
		this.#recordToken(event.usage.totalTokens, attrs, "total");
		this.#recordToken(event.usage.cachedInputTokens, attrs, "cache_read_input");
		this.#recordToken(event.usage.cacheWriteTokens, attrs, "cache_write_input");
		this.#recordToken(event.usage.reasoningOutputTokens, attrs, "reasoning_output");
		if (event.cost && "usd" in event.cost && event.cost.usd > 0) this.#chatCostUsd.add(event.cost.usd, attrs);
	}

	recordRun(summary: AgentRunSummary, coverage: AgentRunCoverage): void {
		const attrs = metricAttributes({
			"jwc.models_used.count": coverage.modelsUsed.length,
			"jwc.providers_used.count": coverage.providersUsed.length,
			"jwc.tools_available.count": coverage.toolsAvailable.length,
			"jwc.tools_invoked.count": coverage.toolsInvoked.length,
		});
		this.#runs.add(1, attrs);
		if (summary.stepCount > 0) this.#steps.add(summary.stepCount, attrs);
		if (summary.chats.total > 0) this.#chatCalls.add(summary.chats.total, attrs);
		if (summary.chats.totalLatencyMs > 0) this.#chatDurationMs.record(summary.chats.totalLatencyMs, attrs);
		if (summary.tools.total > 0) this.#toolCalls.add(summary.tools.total, attrs);
		if (summary.tools.totalLatencyMs > 0) this.#toolDurationMs.record(summary.tools.totalLatencyMs, attrs);
		if (summary.errors.total > 0) this.#errors.add(summary.errors.total, attrs);

		for (const toolName in summary.tools.byName) {
			const counters = summary.tools.byName[toolName];
			const toolAttrs = metricAttributes({ ...attrs, "gen_ai.tool.name": toolName });
			for (const status of TOOL_STATUSES) {
				const count = counters[status];
				if (count > 0) this.#toolCalls.add(count, metricAttributes({ ...toolAttrs, "jwc.tool.status": status }));
			}
		}
	}

	#recordToken(value: number | undefined, attrs: Attributes, type: string): void {
		if (value && value > 0) this.#tokenUsage.record(value, metricAttributes({ ...attrs, "gen_ai.token.type": type }));
	}
}

function metricAttributes(fields: Readonly<Record<string, unknown>>): Attributes {
	const out: Attributes = {};
	for (const key in fields) {
		const value = fields[key];
		if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") out[key] = value;
	}
	return out;
}

function emitRunSummaryLog(summary: AgentRunSummary, coverage: AgentRunCoverage): void {
	emitOtelLog(
		"info",
		"agent run completed",
		logAttributesFromContext({
			"jwc.agent.step_count": summary.stepCount,
			"jwc.agent.chats.total": summary.chats.total,
			"jwc.agent.tools.total": summary.tools.total,
			"jwc.agent.usage.total_tokens": summary.usage.totalTokens,
			"jwc.agent.cost.estimated_usd": summary.cost.estimatedUsd,
			"jwc.agent.errors.total": summary.errors.total,
			"jwc.agent.coverage.tools_invoked": coverage.toolsInvoked.join(","),
			"jwc.agent.coverage.models_used": coverage.modelsUsed.join(","),
			"jwc.agent.coverage.providers_used": coverage.providersUsed.join(","),
		}),
		"jwc.agent.run.completed",
	);
}

function emitTelemetryWarningLog(warning: AgentTelemetryWarning): void {
	emitOtelLog(
		"warn",
		warning.message,
		logAttributesFromContext({ code: warning.code, error: warning.error }),
		"jwc.telemetry.warning",
	);
}

function emitOtelLog(
	level: logger.LogLevel,
	body: string,
	attributes: LogAttributes,
	eventName: string,
	timestamp = new Date(),
): void {
	if (!otelLogger) return;
	const minLevel = parseOtelLogLevel(process.env.OTEL_LOG_LEVEL);
	if (minLevel === "none" || LOG_LEVEL_WEIGHT[level] > LOG_LEVEL_WEIGHT[minLevel]) return;
	otelLogger.emit({
		eventName,
		timestamp,
		observedTimestamp: new Date(),
		severityNumber: LOG_SEVERITY[level],
		severityText: level.toUpperCase(),
		body,
		attributes,
		context: context.active(),
	});
}

function parseOtelLogLevel(raw: string | undefined): OtelLogLevel {
	switch (raw?.trim().toLowerCase()) {
		case "none":
		case "error":
		case "debug":
			return raw.trim().toLowerCase() as OtelLogLevel;
		case "warn":
		case "warning":
			return "warn";
		default:
			return "info";
	}
}

function logAttributesFromContext(input: Record<string, unknown> | undefined): LogAttributes {
	const out: LogAttributes = { "process.pid": process.pid };
	if (!input) return out;
	for (const key in input) {
		const value = logAttributeValue(input[key]);
		if (value !== undefined) out[key] = value;
	}
	return out;
}

function logAttributeValue(value: unknown): AttributeValue | undefined {
	if (value === undefined || value === null) return undefined;
	if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") return value;
	if (value instanceof Error) return `${value.name}: ${value.message}`;
	try {
		return JSON.stringify(value);
	} catch {
		return String(value);
	}
}

export async function flushTelemetryExport(): Promise<void> {
	const flushes: Promise<void>[] = [];
	if (traceProvider) flushes.push(traceProvider.forceFlush());
	if (logProvider) flushes.push(logProvider.forceFlush());
	if (meterProvider) flushes.push(meterProvider.forceFlush());
	await Promise.all(flushes);
}
