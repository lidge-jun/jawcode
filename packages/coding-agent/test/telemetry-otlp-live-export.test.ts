/**
 * Live OTLP probe: do JWC's logs actually reach a collector?
 *
 * The card that deferred this residual asked for a live collector probe rather
 * than a blind port of upstream's patch, because the failure mode — a logger
 * bound to the wrong provider — is invisible to any source-level check. A real
 * `Bun.serve` endpoint receiving a real OTLP POST is the only thing that
 * settles it.
 *
 * Runs in a child process: telemetry init is global and one-shot.
 */
import { afterAll, describe, expect, it } from "bun:test";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";

// A `finally` is skipped when bun kills the runner on its own timeout, which
// this test can hit while the exporter retries. Sweep at the end so a failed
// run never leaves a stray directory in the source tree.
const tempDirs = new Set<string>();
afterAll(() => {
	for (const dir of tempDirs) fs.rmSync(dir, { force: true, recursive: true });
	tempDirs.clear();
});

describe("OTLP log export reaches a collector", () => {
	// Spawning a child that initializes telemetry and flushes over HTTP costs a
	// few seconds; bun's default per-test timeout is 5s.
	it("delivers a log record to a live endpoint", async () => {
		const received: { pathname: string; bytes: number }[] = [];
		const collector = Bun.serve({
			hostname: "127.0.0.1",
			port: 0,
			async fetch(req) {
				const url = new URL(req.url);
				const body = await req.arrayBuffer();
				if (body.byteLength > 0) received.push({ pathname: url.pathname, bytes: body.byteLength });
				return new Response("{}", { status: 200, headers: { "content-type": "application/json" } });
			},
		});

		// Probe script lives in the repo: from an unrelated cwd Bun resolves the
		// published package out of the install cache instead of this worktree.
		const dir = fs.mkdtempSync(path.join(import.meta.dir, ".tmp-otlp-"));
		tempDirs.add(dir);
		try {
			const scriptPath = path.join(dir, "probe.ts");
			fs.writeFileSync(
				scriptPath,
				[
					`import { initTelemetryExport, flushTelemetryExport } from "../../src/telemetry-export";`,
					`import { logger } from "@jawcode-dev/utils";`,
					`await initTelemetryExport();`,
					`logger.warn("otlp-live-probe", { probe: true });`,
					`await flushTelemetryExport();`,
				].join("\n"),
			);
			const result = Bun.spawnSync({
				cmd: [process.execPath, scriptPath],
				cwd: path.join(import.meta.dir, ".."),
				env: {
					HOME: os.homedir(),
					PATH: Bun.env.PATH ?? "",
					// Only the logs endpoint, so trace/metric providers stay out of the
					// way. `http/protobuf` is the sole protocol `signalEnabled` accepts.
					OTEL_EXPORTER_OTLP_LOGS_ENDPOINT: `http://127.0.0.1:${collector.port}`,
					OTEL_EXPORTER_OTLP_PROTOCOL: "http/protobuf",
				},
				stdout: "pipe",
				stderr: "pipe",
			});
			// Give the exporter's in-flight POST a moment to land.
			await Bun.sleep(300);
			if (result.exitCode !== 0) {
				throw new Error(`${new TextDecoder().decode(result.stdout)}\n${new TextDecoder().decode(result.stderr)}`);
			}
		} finally {
			collector.stop(true);
			fs.rmSync(dir, { force: true, recursive: true });
			tempDirs.delete(dir);
		}

		// The exporter POSTs to the configured logs endpoint as given, so the path
		// is whatever the endpoint says — asserting a suffix here would be
		// asserting the SDK's URL joining, not JWC's delivery. What matters is
		// that a non-empty OTLP body actually arrived.
		expect(received.length).toBeGreaterThan(0);
		expect(received[0]?.bytes).toBeGreaterThan(0);
	}, 30_000);
});
