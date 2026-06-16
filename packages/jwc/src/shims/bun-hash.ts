/**
 * `Bun.hash` / `Bun.CryptoHasher` / `Bun.SHA256` Node implementations
 * (100.05 / inventory F).
 *
 * `Bun.hash` here is sha256-derived, NOT wyhash — values differ from native
 * Bun by design. Upstream only uses the hashes as opaque fingerprints
 * (`.toString(36)`, cache keys), so cross-runtime divergence merely busts a
 * cache once. Synchronous on purpose: callers chain `.toString(...)` inline,
 * so an async xxhash-wasm init was rejected (100.05 §설계).
 */
import { createHash } from "node:crypto";

function toBuffer(input: string | ArrayBufferView | ArrayBuffer): Buffer {
	if (typeof input === "string") return Buffer.from(input, "utf8");
	if (input instanceof ArrayBuffer) return Buffer.from(input);
	return Buffer.from(input.buffer, input.byteOffset, input.byteLength);
}

function digestOf(input: string | ArrayBufferView | ArrayBuffer, seed?: number | bigint): Buffer {
	const hash = createHash("sha256");
	if (seed !== undefined) hash.update(String(seed));
	hash.update(toBuffer(input));
	return hash.digest();
}

type Hashable = string | ArrayBufferView | ArrayBuffer;

/**
 * `Bun.sha(input, encoding?)` — sha256 digest. With an encoding returns the
 * encoded string (Bun parity: harmony-leak uses Bun.sha(text,"hex")); without
 * one, raw bytes.
 */
export function bunSha(input: Hashable, encoding?: "hex" | "base64" | "base64url"): string | Uint8Array {
	const hash = createHash("sha256").update(toBuffer(input));
	return encoding ? hash.digest(encoding) : new Uint8Array(hash.digest());
}

export const bunHash = Object.assign(
	(input: Hashable, seed?: number | bigint): bigint => digestOf(input, seed).readBigUInt64LE(0),
	{
		wyhash: (input: Hashable, seed?: bigint): bigint => digestOf(input, seed).readBigUInt64LE(0),
		xxHash32: (input: Hashable, seed?: number): number => digestOf(input, seed).readUInt32LE(0),
		xxHash64: (input: Hashable, seed?: bigint): bigint => digestOf(input, seed).readBigUInt64LE(8),
		xxHash3: (input: Hashable, seed?: bigint): bigint => digestOf(input, seed).readBigUInt64LE(16),
		crc32: (input: Hashable): number => digestOf(input).readUInt32LE(4),
		adler32: (input: Hashable): number => digestOf(input).readUInt32LE(8),
		cityHash32: (input: Hashable): number => digestOf(input).readUInt32LE(12),
		cityHash64: (input: Hashable, seed?: bigint): bigint => digestOf(input, seed).readBigUInt64LE(24),
		murmur32v3: (input: Hashable, seed?: number): number => digestOf(input, seed).readUInt32LE(16),
		murmur32v2: (input: Hashable, seed?: number): number => digestOf(input, seed).readUInt32LE(20),
		murmur64v2: (input: Hashable, seed?: bigint): bigint => digestOf(input, seed).readBigUInt64LE(0),
	},
);

type DigestEncoding = "hex" | "base64" | "base64url";

class NodeHasher {
	#hash: ReturnType<typeof createHash>;

	constructor(algorithm: string) {
		this.#hash = createHash(algorithm);
	}

	update(data: Hashable): this {
		this.#hash.update(toBuffer(data));
		return this;
	}

	digest(encoding?: DigestEncoding): string | Uint8Array {
		if (encoding) return this.#hash.digest(encoding);
		return new Uint8Array(this.#hash.digest());
	}
}

export class BunCryptoHasher extends NodeHasher {
	constructor(algorithm: string = "sha256") {
		super(algorithm);
	}

	static hash(algorithm: string, data: Hashable, encoding?: DigestEncoding): string | Uint8Array {
		return new BunCryptoHasher(algorithm).update(data).digest(encoding);
	}
}

export class BunSHA256 extends NodeHasher {
	constructor() {
		super("sha256");
	}

	static hash(data: Hashable, encoding?: DigestEncoding): string | Uint8Array {
		return new BunSHA256().update(data).digest(encoding);
	}
}
