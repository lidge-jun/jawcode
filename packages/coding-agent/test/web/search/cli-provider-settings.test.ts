import { afterEach, beforeEach, describe, expect, it, vi } from "bun:test";
import * as path from "node:path";
import { stripVTControlCharacters } from "node:util";
import { getConfigRootDir, setAgentDir, TempDir } from "@jawcode-dev/utils";
import { runSearchCommand } from "../../../src/cli/web-search-cli";
import { resetSettingsForTest, Settings } from "../../../src/config/settings";
import { setPreferredSearchProvider } from "../../../src/web/search/provider";

// Web-search availability is env-sensitive; isolate it so resolution is deterministic.
const WEB_SEARCH_ENV_KEYS = [
	"ANTHROPIC_API_KEY",
	"BRAVE_API_KEY",
	"EXA_API_KEY",
	"JINA_API_KEY",
	"KAGI_API_KEY",
	"MOONSHOT_API_KEY",
	"MOONSHOT_SEARCH_API_KEY",
	"PARALLEL_API_KEY",
	"PERPLEXITY_API_KEY",
	"SEARXNG_ENDPOINT",
	"SYNTHETIC_API_KEY",
	"TAVILY_API_KEY",
	"XAI_API_KEY",
] as const;

const originalAgentDir = process.env.GJC_CODING_AGENT_DIR;
const fallbackAgentDir = path.join(getConfigRootDir(), "agent");

let tempAgentDir: TempDir | undefined;
let originalEnv: Partial<Record<(typeof WEB_SEARCH_ENV_KEYS)[number], string | undefined>> = {};
let originalExitCode: typeof process.exitCode;

function responseUrl(input: string | Request | URL): string {
	if (typeof input === "string") return input;
	if (input instanceof URL) return input.toString();
	return input.url;
}

function makeFetchMock(): typeof fetch {
	return Object.assign(
		async (input: string | Request | URL, _init?: RequestInit): Promise<Response> => {
			const url = responseUrl(input);
			if (url === "https://api.tavily.com/search") {
				return new Response(
					JSON.stringify({
						answer: "Tavily answer",
						results: [{ title: "Tavily result", url: "https://tavily.example", content: "tavily" }],
						request_id: "req-test",
					}),
					{ status: 200, headers: { "Content-Type": "application/json" } },
				);
			}
			return new Response(`unexpected URL: ${url}`, { status: 500 });
		},
		{ preconnect: fetch.preconnect },
	);
}

beforeEach(async () => {
	originalEnv = Object.fromEntries(WEB_SEARCH_ENV_KEYS.map(key => [key, process.env[key]]));
	for (const key of WEB_SEARCH_ENV_KEYS) delete process.env[key];
	process.env.TAVILY_API_KEY = "test-tavily-key";
	originalExitCode = process.exitCode;
	process.exitCode = undefined;

	resetSettingsForTest();
	setPreferredSearchProvider("auto");
	tempAgentDir = TempDir.createSync("@jwc-search-cli-");
	setAgentDir(tempAgentDir.path());
	await Settings.init({
		inMemory: true,
		cwd: tempAgentDir.path(),
		overrides: {
			"providers.webSearch": "tavily",
		},
	});
});

afterEach(async () => {
	vi.restoreAllMocks();
	resetSettingsForTest();
	setPreferredSearchProvider("auto");
	process.exitCode = originalExitCode;
	for (const key of WEB_SEARCH_ENV_KEYS) {
		const value = originalEnv[key];
		if (value === undefined) delete process.env[key];
		else process.env[key] = value;
	}
	if (originalAgentDir) {
		setAgentDir(originalAgentDir);
	} else {
		setAgentDir(fallbackAgentDir);
		delete process.env.GJC_CODING_AGENT_DIR;
	}
	if (tempAgentDir) {
		await tempAgentDir.remove();
		tempAgentDir = undefined;
	}
});

describe("runSearchCommand provider settings", () => {
	it("applies the configured web-search preference when no --provider flag is passed", async () => {
		vi.spyOn(globalThis, "fetch").mockImplementation(makeFetchMock());

		let stdout = "";
		vi.spyOn(process.stdout, "write").mockImplementation(chunk => {
			stdout += typeof chunk === "string" ? chunk : new TextDecoder().decode(chunk);
			return true;
		});

		await runSearchCommand({ query: "provider selection smoke test", limit: 1, expanded: false });

		const plain = stripVTControlCharacters(stdout);
		expect(plain).toContain("Provider: Tavily");
		expect(plain).not.toContain("Provider: DuckDuckGo");
	});

	it("lets an explicit --provider flag override the configured preference", async () => {
		vi.spyOn(globalThis, "fetch").mockImplementation(makeFetchMock());

		let stdout = "";
		vi.spyOn(process.stdout, "write").mockImplementation(chunk => {
			stdout += typeof chunk === "string" ? chunk : new TextDecoder().decode(chunk);
			return true;
		});

		// Explicit auto bypasses the configured "tavily" preference; with no creds
		// for keyed providers the chain falls through to keyless DuckDuckGo.
		await runSearchCommand({ query: "explicit override", provider: "auto", limit: 1, expanded: false });

		const plain = stripVTControlCharacters(stdout);
		expect(plain).not.toContain("Provider: Tavily");
	});
});
