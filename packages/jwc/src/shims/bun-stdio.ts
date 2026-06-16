/**
 * `Bun.stdin` / `Bun.stdout` / `Bun.stderr` Node 22 implementation
 * (100.03 / inventory K). Upstream call sites use `.text()` / `.stream()` on
 * stdin and `.write()` on stdout/stderr — pass-through plus those accessors.
 */

export const bunStdin = {
	async text(): Promise<string> {
		const chunks: Buffer[] = [];
		for await (const chunk of process.stdin) {
			chunks.push(chunk as Buffer);
		}
		return Buffer.concat(chunks).toString("utf8");
	},
	stream(): ReadableStream<Uint8Array> {
		return ReadableStream.from(process.stdin) as ReadableStream<Uint8Array>;
	},
	// Node streams already expose on/once/pipe etc. for raw consumers.
	raw: process.stdin,
};

function writable(stream: NodeJS.WriteStream) {
	return {
		write(chunk: string | Uint8Array): number {
			stream.write(chunk);
			return typeof chunk === "string" ? Buffer.byteLength(chunk) : chunk.byteLength;
		},
		flush(): void {},
		raw: stream,
	};
}

export const bunStdout = writable(process.stdout);
export const bunStderr = writable(process.stderr);
