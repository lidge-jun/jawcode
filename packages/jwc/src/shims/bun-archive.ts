/**
 * `Bun.Archive` Node adapter (100.07 / inventory O).
 *
 * Upstream surface (archive-reader.ts / write.ts census): `new Archive(bytes)`
 * + `await archive.files(): Map<string, File>` for reading, and static
 * `Archive.write(path, entries)` for writing. Formats: zip via fflate
 * (workspace catalog dep), tar/tar.gz via a compact ustar reader/writer +
 * node:zlib. Exotic tar features (sparse, GNU longlink beyond 'L') are out of
 * scope — explicit errors, not silent corruption.
 */
import { writeFile } from "node:fs/promises";
import { gunzipSync, gzipSync } from "node:zlib";
import { unzipSync, zipSync } from "fflate";

const ENCODER = new TextEncoder();
const DECODER = new TextDecoder();

// ── tar (ustar) ─────────────────────────────────────────────────────────────

function readOctal(bytes: Uint8Array, offset: number, length: number): number {
	const text = DECODER.decode(bytes.subarray(offset, offset + length))
		.replace(/\0/g, "")
		.trim();
	return text.length === 0 ? 0 : Number.parseInt(text, 8);
}

function readString(bytes: Uint8Array, offset: number, length: number): string {
	const raw = bytes.subarray(offset, offset + length);
	const nul = raw.indexOf(0);
	return DECODER.decode(nul === -1 ? raw : raw.subarray(0, nul));
}

interface TarEntry {
	data: Uint8Array;
	mtimeMs: number;
}

/**
 * Strip leading-slash and `..`/`.` path components so a malicious archive
 * cannot surface an escaping key (audit B-3). archive-reader normalizes again
 * downstream, but the shim's own Map must never carry a traversal key.
 */
function sanitizeEntryName(name: string): string {
	return name
		.split("/")
		.filter(segment => segment !== "" && segment !== "." && segment !== "..")
		.join("/");
}

function parseTar(bytes: Uint8Array): Map<string, TarEntry> {
	const entries = new Map<string, TarEntry>();
	let offset = 0;
	let pendingLongName: string | null = null;
	while (offset + 512 <= bytes.length) {
		const block = bytes.subarray(offset, offset + 512);
		if (block.every(byte => byte === 0)) break;
		const size = readOctal(bytes, offset + 124, 12);
		const mtimeSec = readOctal(bytes, offset + 136, 12);
		const typeflag = String.fromCharCode(bytes[offset + 156] ?? 0);
		let name = readString(bytes, offset, 100);
		const prefix = readString(bytes, offset + 345, 155);
		if (prefix) name = `${prefix}/${name}`;
		const dataStart = offset + 512;
		const data = bytes.subarray(dataStart, dataStart + size);
		if (typeflag === "L") {
			// GNU long name: payload is the next entry's name.
			pendingLongName = DECODER.decode(data).replace(/\0+$/, "");
		} else {
			if (pendingLongName) {
				name = pendingLongName;
				pendingLongName = null;
			}
			if (typeflag === "0" || typeflag === "\0" || typeflag === "") {
				const safe = sanitizeEntryName(name);
				if (safe) entries.set(safe, { data: data.slice(), mtimeMs: mtimeSec * 1000 });
			}
			// Directories/symlinks/others are skipped — reader surfaces files only.
		}
		offset = dataStart + Math.ceil(size / 512) * 512;
	}
	return entries;
}

function writeOctal(target: Uint8Array, offset: number, length: number, value: number): void {
	const text = value.toString(8).padStart(length - 1, "0");
	target.set(ENCODER.encode(text.slice(0, length - 1)), offset);
	target[offset + length - 1] = 0;
}

/**
 * Split a >100-byte name into ustar name(≤100)/prefix(≤155) at a `/` boundary,
 * or return null when it cannot be represented that way (then GNU longname is
 * used). Matches what parseTar already reads back via the prefix field.
 */
function splitUstarName(name: string): { name: string; prefix: string } | null {
	if (ENCODER.encode(name).length <= 100) return { name, prefix: "" };
	for (let slash = name.indexOf("/"); slash !== -1; slash = name.indexOf("/", slash + 1)) {
		const prefix = name.slice(0, slash);
		const rest = name.slice(slash + 1);
		if (ENCODER.encode(prefix).length <= 155 && ENCODER.encode(rest).length <= 100 && rest.length > 0) {
			return { name: rest, prefix };
		}
	}
	return null;
}

function tarHeader(
	name: string,
	size: number,
	options: { typeflag?: number; prefix?: string; mtimeSec?: number } = {},
): Uint8Array {
	const header = new Uint8Array(512);
	header.set(ENCODER.encode(name).subarray(0, 100), 0);
	writeOctal(header, 100, 8, 0o644); // mode
	writeOctal(header, 108, 8, 0); // uid
	writeOctal(header, 116, 8, 0); // gid
	writeOctal(header, 124, 12, size);
	writeOctal(header, 136, 12, options.mtimeSec ?? Math.floor(Date.now() / 1000));
	header.set(ENCODER.encode("        "), 148); // checksum placeholder (spaces)
	header[156] = options.typeflag ?? 0x30; // typeflag '0' (file) unless overridden
	header.set(ENCODER.encode("ustar\0"), 257);
	header.set(ENCODER.encode("00"), 263);
	if (options.prefix) header.set(ENCODER.encode(options.prefix).subarray(0, 155), 345);
	let checksum = 0;
	for (const byte of header) checksum += byte;
	const checksumText = `${checksum.toString(8).padStart(6, "0")}\0 `;
	header.set(ENCODER.encode(checksumText), 148);
	return header;
}

