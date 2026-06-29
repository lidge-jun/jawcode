import { describe, expect, test } from "bun:test";
import { safeKiroErrorMessage, safeKiroHttpErrorMessage } from "./kiro-errors";

describe("safeKiroErrorMessage — classification", () => {
	test("throttling exception frames classify as rate limit", () => {
		const msg = safeKiroErrorMessage({ ":exception-type": "ThrottlingException" }, "Too many requests");
		expect(msg.startsWith("Kiro rate limit exceeded")).toBe(true);
	});

	test("access-denied frames classify as authentication failure", () => {
		const msg = safeKiroErrorMessage(
			{ ":exception-type": "AccessDeniedException" },
			JSON.stringify({ message: "Access denied for this profile" }),
		);
		expect(msg.startsWith("Kiro authentication failed")).toBe(true);
	});

	test("validation frames classify as invalid request", () => {
		const msg = safeKiroErrorMessage(
			{ ":exception-type": "ValidationException" },
			JSON.stringify({ message: "model not found in region" }),
		);
		expect(msg.startsWith("Kiro invalid request")).toBe(true);
	});
});

describe("safeKiroErrorMessage — redaction", () => {
	test("strips tokens, ARNs, and absolute paths from the surfaced detail", () => {
		const payload = JSON.stringify({
			__type: "ValidationException",
			message:
				"accessToken=aoa-supersecret refreshToken=rt-secret profile arn:aws:codewhisperer:us-east-1:123456789012:profile/demo path /Users/jun/private/file.json",
		});
		const msg = safeKiroErrorMessage({ ":exception-type": "ValidationException" }, payload);
		expect(msg).not.toContain("aoa-supersecret");
		expect(msg).not.toContain("rt-secret");
		expect(msg).not.toContain("arn:aws:codewhisperer");
		expect(msg).not.toContain("/Users/jun");
	});
});

describe("safeKiroHttpErrorMessage", () => {
	test("maps a 429 with no body to a rate-limit prefix", () => {
		const msg = safeKiroHttpErrorMessage(429, {}, "");
		expect(msg.startsWith("Kiro rate limit exceeded")).toBe(true);
	});

	test("maps a 401 to an authentication prefix and keeps HTTP status detail", () => {
		const msg = safeKiroHttpErrorMessage(401, {}, "");
		expect(msg.startsWith("Kiro authentication failed")).toBe(true);
		expect(msg).toContain("HTTP 401");
	});

	test("redacts secrets present in an HTTP error body", () => {
		const body = JSON.stringify({ message: "bad token", accessToken: "aoa-leak" });
		const msg = safeKiroHttpErrorMessage(400, {}, body);
		expect(msg.startsWith("Kiro invalid request")).toBe(true);
		expect(msg).not.toContain("aoa-leak");
	});
});
