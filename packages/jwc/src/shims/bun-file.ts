/**
 * `Bun.file` Node 22 implementation (100.03 / inventory A).
 *
 * Lazy by design, like the original: constructing the handle never touches
 * the filesystem — only the accessor methods do. The `.write()` convenience
 * mirrors BunFile.write and shares the coercion rules of `Bun.write`
 * (bun-write.ts).
 */
import * as fs from "node:fs";
import { open, readFile, stat } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { coerceWriteData, writeTo } from "./bun-write";
import type { BunFileShim } from "./types";

export function toFsPath(path: string | URL): string {
	return typeof path === "string" ? path : fileURLToPath(path);
}

class NodeBunFile implements BunFileShim {
	readonly #path: string;

	constructor(path: string) {
		this.#path = path;
	}

	get name(): string {
		return this.#path;
	}

	get size(): number {
		try {
			return fs.statSync(this.#path).size;
		} catch {
			return 0;
		}
	}

	async text(): Promise<string> {
		return readFile(this.#path, "utf8");
	}

	async json(): Promise<unknown> {
		return JSON.parse(await this.text());
	}

	async bytes(): Promise<Uint8Array> {
		const buffer = await readFile(this.#path);
		return new Uint8Array(buffer.buffer, buffer.byteOffset, buffer.byteLength);
	}

	async arrayBuffer(): Promise<ArrayBuffer> {
		const bytes = await this.bytes();
		return bytes.slice().buffer;
	}

	/**
	 * Byte-range view, like BunFile.slice(begin, end) (audit SQ-2 fileio —
	 * sqlite-reader reads the first bytes for the magic-number probe). Reads
	 * only the requested window via a positioned fd read.
	 */
	slice(begin = 0, end?: number): BunFileShim {
		return new NodeBunFileSlice(this.#path, begin, end);
	}

	async exists(): Promise<boolean> {
		try {
			await stat(this.#path);
			return true;
		} catch {
			return false;
		}
	}

	stat(): Promise<fs.Stats> {
		return stat(this.#path);
	}

	stream(): ReadableStream<Uint8Array> {
		const nodeStream = fs.createReadStream(this.#path);
		return ReadableStream.from(nodeStream) as ReadableStream<Uint8Array>;
	}

	writer(): { write(chunk: string | Uint8Array): void; flush(): void; end(): Promise<void> } {
		const handlePromise = open(this.#path, "w");
		let chain: Promise<unknown> = handlePromise;
		return {
			write: (chunk: string | Uint8Array) => {
				chain = chain.then(async () => (await handlePromise).write(chunk as Uint8Array));
			},
			flush: () => {},
			end: async () => {
				await chain;
				await (await handlePromise).close();
			},
		};
	}

	async write(data: unknown): Promise<number> {
		return writeTo(this.#path, await coerceWriteData(data));
	}

	async delete(): Promise<void> {
		await fs.promises.rm(this.#path, { force: true });
	}
}

/** Byte-range slice of a file — reads only [begin, end) on demand. */
class NodeBunFileSlice implements BunFileShim {
	constructor(
		private readonly path: string,
		private readonly begin: number,
		private readonly end?: number,
	) {}

	get name(): string {
		return this.path;
	}

	get size(): number {
		try {
			const full = fs.statSync(this.path).size;
			const stop = this.end ?? full;
			return Math.max(0, Math.min(stop, full) - this.begin);
		} catch {
			return 0;
		}
	}

	async bytes(): Promise<Uint8Array> {
		const length = this.end === undefined ? undefined : Math.max(0, this.end - this.begin);
		if (length === 0) return new Uint8Array(0);
		const handle = await open(this.path, "r");
		try {
			if (length === undefined) {
				const buffer = await handle.readFile();
				return new Uint8Array(
					buffer.buffer,
					buffer.byteOffset + this.begin,
					Math.max(0, buffer.byteLength - this.begin),
				);
			}
			const buffer = Buffer.allocUnsafe(length);
			const { bytesRead } = await handle.read(buffer, 0, length, this.begin);
			return new Uint8Array(buffer.buffer, buffer.byteOffset, bytesRead);
		} finally {
			await handle.close();
		}
	}

	async arrayBuffer(): Promise<ArrayBuffer> {
		return (await this.bytes()).slice().buffer;
	}

	async text(): Promise<string> {
		return new TextDecoder().decode(await this.bytes());
	}

	async json(): Promise<unknown> {
		return JSON.parse(await this.text());
	}

	async exists(): Promise<boolean> {
		try {
			await stat(this.path);
			return true;
		} catch {
			return false;
		}
	}

	stat(): Promise<fs.Stats> {
		return stat(this.path);
	}

	stream(): ReadableStream<Uint8Array> {
		const nodeStream = fs.createReadStream(this.path, {
			start: this.begin,
			...(this.end !== undefined ? { end: this.end - 1 } : {}),
		});
		return ReadableStream.from(nodeStream) as ReadableStream<Uint8Array>;
	}

	writer(): never {
		throw new Error("Bun.file slice is read-only");
	}

	slice(begin = 0, end?: number): BunFileShim {
		const base = this.begin + begin;
		const stop = end === undefined ? this.end : this.begin + end;
		return new NodeBunFileSlice(this.path, base, stop);
	}
}

export function bunFile(path: string | URL): BunFileShim {
	return new NodeBunFile(toFsPath(path));
}
