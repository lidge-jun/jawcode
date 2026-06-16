/**
 * Internal types for the Node Bun-shim (100.02). Deliberately loose: the goal
 * is interface skeleton parity with the call sites inventoried in 100.1, not
 * type-identity with bun-types (which must keep owning the Bun runtime path).
 */

export interface BunFileShim {
	text(): Promise<string>;
	json(): Promise<unknown>;
	bytes(): Promise<Uint8Array>;
	arrayBuffer(): Promise<ArrayBuffer>;
	exists(): Promise<boolean>;
	stat(): Promise<import("node:fs").Stats>;
	stream(): ReadableStream<Uint8Array>;
	writer(): { write(chunk: string | Uint8Array): void; flush(): Promise<void> | void; end(): Promise<void> | void };
	slice(begin?: number, end?: number): BunFileShim;
	readonly size: number;
	readonly name?: string;
}

export interface BunShim {
	// Marker so diagnostics can tell the shim from native Bun.
	readonly __jwcNodeShim: true;
	file(path: string | URL): BunFileShim;
	write(dest: string | URL | BunFileShim, data: unknown): Promise<number>;
	sleep(ms: number): Promise<void>;
	sleepSync(ms: number): void;
	spawn(...args: unknown[]): unknown;
	spawnSync(...args: unknown[]): unknown;
	hash(input: string | ArrayBufferView, seed?: number | bigint): bigint;
	sha(input: string | ArrayBufferView | ArrayBuffer, encoding?: "hex" | "base64" | "base64url"): string | Uint8Array;
	CryptoHasher: unknown;
	SHA256: unknown;
	JSONL: { parseChunk(...args: unknown[]): unknown };
	JSON5: { parse(text: string): unknown };
	serve(...args: unknown[]): unknown;
	stdin: unknown;
	stdout: unknown;
	stderr: unknown;
	stripANSI(text: string): string;
	semver: { order(a: string, b: string): -1 | 0 | 1; satisfies(version: string, range: string): boolean };
	Archive: unknown;
	Glob: unknown;
	Image: unknown;
	gc(force?: boolean): void;
	env: NodeJS.ProcessEnv;
	argv: string[];
	version: string;
	main: string;
	which(command: string): string | null;
	randomUUIDv7(): string;
	nanoseconds(): number;
}
