import { describe, expect, test } from "bun:test";
import { type KiroThinkingChunk, KiroThinkingParser } from "./kiro-thinking";

function run(fragments: string[]): KiroThinkingChunk[] {
	const parser = new KiroThinkingParser();
	const out: KiroThinkingChunk[] = [];
	for (const f of fragments) out.push(...parser.feed(f));
	out.push(...parser.flush());
	return out;
}

function joined(chunks: KiroThinkingChunk[], kind: "thinking" | "text"): string {
	return chunks
		.filter(c => c.kind === kind)
		.map(c => c.text)
		.join("");
}

describe("KiroThinkingParser", () => {
	test("a leading <thinking> block is classified as reasoning, the rest as text", () => {
		const chunks = run(["<thinking>plan the work</thinking>here is the answer"]);
		expect(joined(chunks, "thinking")).toBe("plan the work");
		expect(joined(chunks, "text")).toBe("here is the answer");
	});

	test("open and close tags split across chunks are still parsed", () => {
		const chunks = run(["<thin", "king>step ", "one</thin", "king>visible"]);
		expect(joined(chunks, "thinking")).toBe("step one");
		expect(joined(chunks, "text")).toBe("visible");
	});

	test("<think> and <reasoning> aliases are recognized", () => {
		expect(joined(run(["<think>a</think>b"]), "thinking")).toBe("a");
		expect(joined(run(["<reasoning>r</reasoning>t"]), "thinking")).toBe("r");
	});

	test("content that does not start with a thinking tag is all visible text", () => {
		const chunks = run(["hello ", "world"]);
		expect(joined(chunks, "text")).toBe("hello world");
		expect(joined(chunks, "thinking")).toBe("");
	});

	test("a non-leading thinking tag is treated as plain text", () => {
		const chunks = run(["answer first <thinking>not reasoning</thinking>"]);
		expect(joined(chunks, "thinking")).toBe("");
		expect(joined(chunks, "text")).toBe("answer first <thinking>not reasoning</thinking>");
	});

	test("an unterminated leading thinking block flushes as reasoning at end", () => {
		const chunks = run(["<thinking>still thinking when the stream ended"]);
		expect(joined(chunks, "thinking")).toBe("still thinking when the stream ended");
		expect(joined(chunks, "text")).toBe("");
	});
});