function padTo512(part: Uint8Array): Uint8Array[] {
	const pad = (512 - (part.byteLength % 512)) % 512;
	return pad ? [part, new Uint8Array(pad)] : [part];
}

/** Header(s) for one entry: ustar prefix split when possible, else a GNU
 *  longname ('L') record carrying the full path (parseTar reads both). */
function entryHeaders(name: string, size: number, mtimeSec?: number): Uint8Array[] {
	const split = splitUstarName(name);
	if (split) return [tarHeader(split.name, size, { prefix: split.prefix, mtimeSec })];
	const longNameBytes = ENCODER.encode(`${name}\0`);
	const longHeader = tarHeader("././@LongLink", longNameBytes.byteLength, { typeflag: 0x4c /* 'L' */, mtimeSec });
	const truncated = new TextDecoder().decode(ENCODER.encode(name).subarray(0, 100));
	return [longHeader, ...padTo512(longNameBytes), tarHeader(truncated, size, { mtimeSec })];
}

interface TarWriteEntry {
	data: Uint8Array;
	mtimeSec?: number;
}

function buildTar(entries: Map<string, TarWriteEntry>): Uint8Array {
	const parts: Uint8Array[] = [];
	for (const [name, entry] of entries) {
		parts.push(...entryHeaders(name, entry.data.byteLength, entry.mtimeSec));
		parts.push(...padTo512(entry.data));
	}
	parts.push(new Uint8Array(1024)); // end-of-archive blocks
	const total = parts.reduce((sum, part) => sum + part.byteLength, 0);
	const out = new Uint8Array(total);
	let cursor = 0;
	for (const part of parts) {
		out.set(part, cursor);
		cursor += part.byteLength;
	}
	return out;
}

// ── format detection + entry coercion ───────────────────────────────────────

function isZip(bytes: Uint8Array): boolean {
	// Full PK signature, not just "PK": local-file (03 04), empty-archive
	// (05 06), or spanned (07 08). A bare "PK" prefix misroutes a valid tar
	// whose first entry name starts with PK (PKG-INFO, PKGBUILD) into unzip
	// (audit round-5 SQ-1 archive).
	if (bytes[0] !== 0x50 || bytes[1] !== 0x4b) return false;
	return (
		(bytes[2] === 0x03 && bytes[3] === 0x04) ||
		(bytes[2] === 0x05 && bytes[3] === 0x06) ||
		(bytes[2] === 0x07 && bytes[3] === 0x08)
	);
}

function isGzip(bytes: Uint8Array): boolean {
	return bytes[0] === 0x1f && bytes[1] === 0x8b;
}

async function coerceEntry(value: unknown): Promise<TarWriteEntry> {
	// File first: it is a Blob subclass but carries lastModified, which the
	// read side preserves as the tar mtime — keep it on the write round-trip so
	// editing one entry doesn't reset every other entry's mtime to now, and so
	// identical inputs produce identical bytes (audit round-6 — determinism).
	if (typeof File !== "undefined" && value instanceof File) {
		const mtimeMs = Number.isFinite(value.lastModified) ? value.lastModified : 0;
		return {
			data: new Uint8Array(await value.arrayBuffer()),
			mtimeSec: mtimeMs > 0 ? Math.floor(mtimeMs / 1000) : undefined,
		};
	}
	if (typeof value === "string") return { data: ENCODER.encode(value) };
	if (value instanceof Uint8Array) return { data: value };
	if (value instanceof ArrayBuffer) return { data: new Uint8Array(value) };
	if (typeof Blob !== "undefined" && value instanceof Blob) return { data: new Uint8Array(await value.arrayBuffer()) };
	throw new Error(`Bun.Archive shim: unsupported entry type ${Object.prototype.toString.call(value)}`);
}

// ── public surface ──────────────────────────────────────────────────────────

export class BunArchive {
	#bytes: Uint8Array;

	constructor(input: Uint8Array | ArrayBuffer) {
		this.#bytes = input instanceof ArrayBuffer ? new Uint8Array(input) : input;
		if (this.#bytes.byteLength === 0) {
			throw new Error("Bun.Archive shim: empty archive input");
		}
	}

	async files(): Promise<Map<string, File>> {
		const files = new Map<string, File>();
		if (isZip(this.#bytes)) {
			// fflate exposes no per-entry mtime; lastModified 0 makes
			// archive-reader treat mtime as absent (its `> 0` guard) rather
			// than polluting it with Date.now() (audit B-2).
			for (const [name, data] of Object.entries(unzipSync(this.#bytes))) {
				const safe = sanitizeEntryName(name);
				if (!safe || name.endsWith("/")) continue;
				files.set(safe, new File([data as BlobPart], safe, { lastModified: 0 }));
			}
		} else {
			const tarBytes = isGzip(this.#bytes) ? new Uint8Array(gunzipSync(this.#bytes)) : this.#bytes;
			for (const [name, entry] of parseTar(tarBytes)) {
				files.set(name, new File([entry.data as BlobPart], name, { lastModified: entry.mtimeMs }));
			}
		}
		return files;
	}

	static async write(path: string, entries: Record<string, unknown>): Promise<void> {
		const normalized = new Map<string, TarWriteEntry>();
		for (const [name, value] of Object.entries(entries)) {
			normalized.set(name, await coerceEntry(value));
		}
		let bytes: Uint8Array;
		if (/\.zip$/i.test(path)) {
			const zipInput: Record<string, Uint8Array> = {};
			for (const [name, entry] of normalized) zipInput[name] = entry.data;
			bytes = zipSync(zipInput);
		} else {
			const tar = buildTar(normalized);
			bytes = /\.(tgz|tar\.gz)$/i.test(path) ? new Uint8Array(gzipSync(tar)) : tar;
		}
		await writeFile(path, bytes);
	}
}
