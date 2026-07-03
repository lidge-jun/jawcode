import { afterEach, describe, expect, it, vi } from "bun:test";
import * as path from "node:path";
import type { AuthStorage } from "@jawcode-dev/ai";
import type { ToolSession } from "../../../src/tools";
import { ToolAbortError } from "../../../src/tools/tool-errors";
import { DDG_HEDGE_DELAY_MS, setDdgHedgeDelayMs, WebSearchTool } from "../../../src/web/search";
import type { SearchProvider } from "../../../src/web/search/provider";
import * as providerRegistry from "../../../src/web/search/provider";
import type { SearchParams } from "../../../src/web/search/providers/base";
import {
	applyConfiguredSearchTimeout,
	getSearchHardTimeoutMs,
	SEARCH_API_TIMEOUT_MS,
	SEARCH_HARD_TIMEOUT_MS,
	SEARCH_LLM_TIMEOUT_MS,
	setSearchHardTimeoutMs,
	withHardTimeout,
} from "../../../src/web/search/providers/utils";
import type { SearchProviderId, SearchResponse } from "../../../src/web/search/types";

function fakeStorage(): AuthStorage {
	return {
		getGeneration: () => 0,
		hasAuth: () => false,
		listAuthCredentials: () => [],
		updateAuthCredential: () => undefined,
		get authStore() {
			return null as never;
		},
	} as unknown as AuthStorage;
}

function fakeSession(authStorage: AuthStorage = fakeStorage()): ToolSession {
	return {
		authStorage,
		settings: {
			get: () => undefined,
			has: () => false,
		},
	} as unknown as ToolSession;
}

function searchResponse(provider: SearchProviderId, answer: string): SearchResponse {
	return { provider, answer, sources: [] };
}

function fakeProvider(id: SearchProviderId, search: (params: SearchParams) => Promise<SearchResponse>): SearchProvider {
	return {
		id,
		label: id,
		isAvailable: () => true,
		search,
	};
}

describe("web search timeout classes", () => {
	afterEach(() => setSearchHardTimeoutMs(undefined));

	it("keeps direct API class shorter than LLM and legacy ceilings", () => {
		expect(SEARCH_API_TIMEOUT_MS).toBeLessThan(SEARCH_LLM_TIMEOUT_MS);
		expect(SEARCH_LLM_TIMEOUT_MS).toBeLessThanOrEqual(SEARCH_HARD_TIMEOUT_MS * 2);
		expect(getSearchHardTimeoutMs("api")).toBe(SEARCH_API_TIMEOUT_MS);
		expect(getSearchHardTimeoutMs("llm")).toBe(SEARCH_LLM_TIMEOUT_MS);
		expect(getSearchHardTimeoutMs()).toBe(SEARCH_HARD_TIMEOUT_MS);
	});

	it("applies configured override only when the setting source explicitly has it", () => {
		applyConfiguredSearchTimeout({ has: () => true, get: () => 30 });
		expect(getSearchHardTimeoutMs("api")).toBe(30_000);

		applyConfiguredSearchTimeout({ has: () => false, get: () => 60 });
		expect(getSearchHardTimeoutMs("api")).toBe(SEARCH_API_TIMEOUT_MS);
	});

	it("explicit millisecond argument wins over configured and class defaults", async () => {
		setSearchHardTimeoutMs(300_000);
		const signal = withHardTimeout(undefined, 1);
		await Bun.sleep(20);
		expect(signal.aborted).toBe(true);
	});
});

describe("resolveProviderChain cache", () => {
	afterEach(() => {
		providerRegistry.setPreferredSearchProvider("auto");
		providerRegistry.clearResolvedChainCache();
		vi.restoreAllMocks();
	});

	it("skips repeated availability probes for the same storage/context/generation", async () => {
		let generation = 1;
		let availabilityChecks = 0;
		const storage = {
			getGeneration: () => generation,
			hasAuth: (name: string) => {
				if (name === "anthropic") availabilityChecks += 1;
				return name === "anthropic";
			},
		} as unknown as AuthStorage;

		const first = await providerRegistry.resolveProviderChain(storage, "auto", "anthropic");
		const second = await providerRegistry.resolveProviderChain(storage, "auto", "anthropic");

		expect(first.map(provider => provider.id)).toEqual(["anthropic", "duckduckgo"]);
		expect(second.map(provider => provider.id)).toEqual(["anthropic", "duckduckgo"]);
		expect(first).not.toBe(second);
		expect(availabilityChecks).toBe(1);

		await providerRegistry.resolveProviderChain(storage, "anthropic");
		expect(availabilityChecks).toBe(2);

		providerRegistry.setPreferredSearchProvider("anthropic");
		await providerRegistry.resolveProviderChain(storage);
		expect(availabilityChecks).toBe(3);
		await providerRegistry.resolveProviderChain(storage);
		expect(availabilityChecks).toBe(3);

		generation += 1;
		await providerRegistry.resolveProviderChain(storage, "auto", "anthropic");
		expect(availabilityChecks).toBe(4);

		providerRegistry.clearResolvedChainCache();
		await providerRegistry.resolveProviderChain(storage, "auto", "anthropic");
		expect(availabilityChecks).toBe(5);
	});
});

