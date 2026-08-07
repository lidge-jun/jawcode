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
});
