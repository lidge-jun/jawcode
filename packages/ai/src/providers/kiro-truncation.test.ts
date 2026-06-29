import { describe, expect, test } from "bun:test";
import { isCompleteKiroToolInput, kiroTruncationErrorMessage, kiroTruncationReason } from "./kiro-truncation";

describe("kiro truncation detection", () => {
	test("kiroTruncationReason flags an explicit truncated flag", () => {
		expect(kiroTruncationReason({ truncated: true })).toBe("truncated");
	});

	test("kiroTruncationReason matches length/max_tokens finish reasons", () => {
		expect(kiroTruncationReason({ finishReason: "length" })).toBe("length");
		expect(kiroTruncationReason({ stop_reason: "max_tokens" })).toBe("max_tokens");
		expect(kiroTruncationReason({ completionReason: "context_length_exceeded" })).toBe("context_length_exceeded");
	});

	test("kiroTruncationReason ignores normal completion reasons", () => {
		expect(kiroTruncationReason({ finishReason: "stop" })).toBeUndefined();
		expect(kiroTruncationReason({ stopReason: "tool_use" })).toBeUndefined();
		expect(kiroTruncationReason({})).toBeUndefined();
	});

	test("isCompleteKiroToolInput: empty is complete, valid object is complete, partial JSON is not", () => {
		expect(isCompleteKiroToolInput("")).toBe(true);
		expect(isCompleteKiroToolInput("   ")).toBe(true);
		expect(isCompleteKiroToolInput('{"command":"echo hi"}')).toBe(true);
		expect(isCompleteKiroToolInput('{"command":"ec')).toBe(false);
		expect(isCompleteKiroToolInput('"a string"')).toBe(false); // not an object
		expect(isCompleteKiroToolInput("42")).toBe(false);
	});

	test("kiroTruncationErrorMessage is stable and includes the reason", () => {
		expect(kiroTruncationErrorMessage()).toBe("Kiro response truncated upstream before the tool call completed");
		expect(kiroTruncationErrorMessage("length")).toContain("(length)");
	});
});
