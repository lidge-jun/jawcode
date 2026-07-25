import { describe, expect, it } from "bun:test";
import { CODEX_BASE_URL } from "../src/providers/openai-codex/constants";
import { buildCodexUsageUrl, normalizeCodexBaseUrl } from "../src/usage/openai-codex";

describe("normalizeCodexBaseUrl", () => {
	it("appends /backend-api to a canonical origin without a path", () => {
		expect(normalizeCodexBaseUrl("https://chatgpt.com")).toBe("https://chatgpt.com/backend-api");
		expect(normalizeCodexBaseUrl("https://chat.openai.com")).toBe("https://chat.openai.com/backend-api");
	});

	it("normalizes a canonical host that already carries /backend-api", () => {
		expect(normalizeCodexBaseUrl("https://chatgpt.com/backend-api")).toBe("https://chatgpt.com/backend-api");
	});

	it("strips a streaming override path back to origin + /backend-api (regression)", () => {
		// Streaming requests use https://chatgpt.com/backend-api/codex/responses.
		// The old guard returned this as-is, so buildCodexUsageUrl produced
		// .../codex/responses/wham/usage (broken). Host-boundary parsing fixes it.
		expect(normalizeCodexBaseUrl("https://chatgpt.com/backend-api/codex/responses")).toBe(
			"https://chatgpt.com/backend-api",
		);
		expect(buildCodexUsageUrl(normalizeCodexBaseUrl("https://chatgpt.com/backend-api/codex/responses"))).toBe(
			"https://chatgpt.com/backend-api/wham/usage",
		);
	});

	it("falls back to CODEX_BASE_URL when baseUrl is empty", () => {
		expect(normalizeCodexBaseUrl(undefined)).toBe(CODEX_BASE_URL);
		expect(normalizeCodexBaseUrl("   ")).toBe(CODEX_BASE_URL);
	});

	it("does not normalize non-https canonical hosts", () => {
		expect(normalizeCodexBaseUrl("http://chatgpt.com")).toBe("http://chatgpt.com");
	});

	it("leaves non-canonical hosts untouched (no /backend-api injection)", () => {
		expect(normalizeCodexBaseUrl("https://example.com/v1")).toBe("https://example.com/v1");
		expect(normalizeCodexBaseUrl("https://chatgpt.com.evil.test")).toBe("https://chatgpt.com.evil.test");
	});

	it("returns the trimmed base for unparseable input", () => {
		expect(normalizeCodexBaseUrl("not a url")).toBe("not a url");
	});
});

describe("buildCodexUsageUrl", () => {
	it("joins the usage path with a single slash", () => {
		expect(buildCodexUsageUrl("https://chatgpt.com/backend-api")).toBe("https://chatgpt.com/backend-api/wham/usage");
		expect(buildCodexUsageUrl("https://chatgpt.com/backend-api/")).toBe("https://chatgpt.com/backend-api/wham/usage");
	});
});
