/**
 * The OTLP logger must be bound to the provider JWC actually configured.
 *
 * `logs.setGlobalLoggerProvider()` is a no-op when a global provider is
 * already registered — it returns the EXISTING one instead of installing
 * ours. Reading the logger back through `logs.getLogger()` therefore returns a
 * logger attached to whatever was registered first, so JWC's exporter,
 * resource and batch processor are bypassed and the logs go somewhere else (or
 * nowhere). Taking the logger from our own provider keeps the binding
 * unambiguous.
 *
 * An embedder that sets up OpenTelemetry before creating a session — which is
 * the normal order — hits exactly this.
 */
import { describe, expect, it } from "bun:test";
import { logs } from "@opentelemetry/api-logs";
import { LoggerProvider } from "@opentelemetry/sdk-logs";

describe("global logger provider binding", () => {
	it("ignores a later setGlobalLoggerProvider once one is registered", () => {
		const first = new LoggerProvider({});
		const second = new LoggerProvider({});

		logs.setGlobalLoggerProvider(first);
		const returned = logs.setGlobalLoggerProvider(second);

		// The second registration does not win. This is the whole hazard: code
		// that calls setGlobal and then reads back through logs.getLogger() gets a
		// logger from `first`, not from the provider it just built.
		expect(returned).toBe(first);
		expect(logs.getLoggerProvider()).toBe(first);
	});

	it("takes the OTLP logger from JWC's own provider rather than the global", async () => {
		// Source-shape pin: the runtime path needs live OTLP config to execute, so
		// this asserts the binding it uses.
		const source = await Bun.file(new URL("../src/telemetry-export.ts", import.meta.url).pathname).text();
		const bindingLine = source.split("\n").find(line => line.includes("otelLogger =") && line.includes("getLogger("));

		expect(bindingLine).toBeDefined();
		expect(bindingLine).toContain("logProvider.getLogger(");
		expect(bindingLine).not.toContain("logs.getLogger(");
	});
});
