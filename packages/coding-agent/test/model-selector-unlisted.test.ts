/**
 * Unlisted model exposure in /model (99.30.04 S6). Models tagged
 * `unlisted: true` (not servable on the current auth path) hide by default;
 * ctrl+o reveals them with an "(unlisted)" marker and a discoverability hint
 * shows how many are hidden. The toggle is selector-scoped (expand grammar:
 * composer app.tools.expand / tree-selector filter cycle).
 */
import { beforeAll, describe, expect, test, vi } from "bun:test";
import type { Model } from "@jawcode-dev/ai";
import type { ModelRegistry } from "@jawcode-dev/coding-agent/config/model-registry";
import { Settings } from "@jawcode-dev/coding-agent/config/settings";
import { ModelSelectorComponent } from "@jawcode-dev/coding-agent/modes/components/model-selector";
import { getThemeByName, setThemeInstance, type Theme } from "@jawcode-dev/coding-agent/modes/theme/theme";
import type { TUI } from "@jawcode-dev/tui";

function normalizeRenderedText(text: string): string {
	return text
		.replace(/\x1b\[[0-9;]*m/g, "")
		.replace(/\s+/g, " ")
		.trim();
}

let testTheme: Theme | undefined;

function installTestTheme(): void {
	if (!testTheme) {
		throw new Error("Failed to load theme for ModelSelector tests");
	}
	setThemeInstance(testTheme);
}

function createProviderModel(provider: string, id: string, unlisted?: boolean): Model {
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
		...(unlisted ? { unlisted: true } : {}),
	} as unknown as Model;
}

function createRegistry(models: Model[]): ModelRegistry {
	return {
		getAll: () => models,
		getAvailable: () => models,
		refresh: vi.fn(async () => {}),
		refreshProvider: vi.fn(async () => {}),
		getError: () => undefined,
		getDiscoverableProviders: () => [],
		getCanonicalModels: () => [],
		resolveCanonicalModel: () => undefined,
		getProviderDiscoveryState: () => undefined,
	} as unknown as ModelRegistry;
}

async function createSelector(models: Model[]): Promise<ModelSelectorComponent> {
	installTestTheme();
	const ui = { requestRender: vi.fn() } as unknown as TUI;
	const selector = new ModelSelectorComponent(
		ui,
		undefined,
		Settings.isolated({}),
		createRegistry(models),
		[],
		() => {},
		() => {},
	);
	await Bun.sleep(10);
	installTestTheme();
	return selector;
}

const MODELS = [
	createProviderModel("openai-codex", "gpt-5.5"),
	createProviderModel("openai-codex", "gpt-5.1", true),
	createProviderModel("openai-codex", "codex-auto-review", true),
];

describe("ModelSelector unlisted exposure (99.30.04)", () => {
	beforeAll(async () => {
		testTheme = await getThemeByName("red-claw");
	});

	test("hides unlisted models by default and shows the ctrl+o hint", async () => {
		const selector = await createSelector(MODELS);
		const rendered = normalizeRenderedText(selector.render(220).join("\n"));
		expect(rendered).toContain("gpt-5.5");
		expect(rendered).not.toContain("gpt-5.1");
		expect(rendered).not.toContain("codex-auto-review");
		expect(rendered).toContain("ctrl+o show 2 unsupported");
	});

	test("ctrl+o reveals unlisted models with a marker and toggles back", async () => {
		const selector = await createSelector(MODELS);
		selector.handleInput("\x0f"); // ctrl+o
		let rendered = normalizeRenderedText(selector.render(220).join("\n"));
		expect(rendered).toContain("gpt-5.1 (unlisted)");
		expect(rendered).toContain("codex-auto-review (unlisted)");
		expect(rendered).toContain("ctrl+o hide unsupported");

		selector.handleInput("\x0f");
		rendered = normalizeRenderedText(selector.render(220).join("\n"));
		expect(rendered).not.toContain("gpt-5.1");
		expect(rendered).toContain("ctrl+o show 2 unsupported");
	});

	test("no hint when nothing is hidden", async () => {
		const selector = await createSelector([createProviderModel("openai-codex", "gpt-5.5")]);
		const rendered = normalizeRenderedText(selector.render(220).join("\n"));
		expect(rendered).not.toContain("ctrl+o");
	});
});

describe("onboarding hint gating (99.30.04 S8)", () => {
	test("configured installs do not see the onboarding blurb", async () => {
		const selector = await createSelector(MODELS);
		const rendered = normalizeRenderedText(selector.render(220).join("\n"));
		expect(rendered).not.toContain("Add MiniMax/GLM presets");
	});

	test("plain installs (no models) still see it", async () => {
		const selector = await createSelector([]);
		const rendered = normalizeRenderedText(selector.render(220).join("\n"));
		expect(rendered).toContain("Add MiniMax/GLM presets");
	});
});
