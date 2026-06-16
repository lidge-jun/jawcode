import { beforeAll, describe, expect, test, vi } from "bun:test";
import { ThinkingLevel } from "@gajae-code/agent-core";
import type { Model } from "@gajae-code/ai";
import type { ModelProfileDefinition } from "@gajae-code/coding-agent/config/model-profiles";
import { Settings } from "@gajae-code/coding-agent/config/settings";
import {
	ModelSelectorComponent,
	type ModelSelectorSelection,
} from "@gajae-code/coding-agent/modes/components/model-selector";
import { SelectorController } from "@gajae-code/coding-agent/modes/controllers/selector-controller";
import { getThemeByName, setThemeInstance } from "@gajae-code/coding-agent/modes/theme/theme";
import type { TUI } from "@gajae-code/tui";

const model = (provider: string, id: string): Model =>
	({ provider, id, name: id, api: "openai-responses", contextWindow: 1000, maxTokens: 1000 }) as Model;

function normalizeRenderedText(text: string): string {
	return text
		.replace(/\x1b\[[0-9;]*m/g, "")
		.replace(/\s+/g, " ")
		.trim();
}

let testTheme = await getThemeByName("red-claw");

function installTestTheme(): void {
	if (!testTheme) throw new Error("Failed to load test theme");
	setThemeInstance(testTheme);
}

const defaultModel = model("provider-a", "default");
const alternateModel = model("provider-a", "alternate");
const profile: ModelProfileDefinition = {
	name: "profile-a",
	requiredProviders: ["provider-a"],
	modelMapping: { default: "provider-a/default:high", executor: "provider-a/alternate" },
	source: "user",
};

function createRegistry(
	options: { missingCredentials?: boolean; profiles?: ModelProfileDefinition[]; models?: Model[] } = {},
) {
	const profiles = new Map((options.profiles ?? [profile]).map(profile => [profile.name, profile]));
	const models = options.models ?? [defaultModel, alternateModel];
	return {
		refresh: vi.fn(async () => {}),
		getError: () => undefined,
		getAvailable: () => models,
		getAll: () => models,
		getDiscoverableProviders: () => [],
		getCanonicalModels: () => [],
		resolveCanonicalModel: () => undefined,
		getModelProfiles: () => new Map(profiles),
		getModelProfile: (name: string) => profiles.get(name),
		getAvailableModelProfileNames: () => [...profiles.keys()],
		getApiKeyForProvider: async () => (options.missingCredentials ? undefined : "key"),
		getApiKey: async () => (options.missingCredentials ? undefined : "key"),
	};
}

function createSelector(
	onSelect: (selection: ModelSelectorSelection) => void,
	options: {
		temporaryOnly?: boolean;
		profiles?: ModelProfileDefinition[];
		models?: Model[];
		settings?: Settings;
	} = {},
) {
	const ui = { requestRender: vi.fn() } as unknown as TUI;
	return new ModelSelectorComponent(
		ui,
		undefined,
		options.settings ?? Settings.isolated(),
		createRegistry({ profiles: options.profiles, models: options.models }) as never,
		[],
		onSelect,
		() => {},
		options,
	);
}

function createControllerContext(options: { missingCredentials?: boolean } = {}) {
	const settings = Settings.isolated({
		"task.agentModelOverrides": { executor: "provider-a/original-executor" },
		"modelProfile.default": "old-profile",
	});
	const flush = vi.fn(async () => {});
	settings.flush = flush as typeof settings.flush;
	const setCalls: Array<{ path: string; value: unknown }> = [];
	const originalSet = settings.set.bind(settings);
	settings.set = ((path: never, value: never) => {
		setCalls.push({ path: path as string, value });
		return originalSet(path, value);
	}) as typeof settings.set;
	const session = {
		model: alternateModel as Model | undefined,
		thinkingLevel: ThinkingLevel.Low as ThinkingLevel | undefined,
		sessionId: "session-1",
		scopedModels: [],
		modelRegistry: createRegistry(options),
		setModelTemporaryCalls: [] as Array<{ model: Model; thinkingLevel?: ThinkingLevel }>,
		async setModelTemporary(next: Model, thinkingLevel?: ThinkingLevel) {
			this.setModelTemporaryCalls.push({ model: next, thinkingLevel });
			this.model = next;
			this.thinkingLevel = thinkingLevel;
		},
	};
	const ctx = {
		ui: { setFocus: vi.fn(), requestRender: vi.fn() },
		editorContainer: { clear: vi.fn(), addChild: vi.fn() },
		editor: {},
		settings,
		session,
		statusLine: { invalidate: vi.fn() },
		updateEditorBorderColor: vi.fn(),
		showStatus: vi.fn(),
		showError: vi.fn(),
	};
	return { ctx, settings, session, flush, setCalls };
}

async function selectFirstProfile(controller: SelectorController, setDefault = false): Promise<void> {
	controller.showModelSelector();
	const selector = (controller as unknown as { ctx: { editorContainer: { addChild: ReturnType<typeof vi.fn> } } }).ctx
		.editorContainer.addChild.mock.calls[0]?.[0] as ModelSelectorComponent;
	await Bun.sleep(10);
	installTestTheme();
	await selector.__testSelectProfile("profile-a", setDefault);
	await Bun.sleep(0);
}

describe("model selector profiles", () => {
	beforeAll(async () => {
		testTheme = await getThemeByName("red-claw");
		installTestTheme();
	});

	test("renders grouped preset browser above model rows", async () => {
		installTestTheme();
		const selector = createSelector(() => {});
		await Bun.sleep(10);
		installTestTheme();

		const rendered = normalizeRenderedText(selector.render(220).join("\n"));
		expect(rendered).toContain("Current preset: none");
		expect(rendered.indexOf("View preset configuration")).toBeGreaterThanOrEqual(0);
		expect(rendered.indexOf("Browse presets")).toBeGreaterThan(rendered.indexOf("View preset configuration"));
		expect(rendered.indexOf("provider-a/default")).toBeGreaterThan(rendered.indexOf("Browse presets"));

		selector.handleInput("\u001b[B");
		selector.handleInput("\n");
		const groups = normalizeRenderedText(selector.render(220).join("\n"));
		expect(groups).toContain("Custom");
		expect(groups).toContain("Enter to open a group");

		selector.handleInput("\n");
		const profiles = normalizeRenderedText(selector.render(220).join("\n"));
		expect(profiles).toContain("profile-a");
		expect(profiles).toContain("Enter for actions");
	});

	test("renders built-in empty custom profile slots", async () => {
		installTestTheme();
		const customProfiles: ModelProfileDefinition[] = [1, 2, 3, 4].map(index => ({
			name: `custom-${index}`,
			requiredProviders: [],
			modelMapping: {},
			source: "builtin",
		}));
		const selector = createSelector(() => {}, { profiles: customProfiles });
		await Bun.sleep(10);
		installTestTheme();

		selector.handleInput("\u001b[B");
		selector.handleInput("\n");
		const groups = normalizeRenderedText(selector.render(220).join("\n"));
		expect(groups).toContain("Custom (4)");

		selector.handleInput("\n");
		const profiles = normalizeRenderedText(selector.render(220).join("\n"));
		expect(profiles).toContain("custom-1");
		expect(profiles).toContain("custom-4");
	});

	test("current custom preset configuration renders live role mappings", async () => {
		installTestTheme();
		const settings = Settings.isolated({
			"modelProfile.default": "custom-1",
			"task.agentModelOverrides": { executor_ext: "provider-a/alternate:low" },
		});
		settings.setModelRole("default", "provider-a/default:high");
		const customProfiles: ModelProfileDefinition[] = [
			{ name: "custom-1", requiredProviders: [], modelMapping: {}, source: "builtin" },
		];
		const selector = createSelector(() => {}, { profiles: customProfiles, settings });
		await Bun.sleep(10);
		installTestTheme();

		selector.handleInput("\n");
		const rendered = normalizeRenderedText(selector.render(220).join("\n"));
		expect(rendered).toContain("custom-1 — preset configuration");
		expect(rendered).toContain("default: provider-a/default:high");
		expect(rendered).toContain("executor_ext: provider-a/alternate:low");
		expect(rendered).not.toContain("No model mappings configured");
	});

	test("refreshFromSettings immediately re-sorts model rows after default assignment changes", async () => {
		installTestTheme();
		const settings = Settings.isolated();
		const selector = createSelector(() => {}, { settings });
		await Bun.sleep(10);
		installTestTheme();

		const before = normalizeRenderedText(selector.render(220).join("\n"));
		expect(before.indexOf("provider-a/alternate")).toBeLessThan(before.indexOf("provider-a/default"));

		settings.setModelRole("default", "provider-a/default:high");
		selector.refreshFromSettings();

		const after = normalizeRenderedText(selector.render(220).join("\n"));
		expect(after.indexOf("provider-a/default")).toBeLessThan(after.indexOf("provider-a/alternate"));
		expect(after).toContain("DEFAULT (high)");
	});

	test("model action menu includes apply all roles preset", async () => {
		installTestTheme();
		let selected: ModelSelectorSelection | undefined;
		const selector = createSelector(selection => {
			selected = selection;
		});
		await Bun.sleep(10);
		installTestTheme();

		selector.handleInput("\u001b[B");
		selector.handleInput("\u001b[B");
		selector.handleInput("\n");
		for (let i = 0; i < 5; i++) selector.handleInput("\u001b[B");
		const menu = normalizeRenderedText(selector.render(220).join("\n"));
		expect(menu).toContain("Apply all roles");

		selector.handleInput("\n");
		expect(selected?.kind).toBe("preset");
		if (selected?.kind !== "preset") throw new Error("Expected preset selection");
		expect(selected.preset.id).toBe("apply-all");
		expect(selected.assignments).toEqual({
			default: ThinkingLevel.Inherit,
			executor_ext: ThinkingLevel.Inherit,
			architect: ThinkingLevel.Inherit,
			planner: ThinkingLevel.Inherit,
			critic: ThinkingLevel.Inherit,
		});
	});
	test("temporary-only mode hides Profiles", async () => {
		installTestTheme();
		const selector = createSelector(() => {}, { temporaryOnly: true });
		await Bun.sleep(10);
		installTestTheme();

		const rendered = normalizeRenderedText(selector.render(220).join("\n"));
		expect(rendered).not.toContain("Profiles");
		expect(rendered).not.toContain("profile-a");
	});

	test("grouped preset browser preserves unlisted default hiding", async () => {
		installTestTheme();
		const hidden = { ...model("provider-a", "hidden"), unlisted: true } as Model;
		const selector = createSelector(() => {}, { models: [defaultModel, hidden] });
		await Bun.sleep(10);
		installTestTheme();

		const rendered = normalizeRenderedText(selector.render(220).join("\n"));
		expect(rendered).toContain("Browse presets");
		expect(rendered).toContain("ctrl+o show 1 unsupported");
		expect(rendered).not.toContain("provider-a/hidden");

		selector.handleInput("\u000f");
		const expanded = normalizeRenderedText(selector.render(220).join("\n"));
		expect(expanded).toContain("provider-a/hidden");
		expect(expanded).toContain("unlisted");
	});

	test("Apply for this session activates profile through setModelTemporary", async () => {
		const { ctx, settings, session } = createControllerContext();
		const controller = new SelectorController(ctx as never);
		await selectFirstProfile(controller);

		expect(session.setModelTemporaryCalls).toHaveLength(1);
		expect(session.model).toBe(defaultModel);
		expect(session.thinkingLevel).toBe(ThinkingLevel.High);
		expect(settings.get("task.agentModelOverrides")).toMatchObject({ executor_ext: "provider-a/alternate" });
		expect(settings.get("modelProfile.default")).toBe("old-profile");
		expect(ctx.showStatus).toHaveBeenCalledWith("Model profile: profile-a");
	});

	test("Set as default persists and flushes modelProfile.default", async () => {
		const { ctx, flush, setCalls } = createControllerContext();
		const controller = new SelectorController(ctx as never);
		await selectFirstProfile(controller, true);

		expect(ctx.showStatus).toHaveBeenCalledWith("Default model profile: profile-a");
		expect(setCalls).toContainEqual({ path: "modelProfile.default", value: "profile-a" });
		expect(flush).toHaveBeenCalledTimes(1);
		expect(ctx.showStatus).toHaveBeenCalledWith("Default model profile: profile-a");
	});

	test("profile set-as-default stays in selector on profile details", async () => {
		const { ctx } = createControllerContext();
		const controller = new SelectorController(ctx as never);
		controller.showModelSelector();
		const selector = ctx.editorContainer.addChild.mock.calls[0]?.[0] as ModelSelectorComponent;
		await Bun.sleep(10);
		installTestTheme();

		selector.handleInput("\u001b[B");
		selector.handleInput("\n");
		selector.handleInput("\n");
		selector.handleInput("\n");
		selector.handleInput("\u001b[B");
		selector.handleInput("\n");
		await Bun.sleep(0);

		expect(ctx.editorContainer.addChild).toHaveBeenCalledTimes(1);
		const rendered = normalizeRenderedText(selector.render(220).join("\n"));
		expect(rendered).toContain("profile-a — preset configuration");
		expect(rendered).toContain("default: provider-a/default");
		expect(ctx.showStatus).toHaveBeenCalledWith("Default model profile: profile-a");
	});

	test("persistent role assignment stays in model selector and refreshes mappings", async () => {
		const { ctx, settings } = createControllerContext();
		const controller = new SelectorController(ctx as never);
		controller.showModelSelector();
		const selector = ctx.editorContainer.addChild.mock.calls[0]?.[0] as ModelSelectorComponent;
		await Bun.sleep(10);
		installTestTheme();

		selector.handleInput("\u001b[B");
		selector.handleInput("\u001b[B");
		selector.handleInput("\n");
		selector.handleInput("\u001b[B");
		selector.handleInput("\n");
		await Bun.sleep(0);

		expect(settings.get("task.agentModelOverrides").executor_ext).toMatch(/^provider-a\//);
		expect(ctx.editorContainer.addChild).toHaveBeenCalledTimes(1);
		const rendered = normalizeRenderedText(selector.render(220).join("\n"));
		expect(rendered).toContain("Models:");
	});

	test("role assignment refresh updates runtime override-backed badges without reopening selector", async () => {
		const { ctx, settings } = createControllerContext();
		settings.setModelRole("default", "provider-a/default:high");
		settings.override("task.agentModelOverrides", {
			executor_ext: "provider-a/alternate:low",
			architect: "provider-a/alternate:high",
			planner: "provider-a/default:medium",
			critic: "provider-a/default:high",
		});
		const controller = new SelectorController(ctx as never);
		controller.showModelSelector();
		const selector = ctx.editorContainer.addChild.mock.calls[0]?.[0] as ModelSelectorComponent;
		await Bun.sleep(10);
		installTestTheme();

		const before = normalizeRenderedText(selector.render(220).join("\n"));
		expect(before).toContain("provider-a/default DEFAULT (high) PLANNER (medium) CRITIC (high)");
		expect(before).toContain("provider-a/alternate EXECUTOR_EXT (low) ARCHITECT (high)");

		selector.handleInput("\u001b[B");
		selector.handleInput("\u001b[B");
		selector.handleInput("\u001b[B");
		selector.handleInput("\n");
		selector.handleInput("\u001b[B");
		selector.handleInput("\u001b[B");
		selector.handleInput("\u001b[B");
		selector.handleInput("\n");
		await Bun.sleep(0);

		const after = normalizeRenderedText(selector.render(220).join("\n"));
		expect(after).not.toContain("provider-a/default DEFAULT (high) PLANNER");
		expect(after).toContain("provider-a/alternate EXECUTOR_EXT (low) ARCHITECT (high) PLANNER (medium)");
		expect(settings.get("task.agentModelOverrides").planner).toBe("provider-a/alternate:medium");
	});

	test("failed role assignment refreshes optimistic badges back to effective settings", async () => {
		const { ctx, settings } = createControllerContext({ missingCredentials: true });
		settings.setModelRole("default", "provider-a/default:high");
		settings.override("task.agentModelOverrides", {
			executor_ext: "provider-a/alternate:low",
			architect: "provider-a/alternate:high",
			planner: "provider-a/default:medium",
			critic: "provider-a/default:high",
		});
		const controller = new SelectorController(ctx as never);
		controller.showModelSelector();
		const selector = ctx.editorContainer.addChild.mock.calls[0]?.[0] as ModelSelectorComponent;
		await Bun.sleep(10);
		installTestTheme();

		selector.handleInput("\u001b[B");
		selector.handleInput("\u001b[B");
		selector.handleInput("\u001b[B");
		selector.handleInput("\n");
		selector.handleInput("\u001b[B");
		selector.handleInput("\u001b[B");
		selector.handleInput("\u001b[B");
		selector.handleInput("\n");
		await Bun.sleep(0);

		expect(ctx.showError).toHaveBeenCalledWith("No API key for provider-a/alternate");
		expect(settings.get("task.agentModelOverrides").planner).toBe("provider-a/default:medium");
		const rendered = normalizeRenderedText(selector.render(220).join("\n"));
		expect(rendered).toContain("provider-a/default DEFAULT (high) PLANNER (medium) CRITIC (high)");
		expect(rendered).toContain("provider-a/alternate EXECUTOR_EXT (low) ARCHITECT (high)");
		expect(rendered).not.toContain("provider-a/alternate EXECUTOR_EXT (low) ARCHITECT (high) PLANNER");
	});

	test("credential failure shows error and leaves model and overrides unchanged", async () => {
		const { ctx, settings, session } = createControllerContext({ missingCredentials: true });
		const controller = new SelectorController(ctx as never);
		await selectFirstProfile(controller);

		expect(ctx.showError).toHaveBeenCalledWith(
			'Model profile "profile-a" requires credentials for: provider-a. Run /login and configure the missing provider(s), then retry.',
		);
		expect(session.setModelTemporaryCalls).toEqual([]);
		expect(session.model).toBe(alternateModel);
		expect(session.thinkingLevel).toBe(ThinkingLevel.Low);
		expect(settings.get("task.agentModelOverrides")).toEqual({ executor: "provider-a/original-executor" });
		expect(settings.get("modelProfile.default")).toBe("old-profile");
	});
});