describe("web search DuckDuckGo hedge", () => {
	afterEach(() => {
		setDdgHedgeDelayMs();
		vi.restoreAllMocks();
	});

	it("starts one DuckDuckGo hedge before a slow primary fails", async () => {
		setDdgHedgeDelayMs(5);
		let duckCalls = 0;
		let duckStartedBeforePrimaryFailed = false;
		let primaryFailed = false;
		vi.spyOn(providerRegistry, "resolveProviderChain").mockResolvedValue([
			fakeProvider("anthropic", async () => {
				await Bun.sleep(40);
				primaryFailed = true;
				throw new Error("primary failed");
			}),
			fakeProvider("duckduckgo", async () => {
				duckCalls += 1;
				duckStartedBeforePrimaryFailed = !primaryFailed;
				return searchResponse("duckduckgo", "ddg answer");
			}),
		]);

		const result = await new WebSearchTool(fakeSession()).execute("test", { query: "hedge" });

		expect(result.content[0]?.type).toBe("text");
		expect(result.content[0] && "text" in result.content[0] ? result.content[0].text : "").toContain("ddg answer");
		expect(duckCalls).toBe(1);
		expect(duckStartedBeforePrimaryFailed).toBe(true);
	});

	it("reuses one hedge after every pre-DuckDuckGo provider fails", async () => {
		setDdgHedgeDelayMs(5);
		let duckCalls = 0;
		vi.spyOn(providerRegistry, "resolveProviderChain").mockResolvedValue([
			fakeProvider("anthropic", async () => {
				await Bun.sleep(25);
				throw new Error("first failed");
			}),
			fakeProvider("gemini", async () => {
				await Bun.sleep(25);
				throw new Error("second failed");
			}),
			fakeProvider("duckduckgo", async () => {
				duckCalls += 1;
				return searchResponse("duckduckgo", "ddg reused");
			}),
		]);

		const result = await new WebSearchTool(fakeSession()).execute("test", { query: "hedge" });

		expect(result.content[0] && "text" in result.content[0] ? result.content[0].text : "").toContain("ddg reused");
		expect(duckCalls).toBe(1);
	});

	it("ignores an aborted hedge when the primary provider succeeds", async () => {
		setDdgHedgeDelayMs(20);
		let duckCalls = 0;
		vi.spyOn(providerRegistry, "resolveProviderChain").mockResolvedValue([
			fakeProvider("anthropic", async () => {
				await Bun.sleep(5);
				return searchResponse("anthropic", "primary answer");
			}),
			fakeProvider("duckduckgo", async () => {
				duckCalls += 1;
				return searchResponse("duckduckgo", "ddg answer");
			}),
		]);

		const result = await new WebSearchTool(fakeSession()).execute("test", { query: "hedge" });
		await Bun.sleep(40);

		expect(result.content[0] && "text" in result.content[0] ? result.content[0].text : "").toContain(
			"primary answer",
		);
		expect(duckCalls).toBe(0);
	});

	it("propagates caller abort while waiting for the delayed DuckDuckGo hedge", async () => {
		setDdgHedgeDelayMs(1_000);
		let duckCalls = 0;
		vi.spyOn(providerRegistry, "resolveProviderChain").mockResolvedValue([
			fakeProvider("anthropic", async () => {
				throw new Error("primary failed");
			}),
			fakeProvider("duckduckgo", async () => {
				duckCalls += 1;
				return searchResponse("duckduckgo", "ddg answer");
			}),
		]);

		const ac = new AbortController();
		const execution = new WebSearchTool(fakeSession()).execute("test", { query: "hedge" }, ac.signal);
		await Bun.sleep(20);
		ac.abort();

		await expect(execution).rejects.toBeInstanceOf(ToolAbortError);
		expect(duckCalls).toBe(0);
	});
});

describe("web search timeout callsite rollout", () => {
	it("documents class or explicit timeout use at named provider callsites", async () => {
		const root = path.join(import.meta.dir, "../../../src");
		const apiFiles = [
			"web/search/providers/brave.ts",
			"web/search/providers/duckduckgo.ts",
			"web/search/providers/exa.ts",
			"web/search/providers/jina.ts",
			"web/search/providers/parallel.ts",
			"web/search/providers/searxng.ts",
			"web/search/providers/synthetic.ts",
			"web/search/providers/tavily.ts",
			"web/search/providers/zai.ts",
			"web/kagi.ts",
		];
		for (const file of apiFiles) {
			const source = await Bun.file(path.join(root, file)).text();
			expect(source).toContain("withHardTimeout(");
			expect(source).toContain('"api"');
		}

		const perplexity = await Bun.file(path.join(root, "web/search/providers/perplexity.ts")).text();
		expect(perplexity).toContain('"llm"');
		const kimi = await Bun.file(path.join(root, "web/search/providers/kimi.ts")).text();
		expect(kimi).toContain("withHardTimeout(params.signal, 60_000)");
		const webParallel = await Bun.file(path.join(root, "web/parallel.ts")).text();
		expect(webParallel).toContain("withHardTimeout(options.signal)");
		expect(DDG_HEDGE_DELAY_MS).toBeGreaterThan(0);
	});
});
