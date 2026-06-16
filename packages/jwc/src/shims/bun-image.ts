/**
 * `Bun.Image` Node shim (100.14 — photon WASM backend; opencode precedent).
 *
 * Bun.Image is a native decode/transform/encode pipeline. On Node it is backed
 * by `@silvia-odwyer/photon-node` (WASM — no platform-native binary, unlike
 * sharp/libvips). The Bun runtime never reaches this shim (native Bun.Image),
 * so photon only loads under the dist-node bundle, and only when an image is
 * actually transformed.
 *  - metadata(): header parse (PNG/JPEG/GIF/WebP/BMP) — no WASM load, so the
 *    image-resize fast path (already-within-budget) stays cheap.
 *  - resize()/png()/jpeg()/webp() → bytes(): lazy-load photon, decode, resize
 *    (Lanczos3), re-encode to the chosen format, free the WASM heap. Decode/
 *    encode failure throws (caught by image-resize → returns the original).
 */
import { createRequire } from "node:module";

interface ImageMetadata {
	width: number;
	height: number;
	format: string;
}

type PhotonImage = {
	get_width(): number;
	get_height(): number;
	get_bytes(): Uint8Array;
	get_bytes_jpeg(quality: number): Uint8Array;
	get_bytes_webp(): Uint8Array;
	free(): void;
};
type PhotonModule = {
	PhotonImage: { new_from_byteslice(vec: Uint8Array): PhotonImage };
	resize(img: PhotonImage, width: number, height: number, filter: number): PhotonImage;
	SamplingFilter: { Lanczos3: number };
};

let photonPromise: Promise<PhotonModule> | undefined;
function loadPhoton(): Promise<PhotonModule> {
	// Resolve from node_modules (photon is an esbuild external): its CJS main
	// inits the WASM synchronously off its own __dirname. createRequire avoids
	// esbuild rewriting the dynamic import into a bundled lookup.
	photonPromise ??= (async () => {
		const require = createRequire(import.meta.url);
		const mod = require("@silvia-odwyer/photon-node") as PhotonModule & { default?: PhotonModule };
		return mod.default ?? mod;
	})();
	return photonPromise;
}

type OutputFormat = { kind: "png" } | { kind: "jpeg"; quality: number } | { kind: "webp" };

function readUInt16BE(b: Uint8Array, o: number): number {
	return ((b[o] ?? 0) << 8) | (b[o + 1] ?? 0);
}
function readUInt32BE(b: Uint8Array, o: number): number {
	return ((b[o] ?? 0) * 0x1000000 + ((b[o + 1] ?? 0) << 16) + ((b[o + 2] ?? 0) << 8) + (b[o + 3] ?? 0)) >>> 0;
}
function readUInt32LE(b: Uint8Array, o: number): number {
	return ((b[o] ?? 0) + ((b[o + 1] ?? 0) << 8) + ((b[o + 2] ?? 0) << 16) + (b[o + 3] ?? 0) * 0x1000000) >>> 0;
}

