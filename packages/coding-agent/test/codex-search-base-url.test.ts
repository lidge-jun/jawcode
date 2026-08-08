/**
 * Codex web search must talk to the endpoint the user configured.
 *
 * The chat path resolves `model.baseUrl` and only falls back to the vendor
 * constant. Search hardcoded that constant, so someone pointing `openai-codex`
 * at a proxy or enterprise gateway had it honored for conversation and
 * silently bypassed for search — their token going to chatgpt.com instead of
 * the endpoint they chose.
 */
import { describe, expect, it } from "bun:test";
import { resolveCodexSearchBaseUrl } from "@jawcode-dev/coding-agent/web/search/providers/codex";

const VENDOR_DEFAULT = "https://chatgpt.com/backend-api";

describe("codex search endpoint resolution", () => {
	it("falls back to the vendor default when no endpoint is configured", () => {
		expect(resolveCodexSearchBaseUrl(undefined)).toBe(VENDOR_DEFAULT);
		expect(resolveCodexSearchBaseUrl("")).toBe(VENDOR_DEFAULT);
		expect(resolveCodexSearchBaseUrl("   ")).toBe(VENDOR_DEFAULT);
	});

	it("uses a configured endpoint instead of the vendor default", () => {
		expect(resolveCodexSearchBaseUrl("https://gateway.internal/backend-api")).toBe(
			"https://gateway.internal/backend-api",
		);
	});

	it("trims a trailing slash so the request path is not doubled", () => {
		// A configured `.../backend-api/` plus `/codex/responses` would otherwise
		// produce `//codex/responses`, which some gateways reject.
		expect(resolveCodexSearchBaseUrl("https://gateway.internal/backend-api/")).toBe(
			"https://gateway.internal/backend-api",
		);
		expect(resolveCodexSearchBaseUrl("https://gateway.internal/backend-api///")).toBe(
			"https://gateway.internal/backend-api",
		);
	});

	it("actually builds the request URL from the resolver", async () => {
		// Without this the suite passes even if the call site keeps using the
		// hardcoded constant — verified: ablating the URL construction left all
		// other assertions green, because they only exercise the helper.
		const source = await Bun.file(new URL("../src/web/search/providers/codex.ts", import.meta.url).pathname).text();
		const urlLine = source.split("\n").find(line => line.includes("CODEX_RESPONSES_PATH}`"));

		expect(urlLine).toBeDefined();
		expect(urlLine).toContain("resolveCodexSearchBaseUrl(");
		// Assembled rather than written literally: a bare `${...}` in a plain
		// string trips biome's noTemplateCurlyInString.
		expect(urlLine).not.toContain(`$\{CODEX_BASE_URL}`);
	});

	it("only honors the endpoint for a Codex session model", async () => {
		// Source-shape pin: the call site must gate on the session model's
		// provider. An Anthropic session must not redirect Codex search at
		// Anthropic's base URL.
		const source = await Bun.file(new URL("../src/web/search/providers/codex.ts", import.meta.url).pathname).text();
		const callSite = source.slice(source.indexOf("result = await callCodexSearch("));
		const baseUrlArg = callSite.slice(0, callSite.indexOf("});"));

		expect(baseUrlArg).toContain('params.sessionModelProvider === "openai-codex"');
		expect(baseUrlArg).toContain("params.sessionModelBaseUrl");
	});
});
