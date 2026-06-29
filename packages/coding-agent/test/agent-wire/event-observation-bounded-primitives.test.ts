import { describe, expect, it } from "bun:test";

import { boundedStatus, boundedToken } from "../../src/modes/shared/agent-wire/event-observation";

/**
 * Direct unit coverage for the exported bounded-observation integrity primitives.
 * These guard the closed-vocabulary / identifier-shape discipline that the
 * agent-wire owner observation mapping (10.051-B) relies on; the end-to-end
 * redaction/bounds behavior is covered separately in event-observation.redteam.test.ts.
 */
describe("boundedStatus", () => {
	it("accepts known tool status codes, trimmed and case-insensitive", () => {
		expect(boundedStatus("ok")).toBe("ok");
		expect(boundedStatus("OK")).toBe("ok");
		expect(boundedStatus(" Running ")).toBe("running");
		expect(boundedStatus("COMPLETE")).toBe("complete");
		expect(boundedStatus("Error")).toBe("error");
		expect(boundedStatus("timeout")).toBe("timeout");
	});

	it("rejects arbitrary free text and empty strings", () => {
		expect(boundedStatus("totally-bogus-status")).toBeUndefined();
		expect(boundedStatus("done please")).toBeUndefined();
		expect(boundedStatus("")).toBeUndefined();
		expect(boundedStatus("   ")).toBeUndefined();
	});

	it("rejects non-string inputs", () => {
		expect(boundedStatus(42)).toBeUndefined();
		expect(boundedStatus(null)).toBeUndefined();
		expect(boundedStatus(undefined)).toBeUndefined();
		expect(boundedStatus({ status: "ok" })).toBeUndefined();
		expect(boundedStatus(["ok"])).toBeUndefined();
	});
});

describe("boundedToken", () => {
	it("accepts identifier-shaped tokens", () => {
		expect(boundedToken("get_state")).toBe("get_state");
		expect(boundedToken("A")).toBe("A");
		expect(boundedToken("Tool_42")).toBe("Tool_42");
		// 64-char boundary: leading letter + 63 more chars
		const maxToken = `a${"b".repeat(63)}`;
		expect(maxToken.length).toBe(64);
		expect(boundedToken(maxToken)).toBe(maxToken);
	});

	it("rejects tokens longer than 64 characters", () => {
		const tooLong = `a${"b".repeat(64)}`; // 65 chars
		expect(tooLong.length).toBe(65);
		expect(boundedToken(tooLong)).toBeUndefined();
	});

	it("rejects non-identifier shapes (leading digit, special chars, whitespace)", () => {
		expect(boundedToken("1abc")).toBeUndefined();
		expect(boundedToken("_leading")).toBeUndefined();
		expect(boundedToken("a-b")).toBeUndefined();
		expect(boundedToken("a b")).toBeUndefined();
		expect(boundedToken("a.b")).toBeUndefined();
		expect(boundedToken("drop;table")).toBeUndefined();
		expect(boundedToken("")).toBeUndefined();
	});

	it("rejects non-string inputs", () => {
		expect(boundedToken(7)).toBeUndefined();
		expect(boundedToken(null)).toBeUndefined();
		expect(boundedToken(undefined)).toBeUndefined();
		expect(boundedToken({ token: "ok" })).toBeUndefined();
	});
});
