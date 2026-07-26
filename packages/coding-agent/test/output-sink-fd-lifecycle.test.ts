import { afterEach, describe, expect, test, vi } from "bun:test";
import * as fs from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";
import { Settings } from "../src/config/settings";
import * as evalIndex from "../src/eval";
import { DEFAULT_MAX_BYTES, OutputSink } from "../src/session/streaming-output";
import type { ToolSession } from "../src/tools";
import { EvalTool } from "../src/tools/eval";

const createdTempDirs: string[] = [];

async function createTempDir(): Promise<string> {
	const dir = await fs.mkdtemp(path.join(os.tmpdir(), "output-sink-fd-"));
	createdTempDirs.push(dir);
	return dir;
}

afterEach(async () => {
	vi.restoreAllMocks();
	for (const dir of createdTempDirs.splice(0)) {
		await fs.rm(dir, { recursive: true, force: true });
	}
});

function spill(sink: OutputSink, marker = "x"): void {
	sink.push(`${marker.repeat(64)}\n`);
}

function makeEvalSession(artifactPath: string): ToolSession {
	return {
		cwd: path.dirname(artifactPath),
		hasUI: false,
		getSessionFile: () => null,
		getSessionSpawns: () => null,
		allocateOutputArtifact: async () => ({ id: "eval-artifact", path: artifactPath }),
		settings: Settings.isolated(),
	};
}

function installCountingFileSink(): { endCalls: () => number; written: () => string } {
	let closed = 0;
	let output = "";
	vi.spyOn(Bun, "file").mockImplementation(() => {
		const fileSink = {
			write: (chunk: string | Uint8Array) => {
				output += typeof chunk === "string" ? chunk : new TextDecoder().decode(chunk);
				return chunk.length;
			},
			end: async () => {
				closed += 1;
			},
		};
		return { writer: () => fileSink } as unknown as Bun.BunFile;
	});
	return { endCalls: () => closed, written: () => output };
}

describe("OutputSink descriptor lifecycle", () => {
	test("dispose closes a spilled artifact on an error path without dump", async () => {
		const dir = await createTempDir();
		const sentinel = path.join(dir, "sentinel.txt");
		await Bun.write(sentinel, "readable");

		for (let i = 0; i < 256; i++) {
			const artifactPath = path.join(dir, `spill-${i}.txt`);
			const sink = new OutputSink({ artifactPath, artifactId: `artifact-${i}`, spillThreshold: 16 });
			spill(sink);
			await sink.dispose();
			expect(await Bun.file(artifactPath).text()).toContain("x".repeat(64));
			expect(await Bun.file(sentinel).text()).toBe("readable");
		}
	});

	test("dispose finalizes before awaiting creation and ignores late pushes", async () => {
		const dir = await createTempDir();
		const artifactPath = path.join(dir, "spill.txt");
		const sink = new OutputSink({ artifactPath, artifactId: "late", spillThreshold: 16 });
		spill(sink, "a");

		const disposal = sink.dispose();
		sink.push(`${"b".repeat(64)}\n`);
		await disposal;
		await sink.dispose();

		const content = await Bun.file(artifactPath).text();
		expect(content).toContain("a".repeat(64));
		expect(content).not.toContain("b".repeat(64));
	});

	test("dump and dispose are idempotent in either order", async () => {
		const dir = await createTempDir();
		const firstPath = path.join(dir, "dump-first.txt");
		const dumpFirst = new OutputSink({ artifactPath: firstPath, artifactId: "dump-first", spillThreshold: 16 });
		spill(dumpFirst);
		const firstSummary = await dumpFirst.dump();
		await dumpFirst.dump();
		await dumpFirst.dispose();
		expect(firstSummary.artifactId).toBe("dump-first");
		expect(firstSummary.output).toContain("x".repeat(15));

		const secondPath = path.join(dir, "dispose-first.txt");
		const disposeFirst = new OutputSink({
			artifactPath: secondPath,
			artifactId: "dispose-first",
			spillThreshold: 16,
		});
		spill(disposeFirst);
		await disposeFirst.dispose();
		const secondSummary = await disposeFirst.dump();
		expect(secondSummary.artifactId).toBe("dispose-first");
		expect(secondSummary.output).toBe(firstSummary.output);
		expect(await Bun.file(secondPath).text()).toBe(await Bun.file(firstPath).text());
	});

	test("repeated dump failures close each underlying sink exactly once", async () => {
		let endCalls = 0;
		const fileSpy = vi.spyOn(Bun, "file").mockImplementation(() => {
			const fileSink = {
				write: () => 0,
				end: async () => {
					endCalls += 1;
					throw new Error("forced close failure");
				},
			};
			return { writer: () => fileSink } as unknown as Bun.BunFile;
		});

		try {
			for (let i = 0; i < 32; i++) {
				const sink = new OutputSink({ artifactPath: `spill-${i}.txt`, spillThreshold: 16 });
				spill(sink);
				await sink.dump();
				await sink.dump();
				await sink.dispose();
			}
			expect(endCalls).toBe(32);
		} finally {
			fileSpy.mockRestore();
		}
	});
});

