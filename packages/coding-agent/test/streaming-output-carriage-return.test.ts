/**
 * Carriage-return progress updates must stay readable.
 *
 * `sanitizeText` DELETES a lone CR, so `50%\r75%\r100%` reached the user as
 * `50%75%100%` — three updates glued into one unreadable token. Converting CR to
 * a line boundary before sanitizing keeps each step visible, while CRLF must
 * still collapse to a single newline (including when it is split across chunks,
 * which is the case a naive fix gets wrong).
 */
import { describe, expect, it } from "bun:test";
import { OutputSink } from "../src/session/streaming-output";

async function collectFinalized(chunks: string[]): Promise<string> {
	let seen = "";
	const sink = new OutputSink({
		onChunk: chunk => {
			seen += chunk;
		},
	});
	for (const chunk of chunks) sink.push(chunk);
	// dump() is where a held CR must be flushed; without it the last progress
	// update disappears.
	await sink.dump();
	return seen;
}

function collect(chunks: string[]): string {
	let seen = "";
	const sink = new OutputSink({
		onChunk: chunk => {
			seen += chunk;
		},
	});
	for (const chunk of chunks) sink.push(chunk);
	return seen;
}

describe("carriage-return handling in OutputSink", () => {
	it("keeps progress updates as separate lines instead of concatenating them", () => {
		expect(collect(["50%\r75%\r100%\n"])).toBe("50%\n75%\n100%\n");
	});

	it("treats CRLF as one boundary, not two", () => {
		expect(collect(["a\r\nb"])).toBe("a\nb");
	});

	it("does not split a CRLF that straddles a chunk boundary", () => {
		// The CR arrives at the end of one chunk and its LF at the start of the
		// next. Emitting eagerly on the CR would produce a blank line here.
		expect(collect(["a\r", "\nb"])).toBe("a\nb");
	});

	it("still ends the line when a trailing CR is followed by new content", () => {
		expect(collect(["a\r", "b"])).toBe("a\nb");
	});

	it("leaves CR-free output byte-identical", () => {
		expect(collect(["plain\noutput\n"])).toBe("plain\noutput\n");
	});

	it("emits the boundary for a carriage return that ends the stream", async () => {
		// Held for a possible split CRLF that never arrives; dropping it swallowed
		// the final progress line.
		expect(await collectFinalized(["a\r"])).toBe("a\n");
		expect(await collectFinalized(["\r"])).toBe("\n");
		expect(await collectFinalized(["\r", "\r"])).toBe("\n\n");
	});

	it("does not rewrite carriage returns inside a sixel passthrough payload", async () => {
		const original = { protocol: Bun.env.PI_FORCE_IMAGE_PROTOCOL, allow: Bun.env.PI_ALLOW_SIXEL_PASSTHROUGH };
		process.env.PI_FORCE_IMAGE_PROTOCOL = "sixel";
		process.env.PI_ALLOW_SIXEL_PASSTHROUGH = "1";
		try {
			// Sixel is binary-ish image data; a CR inside it is payload, not a line
			// boundary. Normalizing before the passthrough tokenizes would corrupt it.
			const sixel = `\u001bPqabc\rdef\u001b\\`;
			expect(await collectFinalized([sixel])).toContain("abc\rdef");
		} finally {
			process.env.PI_FORCE_IMAGE_PROTOCOL = original.protocol ?? "";
			process.env.PI_ALLOW_SIXEL_PASSTHROUGH = original.allow ?? "";
		}
	});
});