function parseImageHeader(b: Uint8Array): ImageMetadata {
	// PNG: 89 50 4E 47 0D 0A 1A 0A, IHDR width/height at offset 16/20 (BE).
	if (b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) {
		return { format: "png", width: readUInt32BE(b, 16), height: readUInt32BE(b, 20) };
	}
	// GIF: "GIF87a"/"GIF89a", width/height at 6/8 (LE 16-bit).
	if (b[0] === 0x47 && b[1] === 0x49 && b[2] === 0x46) {
		return { format: "gif", width: readUInt16BE(b, 7) | (b[6] ?? 0), height: ((b[9] ?? 0) << 8) | (b[8] ?? 0) };
	}
	// BMP: "BM", width/height at 18/22 (LE 32-bit).
	if (b[0] === 0x42 && b[1] === 0x4d) {
		return { format: "bmp", width: readUInt32LE(b, 18), height: readUInt32LE(b, 22) };
	}
	// WebP: "RIFF"...."WEBP". VP8/VP8L/VP8X variants carry dims differently.
	if (b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46 && b[8] === 0x57 && b[9] === 0x45) {
		const fourcc = String.fromCharCode(b[12] ?? 0, b[13] ?? 0, b[14] ?? 0, b[15] ?? 0);
		if (fourcc === "VP8X") {
			return {
				format: "webp",
				width: 1 + (readUInt32LE(b, 24) & 0xffffff),
				height: 1 + ((readUInt32LE(b, 27) >>> 0) & 0xffffff),
			};
		}
		if (fourcc === "VP8L") {
			const bits = readUInt32LE(b, 21);
			return { format: "webp", width: 1 + (bits & 0x3fff), height: 1 + ((bits >> 14) & 0x3fff) };
		}
		// Lossy VP8: dims at offset 26/28 (14-bit LE).
		return { format: "webp", width: readUInt16BE(b, 27) & 0x3fff, height: readUInt16BE(b, 29) & 0x3fff };
	}
	// JPEG: scan SOF markers for height/width.
	if (b[0] === 0xff && b[1] === 0xd8) {
		let offset = 2;
		while (offset + 9 < b.length) {
			if (b[offset] !== 0xff) {
				offset++;
				continue;
			}
			const marker = b[offset + 1] ?? 0;
			// SOF0..SOF15 (excluding DHT/JPG/DAC at C4/C8/CC) carry frame dims.
			if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
				return { format: "jpeg", height: readUInt16BE(b, offset + 5), width: readUInt16BE(b, offset + 7) };
			}
			offset += 2 + readUInt16BE(b, offset + 2);
		}
	}
	throw new Error("Bun.Image shim: unrecognized image header (Node build cannot decode this format)");
}

class NodeBunImage {
	#bytes: Uint8Array;
	#target?: { width: number; height: number };
	#format: OutputFormat = { kind: "png" };

	constructor(input: Uint8Array | ArrayBuffer | Buffer) {
		this.#bytes = input instanceof ArrayBuffer ? new Uint8Array(input) : input;
	}

	async metadata(): Promise<ImageMetadata> {
		// Header parse only — no WASM, keeps the image-resize fast path cheap.
		return parseImageHeader(this.#bytes);
	}

	resize(width: number, height: number): this {
		this.#target = { width: Math.max(1, Math.round(width)), height: Math.max(1, Math.round(height)) };
		return this;
	}

	png(): this {
		this.#format = { kind: "png" };
		return this;
	}
	jpeg(options?: { quality?: number }): this {
		this.#format = { kind: "jpeg", quality: clampQuality(options?.quality) };
		return this;
	}
	webp(_options?: { quality?: number }): this {
		// photon's WebP encoder takes no quality argument.
		this.#format = { kind: "webp" };
		return this;
	}

	async bytes(): Promise<Uint8Array> {
		const photon = await loadPhoton();
		let decoded: PhotonImage | undefined;
		let resized: PhotonImage | undefined;
		try {
			decoded = photon.PhotonImage.new_from_byteslice(this.#bytes);
			let source = decoded;
			if (this.#target) {
				resized = photon.resize(decoded, this.#target.width, this.#target.height, photon.SamplingFilter.Lanczos3);
				source = resized;
			}
			const out =
				this.#format.kind === "jpeg"
					? source.get_bytes_jpeg(this.#format.quality)
					: this.#format.kind === "webp"
						? source.get_bytes_webp()
						: source.get_bytes();
			// Copy out of the WASM-owned view before freeing the heap.
			return new Uint8Array(out);
		} finally {
			resized?.free();
			decoded?.free();
		}
	}

	async arrayBuffer(): Promise<ArrayBuffer> {
		return (await this.bytes()).slice().buffer;
	}
}

function clampQuality(quality: number | undefined): number {
	if (typeof quality !== "number" || !Number.isFinite(quality)) return 80;
	return Math.min(100, Math.max(0, Math.round(quality)));
}

export const BunImage = NodeBunImage;