describe("EvalTool OutputSink ownership", () => {
	test("backend failure before the normal dump still disposes exactly once", async () => {
		const dir = await createTempDir();
		const artifactPath = path.join(dir, "eval-error.txt");
		const fileSink = installCountingFileSink();
		const disposeSpy = vi.spyOn(OutputSink.prototype, "dispose");
		let emit: ((chunk: string) => void) | undefined;
		vi.spyOn(evalIndex.jsBackend, "execute").mockImplementation(async (_code, options) => {
			emit = options.onChunk;
			emit(`${"a".repeat(DEFAULT_MAX_BYTES + 1)}\n`);
			throw new Error("backend failed before summary dump");
		});

		const tool = new EvalTool(makeEvalSession(artifactPath));
		await expect(
			tool.execute("eval-error", { cells: [{ language: "js", code: "throw new Error()" }] }),
		).rejects.toThrow("backend failed before summary dump");

		expect(disposeSpy).toHaveBeenCalledTimes(1);
		expect(fileSink.endCalls()).toBe(1);
		emit?.(`${"b".repeat(64)}\n`);
		expect(fileSink.written()).not.toContain("b".repeat(64));
	});

	test("dump failure falls through to explicit disposal exactly once", async () => {
		const dir = await createTempDir();
		const artifactPath = path.join(dir, "eval-dump-error.txt");
		const fileSink = installCountingFileSink();
		const disposeSpy = vi.spyOn(OutputSink.prototype, "dispose");
		const dumpSpy = vi.spyOn(OutputSink.prototype, "dump").mockRejectedValue(new Error("forced dump failure"));
		let emit: ((chunk: string) => void) | undefined;
		vi.spyOn(evalIndex.jsBackend, "execute").mockImplementation(async (_code, options) => {
			emit = options.onChunk;
			emit(`${"c".repeat(DEFAULT_MAX_BYTES + 1)}\n`);
			return {
				output: "ok",
				exitCode: 0,
				cancelled: false,
				truncated: false,
				artifactId: "eval-artifact",
				totalLines: 1,
				totalBytes: 2,
				outputLines: 1,
				outputBytes: 2,
				displayOutputs: [],
			};
		});

		const tool = new EvalTool(makeEvalSession(artifactPath));
		await expect(tool.execute("eval-dump-error", { cells: [{ language: "js", code: "1 + 1" }] })).rejects.toThrow(
			"forced dump failure",
		);

		expect(dumpSpy).toHaveBeenCalledTimes(2);
		expect(disposeSpy).toHaveBeenCalledTimes(1);
		expect(fileSink.endCalls()).toBe(1);
		emit?.(`${"d".repeat(64)}\n`);
		expect(fileSink.written()).not.toContain("d".repeat(64));
	});
});
