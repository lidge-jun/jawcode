/**
 * `Bun.JSONL.parseChunk` Node implementation (100.05 / inventory H).
 *
 * Semantics probed against native Bun (260613, see test/shims-data-core):
 *  - values: JSON values of complete (LF-terminated) lines, plus a trailing
 *    unterminated line when it already parses as complete JSON (flush case)
 *  - read: ABSOLUTE offset of the end of the last emitted value — trailing
 *    whitespace/newline excluded (`'{"a":1}\n'` → read 7)
 *  - done: true when nothing but whitespace remains unconsumed
 *  - malformed complete line → error "Failed to parse JSONL", read pinned at
 *    the previous value end (lenient callers skip past the next newline)
 *  - blank lines are skipped and never move `read`
 * For Uint8Array input `read` is in bytes; JSON whitespace is ASCII-only so
 * byte-wise trimming is multibyte-safe.
 */

export interface JsonlChunkResult {
	values: unknown[];
	error: unknown;
	read: number;
	done: boolean;
}

const LF = 0x0a;
const DECODER = new TextDecoder("utf-8");

function isWsCode(code: number): boolean {
	return code === 0x20 || code === 0x09 || code === 0x0d || code === 0x0a;
}

interface Cursorable {
	length: number;
	codeAt(index: number): number;
	indexOfLF(from: number): number;
	decode(from: number, to: number): string;
}

function wrapString(text: string): Cursorable {
	return {
		length: text.length,
		codeAt: i => text.charCodeAt(i),
		indexOfLF: from => text.indexOf("\n", from),
		decode: (from, to) => text.slice(from, to),
	};
}

function wrapBytes(bytes: Uint8Array): Cursorable {
	return {
		length: bytes.length,
		codeAt: i => bytes[i] as number,
		indexOfLF: from => bytes.indexOf(LF, from),
		decode: (from, to) => DECODER.decode(bytes.subarray(from, to)),
	};
}

function parseRange(source: Cursorable, beg: number, end: number): JsonlChunkResult {
	const values: unknown[] = [];
	let cursor = beg;
	let lastValueEnd = beg;

	while (cursor < end) {
		const nl = source.indexOfLF(cursor);
		const lineEnd = nl === -1 || nl >= end ? end : nl;
		const isFinalUnterminated = nl === -1 || nl >= end;

		// Trim the line in-place (offsets stay in source units).
		let contentStart = cursor;
		while (contentStart < lineEnd && isWsCode(source.codeAt(contentStart))) contentStart++;
		let contentEnd = lineEnd;
		while (contentEnd > contentStart && isWsCode(source.codeAt(contentEnd - 1))) contentEnd--;

		if (contentEnd > contentStart) {
			const text = source.decode(contentStart, contentEnd);
			try {
				const value = JSON.parse(text);
				values.push(value);
				lastValueEnd = contentEnd;
			} catch (parseError) {
				if (isFinalUnterminated) {
					// Streaming partial: keep it unread for the next chunk.
					return { values, error: undefined, read: lastValueEnd, done: false };
				}
				const error = new SyntaxError("Failed to parse JSONL");
				(error as { cause?: unknown }).cause = parseError;
				return { values, error, read: lastValueEnd, done: false };
			}
		}

		if (isFinalUnterminated) break;
		cursor = lineEnd + 1;
	}

	return { values, error: undefined, read: lastValueEnd, done: true };
}

function parseChunk(input: string): JsonlChunkResult;
function parseChunk(input: Uint8Array, start?: number, stop?: number): JsonlChunkResult;
function parseChunk(input: string | Uint8Array, start?: number, stop?: number): JsonlChunkResult {
	if (typeof input === "string") {
		return parseRange(wrapString(input), 0, input.length);
	}
	return parseRange(wrapBytes(input), start ?? 0, stop ?? input.length);
}

export const bunJSONL = { parseChunk };
