/**
 * jwc rebrand (devlog 084): /model provider tabs use short labels
 * (anthropic→CLAUDE, openai-codex→CODEX) and the local runtimes
 * (llama.cpp / lm-studio / ollama) share a single LOCAL tab that filters
 * and refreshes all member providers. The provider auth/selection dialogs
 * are not covered here — they keep raw provider ids by design.
 */
import { beforeAll, describe, expect, test, vi } from "bun:test";
import type { Model } from "@gajae-code/ai";
import type { ModelRegistry } from "@gajae-code/coding-agent/config/model-registry";
import { Settings } from "@gajae-code/coding-agent/config/settings";
import { ModelSelectorComponent } from "@gajae-code/coding-agent/modes/components/model-selector";
import { getThemeByName, setThemeInstance, type Theme } from "@gajae-code/coding-agent/modes/theme/theme";
import type { TUI } from "@gajae-code/tui";

function normalizeRenderedText(text: string): string {
	return text
		.replace(/\x1b\[[0-9;]*m/g, "")
		.replace(/\s+/g, " ")
		.trim();
}

let testTheme: Theme | undefined;

function installTestTheme(): void {
	if (!testTheme) {
		throw new Error("Failed to load dark theme for ModelSelector tests");
	}
	setThemeInstance(testTheme);
}

function createProviderModel(provider: string, id: string): Model {
	return {
		id,
		name: id,
		api: "openai-completions",
		provider,
		baseUrl: `https://example.invalid/${provider}`,
		reasoning: false,
		input: ["text"],
		cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
		contextWindow: 128_000,
		maxTokens: 8192,
	} as unknown as Model;
}

interface RegistryOptions {
	models: Model[];
	discoverableProviders?: string[];
	refreshProvider?: (providerId: string) => Promise<void>;
}

function createRegistry(options: RegistryOptions): ModelRegistry {
	return {
		getAll: () => options.models,
		getAvailable: () => options.models,
		refresh: vi.fn(async () => {}),
		refreshProvider: options.refreshProvider ?? vi.fn(async () => {}),
		getError: () => undefined,
		getDiscoverableProviders: () => options.discoverableProviders ?? [],
		getCanonicalModels: () => [],
		resolveCanonicalModel: () => undefined,
		getProviderDiscoveryState: () => undefined,
	} as unknown as ModelRegistry;
}

function createSelector(modelRegistry: ModelRegistry): ModelSelectorComponent {
	const ui = { requestRender: vi.fn() } as unknown as TUI;
	return new ModelSelectorComponent(
		ui,
		undefined,
		Settings.isolated({}),
		modelRegistry,
		[],
		() => {},
		() => {},
	);
}

describe("ModelSelector provider tab rebrand (devlog 084)", () => {
	beforeAll(async () => {
		testTheme = await getThemeByName("red-claw");
	});

	test("anthropic and openai-codex tabs render short labels", async () => {
		installTestTheme();
		const registry = createRegistry({
			models: [
				createProviderModel("anthropic", "claude-test-model"),
				createProviderModel("openai-codex", "codex-test-model"),
			],
		});
		const selector = createSelector(registry);
		await Bun.sleep(0);
		installTestTheme();

		const rendered = normalizeRenderedText(selector.render(220).join("\n"));
		expect(rendered).toContain("CLAUDE");
		expect(rendered).toContain("CODEX");
		expect(rendered).not.toContain("ANTHROPIC");
		expect(rendered).not.toContain("OPENAI CODEX");
	});

	test("local runtimes collapse into a single LOCAL tab", async () => {
		installTestTheme();
		const registry = createRegistry({
			models: [createProviderModel("ollama", "llama3")],
			discoverableProviders: ["llama.cpp", "lm-studio", "ollama"],
		});
		const selector = createSelector(registry);
		await Bun.sleep(0);
		installTestTheme();

		const rendered = normalizeRenderedText(selector.render(220).join("\n"));
		expect(rendered).toContain("LOCAL");
		expect(rendered).not.toContain("LLAMA.CPP");
		expect(rendered).not.toContain("LM STUDIO");
		expect(rendered).not.toContain("OLLAMA");
	});

	test("ollama-cloud stays a separate tab outside LOCAL", async () => {
		installTestTheme();
		const registry = createRegistry({
			models: [createProviderModel("ollama-cloud", "deepseek-v4-pro")],
			discoverableProviders: ["ollama", "ollama-cloud"],
		});
		const selector = createSelector(registry);
		await Bun.sleep(0);
		installTestTheme();

		const rendered = normalizeRenderedText(selector.render(220).join("\n"));
		expect(rendered).toContain("LOCAL");
		expect(rendered).toContain("OLLAMA CLOUD");
	});

	test("LOCAL tab lists models from every member provider", async () => {
		installTestTheme();
		const registry = createRegistry({
			models: [
				createProviderModel("llama.cpp", "llamacpp-model"),
				createProviderModel("lm-studio", "lmstudio-model"),
				createProviderModel("ollama", "ollama-model"),
				createProviderModel("anthropic", "claude-test-model"),
			],
		});
		const selector = createSelector(registry);
		await Bun.sleep(0);
		installTestTheme();

		// Tabs sort by label: ALL, CANONICAL, CLAUDE, LOCAL → three tab presses.
		selector.handleInput("\t");
		selector.handleInput("\t");
		selector.handleInput("\t");
		await Bun.sleep(0);
		installTestTheme();

		const rendered = normalizeRenderedText(selector.render(220).join("\n"));
		expect(rendered).toContain("llamacpp-model");
		expect(rendered).toContain("lmstudio-model");
		expect(rendered).toContain("ollama-model");
		expect(rendered).not.toContain("claude-test-model");
	});

	test("LOCAL tab refresh hits every member provider id", async () => {
		installTestTheme();
		const refreshed: string[] = [];
		const registry = createRegistry({
			models: [
				createProviderModel("llama.cpp", "llamacpp-model"),
				createProviderModel("lm-studio", "lmstudio-model"),
				createProviderModel("ollama", "ollama-model"),
			],
			refreshProvider: async (providerId: string) => {
				refreshed.push(providerId);
			},
		});
		const selector = createSelector(registry);
		await Bun.sleep(0);
		installTestTheme();

		// Tabs: ALL, CANONICAL, LOCAL → two tab presses activate LOCAL.
		selector.handleInput("\t");
		selector.handleInput("\t");
		await Bun.sleep(0);

		expect(refreshed).toEqual(["llama.cpp", "lm-studio", "ollama"]);
		expect(refreshed).not.toContain("LOCAL");
	});
});
