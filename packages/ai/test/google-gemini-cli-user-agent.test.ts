import { afterEach, describe, expect, it } from "bun:test";
import { getGeminiCliUserAgent } from "../src/providers/google-gemini-headers";

describe("Google Gemini CLI user agent", () => {
	const originalJwcVersion = process.env.JWC_AI_GEMINI_CLI_VERSION;
	const originalPiVersion = process.env.PI_AI_GEMINI_CLI_VERSION;

	afterEach(() => {
		if (originalJwcVersion === undefined) {
			delete process.env.JWC_AI_GEMINI_CLI_VERSION;
		} else {
			process.env.JWC_AI_GEMINI_CLI_VERSION = originalJwcVersion;
		}
		if (originalPiVersion === undefined) {
			delete process.env.PI_AI_GEMINI_CLI_VERSION;
		} else {
			process.env.PI_AI_GEMINI_CLI_VERSION = originalPiVersion;
		}
	});

	it("uses the current Gemini CLI version by default", () => {
		delete process.env.JWC_AI_GEMINI_CLI_VERSION;
		delete process.env.PI_AI_GEMINI_CLI_VERSION;

		expect(getGeminiCliUserAgent("gemini-2.5-flash")).toContain("GeminiCLI/0.50.0/gemini-2.5-flash");
	});

	it("prefers the documented JWC Gemini CLI version override", () => {
		process.env.JWC_AI_GEMINI_CLI_VERSION = "9.8.7";
		process.env.PI_AI_GEMINI_CLI_VERSION = "1.2.3";

		expect(getGeminiCliUserAgent("gemini-2.5-flash")).toContain("GeminiCLI/9.8.7/gemini-2.5-flash");
	});

	it("falls back to the legacy PI_AI override when JWC is unset", () => {
		delete process.env.JWC_AI_GEMINI_CLI_VERSION;
		process.env.PI_AI_GEMINI_CLI_VERSION = "1.2.3";

		expect(getGeminiCliUserAgent("gemini-2.5-flash")).toContain("GeminiCLI/1.2.3/gemini-2.5-flash");
	});
});
