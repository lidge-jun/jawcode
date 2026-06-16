/**
 * Data-core shim equivalence (100.05). Runs under Bun so the JSONL shim can
 * be checked against native Bun.JSONL.parseChunk on the exact shapes
 * packages/utils/src/stream.ts feeds it (streaming partials, byte windows,
 * malformed lines, end-of-stream flush).
 */
import { describe, expect, it } from "bun:test";
import { BunSHA256, bunHash } from "../src/shims/bun-hash";
import { bunJSONL } from "../src/shims/bun-jsonl";

const ENC = new TextEncoder();

function compare(input: string | Uint8Array, start?: number, stop?: number) {
	const native =
		typeof input === "string"
			? Bun.JSONL.parseChunk(input)
			: Bun.JSONL.parseChunk(input, start ?? 0, stop ?? input.length);
	const shim =
		typeof input === "string"
			? bunJSONL.parseChunk(input)
			: bunJSONL.parseChunk(input, start ?? 0, stop ?? input.length);
	expect(shim.values).toEqual(native.values as unknown[]);
	expect(shim.done).toBe(native.done);
	expect(shim.read).toBe(native.read);
	return { native, shim };
}

describe("bun-jsonl shim vs native", () => {
	it("matches on terminated lines", () => {
		compare('{"a":1}\n{"b":2}\n');
		compare(ENC.encode('{"a":1}\n{"b":2}\n'));
	});

	it("matches on a trailing partial line (streaming case)", () => {
		compare(ENC.encode('{"a":1}\n{"b":'));
	});

	it("matches on an unterminated but complete trailing value (flush case)", () => {
		compare('{"a":1}\n{"b":2}');
	});

	it("matches on byte windows", () => {
		const bytes = ENC.encode('xxx{"a":1}\n{"b":2}\nyyy');
		compare(bytes, 3, bytes.length - 3);
	});

	it("matches error/read on malformed complete lines", () => {
		const malformed = '{"a":1}\n{broken}\n{"c":3}\n';
		const native = Bun.JSONL.parseChunk(malformed);
		const shim = bunJSONL.parseChunk(malformed);
		expect(Boolean(shim.error)).toBe(Boolean(native.error));
		expect(shim.values).toEqual(native.values as unknown[]);
		expect(shim.read).toBe(native.read);
	});

	it("matches on multibyte content", () => {
		compare(ENC.encode('{"k":"한글 値"}\n{"j":"🦊"}\n'));
		compare(ENC.encode('{"k":"한글'));
	});
});

describe("bun-hash shim", () => {
	it("returns bigint with working toString chains", () => {
		const h = bunHash("fingerprint-me");
		expect(typeof h).toBe("bigint");
		expect(h.toString(36).length).toBeGreaterThan(0);
		expect(bunHash("fingerprint-me")).toBe(h);
		expect(bunHash("other")).not.toBe(h);
	});

	it("xxHash32 returns a stable uint32 usable with modulo", () => {
		const v = bunHash.xxHash32("session-1");
		expect(Number.isInteger(v)).toBe(true);
		expect(v).toBeGreaterThanOrEqual(0);
		expect(v % 7).toBe(bunHash.xxHash32("session-1") % 7);
	});

	it("SHA256 hex matches node:crypto ground truth", () => {
		const hex = new BunSHA256().update("abc").digest("hex");
		expect(hex).toBe("ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
		// And matches native Bun for the same input.
		expect(hex).toBe(new Bun.SHA256().update("abc").digest("hex"));
	});
});
