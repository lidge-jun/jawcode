/**
 * ALL-tab preset header layout (99.30.04 successor). With profiles present,
 * preset controls render above the normal model list: current preset,
 * configuration preview, grouped preset browser, then filtered models.
 */
import { beforeAll, describe, expect, test, vi } from "bun:test";
import type { Model } from "@jawcode-dev/ai";
import type { ModelProfileDefinition } from "@jawcode-dev/coding-agent/config/model-profiles";
import type { ModelRegistry } from "@jawcode-dev/coding-agent/config/model-registry";
import { Settings } from "@jawcode-dev/coding-agent/config/settings";
import { ModelSelectorComponent } from "@jawcode-dev/coding-agent/modes/components/model-selector";
import { getThemeByName, setThemeInstance, type Theme } from "@jawcode-dev/coding-agent/modes/theme/theme";
import type { TUI } from "@jawcode-dev/tui";

function stripAnsi(text: string): string {
	return text.replace(/\x1b\[[0-9;]*m/g, "");
}

let testTheme: Theme | undefined;

function installTestTheme(): void {
	if (!testTheme) throw new Error("theme not loaded");
	setThemeInstance(testTheme);
}

function createModel(provider: string, id: string): Model {
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

const PROFILE: ModelProfileDefinition = {
	name: "profile-a",
	requiredProviders: ["openai-codex"],
	modelMapping: { default: "openai-codex/gpt-5.5" },
	source: "user",
};

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
		getModelProfiles: () => new Map([[PROFILE.name, PROFILE]]),
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
		{ currentProfileName: PROFILE.name },
	);
	await Bun.sleep(10);
	installTestTheme();
	return selector;
}

const MODELS = [createModel("openai-codex", "gpt-5.5"), createModel("openai-codex", "gpt-5.4")];

describe("ModelSelector ALL-tab preset header layout (99.30.04)", () => {
	beforeAll(async () => {
		testTheme = await getThemeByName("red-claw");
	});

	test("preset controls render above filtered models", async () => {
		const selector = await createSelector(MODELS);
		const rendered = stripAnsi(selector.render(220).join("\n"));
		expect(rendered.indexOf("Current preset: profile-a")).toBeGreaterThanOrEqual(0);
		expect(rendered.indexOf("View preset configuration")).toBeGreaterThan(rendered.indexOf("Current preset"));
		expect(rendered.indexOf("Browse presets")).toBeGreaterThan(rendered.indexOf("View preset configuration"));
		expect(rendered.indexOf("openai-codex/gpt-5.5")).toBeGreaterThan(rendered.indexOf("Browse presets"));
		expect(rendered).not.toContain("│");
	});

	test("view preset configuration shows current profile mappings", async () => {
		const selector = await createSelector(MODELS);
		selector.handleInput("\n");
		const rendered = stripAnsi(selector.render(220).join("\n"));
		expect(rendered).toContain("profile-a — preset configuration");
		expect(rendered).toContain("default: openai-codex/gpt-5.5");
	});

	test("down from preset controls reaches models; enter targets a model", async () => {
		const selector = await createSelector(MODELS);
		selector.handleInput("\x1b[B");
		selector.handleInput("\x1b[B");
		selector.handleInput("\n");
		const rendered = stripAnsi(selector.render(220).join("\n"));
		expect(rendered).toContain("Action for: gpt-5.5");
	});

	test("arrow keys keep cycling tabs", async () => {
		const selector = await createSelector(MODELS);
		selector.handleInput("\x1b[C");
		await Bun.sleep(0);
		const rendered = stripAnsi(selector.render(220).join("\n"));
		expect(rendered).not.toContain("Current preset");
	});
});
