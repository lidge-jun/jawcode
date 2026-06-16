/**
 * `Bun.write` Node 22 implementation (100.03 / inventory B).
 *
 * Initial input coverage per plan: string|URL destinations, string /
 * Uint8Array / ArrayBuffer / Blob data. Response/stream inputs extend at the
 * first real failure site (100.03 §구현 세부).
 */
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { toFsPath } from "./bun-file";

export async function coerceWriteData(data: unknown): Promise<string | Uint8Array> {
	if (typeof data === "string") return data;
	if (data instanceof Uint8Array) return data;
	if (data instanceof ArrayBuffer) return new Uint8Array(data);
	if (ArrayBuffer.isView(data)) return new Uint8Array(data.buffer, data.byteOffset, data.byteLength);
	// Response / Blob / BunFile-like: read RAW BYTES via arrayBuffer. Using
	// .text() here would UTF-8-decode binary bodies and corrupt every
	// downloaded executable/archive (audit SQ-1 — tools-manager downloads).
	if (data && typeof (data as { arrayBuffer?: unknown }).arrayBuffer === "function") {
		return new Uint8Array(await (data as { arrayBuffer(): Promise<ArrayBuffer> }).arrayBuffer());
	}
	// Last resort: a text-only source (e.g. a stringifiable with .text() but no
	// arrayBuffer). Bun treats these as UTF-8 text.
	if (data && typeof (data as { text?: unknown }).text === "function") {
		return (data as { text(): Promise<string> }).text();
	}
	throw new Error(`Bun.write shim: unsupported data type ${Object.prototype.toString.call(data)}`);
}

export async function writeTo(dest: string, data: string | Uint8Array): Promise<number> {
	try {
		await writeFile(dest, data);
	} catch (error) {
		// Bun.write creates missing parent directories; match that.
		if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
		await mkdir(path.dirname(dest), { recursive: true });
		await writeFile(dest, data);
	}
	return typeof data === "string" ? Buffer.byteLength(data) : data.byteLength;
}

export async function bunWrite(dest: unknown, data: unknown): Promise<number> {
	const destPath =
		typeof dest === "string" || dest instanceof URL
			? toFsPath(dest)
			: typeof (dest as { name?: unknown })?.name === "string"
				? ((dest as { name: string }).name as string)
				: null;
	if (destPath === null) {
		throw new Error("Bun.write shim: unsupported destination (expected path, URL, or BunFile)");
	}
	return writeTo(destPath, await coerceWriteData(data));
}
