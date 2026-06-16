/**
 * Node.js compatibility shim for Bun APIs used by @gajae-code/tui.
 * Import this module before any TUI code when running on Node.js.
 * On Bun, this is a no-op (globalThis.Bun already exists).
 */
import { createHash } from "node:crypto";

const ANSI_RE = /\x1b\[[0-9;]*m|\x1b\].*?\x07|\x1b_.*?\x1b\\/g;

function isWide(cp: number): boolean {
	return (
		(cp >= 0x1100 && cp <= 0x115f) ||
		(cp >= 0x2e80 && cp <= 0x303e) ||
		(cp >= 0x3040 && cp <= 0x33bf) ||
		(cp >= 0x3400 && cp <= 0x4dbf) ||
		(cp >= 0x4e00 && cp <= 0xa4cf) ||
		(cp >= 0xa960 && cp <= 0xa97c) ||
		(cp >= 0xac00 && cp <= 0xd7af) ||
		(cp >= 0xd7b0 && cp <= 0xd7ff) ||
		(cp >= 0xf900 && cp <= 0xfaff) ||
		(cp >= 0xfe30 && cp <= 0xfe6f) ||
		(cp >= 0xff01 && cp <= 0xff60) ||
		(cp >= 0xffe0 && cp <= 0xffe6) ||
		(cp >= 0x20000 && cp <= 0x2fa1f)
	);
}

function stringWidth(str: string): number {
	const stripped = str.replace(ANSI_RE, "");
	let w = 0;
	for (const ch of stripped) {
		const cp = ch.codePointAt(0);
		if (cp === undefined || cp < 0x20) continue;
		w += isWide(cp) ? 2 : 1;
	}
	return w;
}

function stripANSI(str: string): string {
	return str.replace(ANSI_RE, "");
}

function hash(data: string | ArrayBuffer, seed?: number | bigint): number {
	const h = createHash("md5");
	if (seed !== undefined) h.update(String(seed));
	h.update(typeof data === "string" ? data : Buffer.from(data));
	return h.digest().readUInt32LE(0);
}

if (typeof globalThis.Bun === "undefined") {
	(globalThis as Record<string, unknown>).Bun = {
		env: process.env,
		stringWidth,
		stripANSI,
		hash,
	};
}
