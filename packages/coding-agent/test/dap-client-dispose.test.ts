import { describe, expect, it } from "bun:test";

import { DapClient } from "../src/dap/client";
import type { DapResolvedAdapter } from "../src/dap/types";

type ProcArg = ConstructorParameters<typeof DapClient>[2];

function makeAdapter(name = "fake-adapter"): DapResolvedAdapter {
	return {
		name,
		command: "fake",
		args: [],
		resolvedCommand: "/bin/fake",
		languages: ["python"],
		fileTypes: [".py"],
		rootMarkers: [],
		launchDefaults: {},
		attachDefaults: {},
		connectMode: "stdio",
	};
}

interface FakeProc {
	proc: ProcArg;
	killCount: () => number;
	exitedSettled: () => boolean;
}

function makeFakeProc(): FakeProc {
	let kills = 0;
	let settled = false;
	const exited = Promise.resolve(0).then(value => {
		settled = true;
		return value;
	});
	const proc = {
		exitCode: null as number | null,
		exited,
		kill() {
			kills += 1;
		},
	};
	return {
		proc: proc as unknown as ProcArg,
		killCount: () => kills,
		exitedSettled: () => settled,
	};
}

function makeSinkAndStream() {
	const writeSink = {
		write(data: string | Uint8Array): number {
			return typeof data === "string" ? Buffer.byteLength(data, "utf-8") : data.byteLength;
		},
		flush(): undefined {
			return undefined;
		},
	};
	// A readable that never emits; dispose() does not read from it.
	const readable = new ReadableStream<Uint8Array>({ start() {} });
	return { writeSink, readable };
}

const tick = () => new Promise<void>(resolve => setTimeout(resolve, 0));

describe("DapClient.dispose", () => {
	it("rejects in-flight requests with a disposed error", async () => {
		const fake = makeFakeProc();
		const { writeSink, readable } = makeSinkAndStream();
		const client = new DapClient(makeAdapter(), "/tmp", fake.proc, { writeSink, readable });

		const pending = client.sendRequest("evaluate", { expression: "1" }, undefined, 60_000);
		// swallow to avoid unhandled rejection before we assert
		const captured = pending.catch((error: unknown) => error);
		await tick(); // ensure the request is registered + written

		await client.dispose();

		const error = await captured;
		expect(error).toBeInstanceOf(Error);
		expect((error as Error).message).toContain("disposed");
	});

	it("kills the process and awaits its exit exactly once (idempotent)", async () => {
		const fake = makeFakeProc();
		const { writeSink, readable } = makeSinkAndStream();
		const client = new DapClient(makeAdapter(), "/tmp", fake.proc, { writeSink, readable });

		expect(client.isAlive()).toBe(true);

		await client.dispose();
		expect(fake.killCount()).toBe(1);
		expect(fake.exitedSettled()).toBe(true);
		expect(client.isAlive()).toBe(false);

		// second dispose is a no-op — process not killed twice
		await client.dispose();
		expect(fake.killCount()).toBe(1);
	});

	it("ends an injected socket on dispose", async () => {
		const fake = makeFakeProc();
		const { writeSink, readable } = makeSinkAndStream();
		let socketEnded = 0;
		const socket = {
			end() {
				socketEnded += 1;
			},
		};
		const client = new DapClient(makeAdapter(), "/tmp", fake.proc, { writeSink, readable, socket });

		await client.dispose();
		expect(socketEnded).toBe(1);
		expect(fake.killCount()).toBe(1);
	});

	it("rejects new requests after disposal", async () => {
		const fake = makeFakeProc();
		const { writeSink, readable } = makeSinkAndStream();
		const client = new DapClient(makeAdapter(), "/tmp", fake.proc, { writeSink, readable });

		await client.dispose();
		await expect(client.sendRequest("evaluate", {}, undefined, 1_000)).rejects.toThrow(/not running/);
	});
});
