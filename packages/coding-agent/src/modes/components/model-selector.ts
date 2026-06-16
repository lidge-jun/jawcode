import { ThinkingLevel } from "@gajae-code/agent-core";
import { clampThinkingLevelForModel, getSupportedEfforts, type Model, modelsAreEqual } from "@gajae-code/ai";
import {
	Container,
	fuzzyFilter,
	getKeybindings,
	Input,
	matchesKey,
	Spacer,
	type Tab,
	TabBar,
	Text,
	type TUI,
} from "@gajae-code/tui";
import type { ModelProfileDefinition } from "../../config/model-profiles";
import type { JwcModelSelectorTargetId, ModelRegistry } from "../../config/model-registry";
import { JWC_MODEL_ASSIGNMENT_TARGET_IDS, JWC_MODEL_ASSIGNMENT_TARGETS } from "../../config/model-registry";
import {
	formatModelSelectorValue,
	resolveModelRoleValue,
	type ScopedModelSelection,
} from "../../config/model-resolver";
import type { Settings } from "../../config/settings";
import { type ThemeColor, theme } from "../../modes/theme/theme";
import { formatModelOnboardingInlineHint } from "../../setup/model-onboarding-guidance";
import { getThinkingLevelMetadata, parseThinkingLevel } from "../../thinking";
import { getTabBarTheme } from "../shared";
import { DynamicBorder } from "./dynamic-border";

function makeInvertedBadge(label: string, color: ThemeColor): string {
	const fgAnsi = theme.getFgAnsi(color);
	const bgAnsi = fgAnsi.replace(/\x1b\[38;/g, "\x1b[48;");
	return `${bgAnsi}\x1b[30m ${label} \x1b[39m\x1b[49m`;
}

function normalizeSearchText(value: string): string {
	return value
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, " ")
		.trim();
}

function compactSearchText(value: string): string {
	return value.toLowerCase().replace(/[^a-z0-9]+/g, "");
}

function getAlphaSearchTokens(query: string): string[] {
	return [...normalizeSearchText(query).matchAll(/[a-z]+/g)].map(match => match[0]).filter(token => token.length > 0);
}

function computeModelRank(model: Model, roles: Record<string, RoleAssignment | undefined>): number {
	return roles.default && modelsAreEqual(roles.default.model, model) ? 0 : 1;
}

interface ModelItem {
	kind: "provider";
	provider: string;
	id: string;
	model: Model;
	selector: string;
	thinkingLevel?: ThinkingLevel;
	explicitThinkingLevel?: boolean;
}

interface CanonicalModelItem {
	kind: "canonical";
	id: string;
	model: Model;
	selector: string;
	variantCount: number;
	searchText: string;
	normalizedSearchText: string;
	compactSearchText: string;
	thinkingLevel?: ThinkingLevel;
	explicitThinkingLevel?: boolean;
}

interface ProfileItem {
	kind: "profile";
	name: string;
	profile: ModelProfileDefinition;
}

interface ProfileGroup {
	id: string;
	label: string;
	description: string;
	profiles: ProfileItem[];
}

interface ProfileGroupDefinition {
	id: string;
	label: string;
	description: string;
	matches: (profile: ProfileItem) => boolean;
}

interface ProfileActionItem {
	kind: "profile-action";
	profile: ProfileItem;
}

type ProfileMenuState =
	| { kind: "groups" }
	| { kind: "profiles"; group: ProfileGroup }
	| { kind: "details"; profile: ProfileItem };
type ActionMenuItem = ModelItem | CanonicalModelItem | ProfileActionItem;

type ScopedModelItem = ScopedModelSelection;

interface RoleAssignment {
	model: Model;
	thinkingLevel: ThinkingLevel;
}

export interface ModelAssignmentPreset {
	id: "openai-codex" | "apply-all";
	label: string;
	description: string;
	assignments: Partial<Record<JwcModelSelectorTargetId, ThinkingLevel>>;
}

export type ModelSelectorSelection =
	| {
			kind: "assignment";
			model: Model;
			role: JwcModelSelectorTargetId | null;
			thinkingLevel?: ThinkingLevel;
			selector?: string;
	  }
	| {
			kind: "preset";
			model: Model;
			selector: string;
			preset: ModelAssignmentPreset;
			assignments: Partial<Record<JwcModelSelectorTargetId, ThinkingLevel>>;
	  }
	| {
			kind: "profile";
			profileName: string;
			setDefault: boolean;
	  };

interface PendingThinkingChoice {
	item: ModelItem | CanonicalModelItem;
	role: JwcModelSelectorTargetId | "all" | null;
	levels: ThinkingLevel[];
}

type RoleSelectCallback = (selection: ModelSelectorSelection) => void | Promise<void>;
type CancelCallback = () => void;

interface ProviderTabState {
	id: string;
	label: string;
	providerIds?: string[];
}
const ALL_TAB = "ALL";
const CANONICAL_TAB = "CANONICAL";

// jwc rebrand: short tab labels for the /model selector only — the provider
// auth/selection dialogs keep the raw provider ids.
const PROVIDER_TAB_LABEL_OVERRIDES: Record<string, string> = {
	anthropic: "CLAUDE",
	"openai-codex": "CODEX",
};

// Local runtimes share one LOCAL tab instead of three rarely-used tabs.
// ollama-cloud is a hosted provider and intentionally NOT part of this group.
const LOCAL_TAB = "LOCAL";
const LOCAL_TAB_PROVIDERS: readonly string[] = ["llama.cpp", "lm-studio", "ollama"];

const STATIC_PROVIDER_TABS: ProviderTabState[] = [
	{ id: ALL_TAB, label: ALL_TAB },
	{ id: CANONICAL_TAB, label: CANONICAL_TAB },
];
const OPENAI_CODE_PROFILE_PRESET: ModelAssignmentPreset = {
	id: "openai-codex",
	label: "Apply OpenAI Codex role preset",
	description: "Default medium, External Executor low, Architect xhigh, Planner medium, Critic high",
	assignments: {
		default: ThinkingLevel.Medium,
		executor_ext: ThinkingLevel.Low,
		architect: ThinkingLevel.XHigh,
		planner: ThinkingLevel.Medium,
		critic: ThinkingLevel.High,
	},
};

const APPLY_ALL_ROLES_PRESET: ModelAssignmentPreset = {
	id: "apply-all",
	label: "Apply all roles",
	description: "Use this model for default and all role agents",
	assignments: {
		default: ThinkingLevel.Inherit,
		executor_ext: ThinkingLevel.Inherit,
		architect: ThinkingLevel.Inherit,
		planner: ThinkingLevel.Inherit,
		critic: ThinkingLevel.Inherit,
	},
};

const PROFILE_GROUP_DEFINITIONS: readonly ProfileGroupDefinition[] = [
	{
		id: "codex",
		label: "Codex",
		description: "OpenAI Codex profiles",
		matches: profile => profile.name.startsWith("codex-"),
	},
	{
		id: "opencode-go",
		label: "OpenCode Go",
		description: "OpenCode Go profiles",
		matches: profile => profile.name.startsWith("opencode-go-") && !profile.name.includes("-codex-"),
	},
	{
		id: "opencode-go-codex",
		label: "OpenCode Go + Codex",
		description: "OpenCode Go defaults + Codex review",
		matches: profile => profile.name.startsWith("opencode-go-codex-"),
	},
	{
		id: "coding-plans",
		label: "Coding Plans",
		description: "MiniMax/Kimi/GLM-zAI profiles",
		matches: profile =>
			profile.name.startsWith("minimax-") || profile.name.startsWith("kimi-") || profile.name.startsWith("glm-"),
	},
];

const CUSTOM_PROFILE_GROUP_DEFINITION: Omit<ProfileGroupDefinition, "matches"> = {
	id: "custom",
	label: "Custom",
	description: "User-defined profiles",
};

function formatProviderTabLabel(providerId: string): string {
	return PROVIDER_TAB_LABEL_OVERRIDES[providerId] ?? providerId.replace(/[-_]+/g, " ").toUpperCase();
}

function createProviderTab(providerId: string): ProviderTabState {
	return { id: providerId, label: formatProviderTabLabel(providerId), providerIds: [providerId] };
}
/**
 * Component that renders a canonical model selector with provider tabs.
 * - Tab/Arrow Left/Right: Switch between provider tabs
 * - Arrow Up/Down: Navigate model list
 * - Enter: Open assignment actions for default plus GJC role-agent models
 * - Escape: Close selector
 */

export class ModelSelectorComponent extends Container {
	#searchInput: Input;
	#headerContainer: Container;
	#tabBar: TabBar | null = null;
	#listContainer: Container;
	#allModels: ModelItem[] = [];
	#filteredModels: ModelItem[] = [];
	#canonicalModels: CanonicalModelItem[] = [];
	#filteredCanonicalModels: CanonicalModelItem[] = [];
	#profileItems: ProfileItem[] = [];
	#selectedIndex: number = 0;
	/** ctrl+o toggle: reveal models tagged `unlisted` (hidden by default). */
	#showUnlisted = false;
	#hiddenUnlistedCount = 0;
	/** ALL-tab split view (99.30.04 S7): which pane owns the cursor. */
	#activePaneId: "profiles" | "models" = "profiles";
	#profileSelectedIndex = 0;
	#roles = {} as Record<string, RoleAssignment | undefined>;
	#settings = null as unknown as Settings;
	#modelRegistry = null as unknown as ModelRegistry;
	#onSelectCallback = (() => {}) as RoleSelectCallback;
	#onCancelCallback = (() => {}) as CancelCallback;
	#errorMessage?: unknown;
	#tui: TUI;
	#scopedModels: ReadonlyArray<ScopedModelItem>;
	#temporaryOnly: boolean;
	#pendingActionItem?: ActionMenuItem;
	#selectedActionIndex: number = 0;
	#pendingThinkingChoice?: PendingThinkingChoice;
	#profileMenuState?: ProfileMenuState;
	#selectedProfileGroupIndex = 0;
	#selectedProfileMenuIndex = 0;
	#selectedPresetHeaderIndex = 0;
	#currentProfileName?: string;
	#selectedThinkingIndex: number = 0;

	// Tab state
	#providers: ProviderTabState[] = STATIC_PROVIDER_TABS;
	#activeTabIndex: number = 0;

	constructor(
		tui: TUI,
		_currentModel: Model | undefined,
		settings: Settings,
		modelRegistry: ModelRegistry,
		scopedModels: ReadonlyArray<ScopedModelItem>,
		onSelect: RoleSelectCallback,
		onCancel: () => void,
		options?: { temporaryOnly?: boolean; initialSearchInput?: string; currentProfileName?: string },
	) {
		super();

		this.#tui = tui;
		this.#settings = settings;
		this.#modelRegistry = modelRegistry;
		this.#scopedModels = scopedModels;
		this.#onSelectCallback = onSelect;
		this.#onCancelCallback = onCancel;
		this.#temporaryOnly = options?.temporaryOnly ?? false;
		const initialSearchInput = options?.initialSearchInput;
		this.#currentProfileName = options?.currentProfileName;

		// Load current role assignments from settings
		this.#loadRoleModels();

		// Add top border
		this.addChild(new DynamicBorder());
		this.addChild(new Spacer(1));

		// Scope notice always shows; the onboarding blurb only belongs to a
		// plain install — with providers already configured it is four lines
		// of noise on every /model open (99.30.04 S8).
		const hasModels = (() => {
			try {
				return this.#modelRegistry.getAvailable().length > 0;
			} catch {
				return false;
			}
		})();
		const hintText =
			scopedModels.length > 0
				? "Showing models from --models scope"
				: hasModels
					? undefined
					: formatModelOnboardingInlineHint();
		if (hintText) {
			this.addChild(new Text(theme.fg("warning", hintText), 0, 0));
			this.addChild(new Spacer(1));
		}

		// Create header container for tab bar
		this.#headerContainer = new Container();
		this.addChild(this.#headerContainer);

		this.addChild(new Spacer(1));

		// Create search input
		this.#searchInput = new Input();
		if (initialSearchInput) {
			this.#searchInput.setValue(initialSearchInput);
		}
		this.#searchInput.onSubmit = () => {
			if (this.#isTwoPane() && this.#activePaneId === "profiles") {
				this.#handlePresetHeaderSubmit();
				return;
			}
			const selectedItem = this.#getSelectedItem();
			if (selectedItem) {
				this.#beginActionMenuOrSelect(selectedItem);
			}
		};
		this.addChild(this.#searchInput);

		this.addChild(new Spacer(1));

		// Create list container
		this.#listContainer = new Container();
		this.addChild(this.#listContainer);

		this.addChild(new Spacer(1));

		// Add bottom border
		this.addChild(new DynamicBorder());

		// Load models and do initial render
		this.#loadModels().then(() => {
			this.#buildProviderTabs();
			this.#updateTabBar();
			// Always apply the current search query — the user may have typed
			// while models were loading asynchronously.
			const currentQuery = this.#searchInput.getValue();
			if (currentQuery) {
				this.#filterModels(currentQuery);
			} else {
				this.#applyTabFilter();
			}
			// Request re-render after models are loaded
			this.#tui.requestRender();
		});
	}

	#loadRoleModels(): void {
		const allModels = this.#modelRegistry.getAll();
		const matchPreferences = { usageOrder: this.#settings.getStorage()?.getModelUsageOrder() };
		const agentModelOverrides = this.#settings.get("task.agentModelOverrides");
		for (const role of JWC_MODEL_ASSIGNMENT_TARGET_IDS) {
			const target = JWC_MODEL_ASSIGNMENT_TARGETS[role];
			const roleValue =
				target.settingsPath === "modelRoles"
					? this.#settings.getModelRole(role)
					: role === "executor_ext"
						? (agentModelOverrides.executor_ext ?? agentModelOverrides.executor)
						: agentModelOverrides[role];
			if (!roleValue) continue;

			const resolved = resolveModelRoleValue(roleValue, allModels, {
				settings: this.#settings,
				matchPreferences,
				modelRegistry: this.#modelRegistry,
			});
			if (resolved.model) {
				this.#roles[role] = {
					model: resolved.model,
					thinkingLevel:
						resolved.explicitThinkingLevel && resolved.thinkingLevel !== undefined
							? resolved.thinkingLevel
							: ThinkingLevel.Inherit,
				};
			}
		}
	}

	#sortModels(models: ModelItem[]): void {
		// Sort: default-tagged model first, then MRU, then alphabetical
		const mruOrder = this.#settings.getStorage()?.getModelUsageOrder() ?? [];
		const mruIndex = new Map(mruOrder.map((key, i) => [key, i]));

		const modelRank = (item: ModelItem) => computeModelRank(item.model, this.#roles);

		const dateRe = /-(\d{8})$/;
		const latestRe = /-latest$/;

		models.sort((a, b) => {
			const aKey = a.selector;
			const bKey = b.selector;

			const aRank = modelRank(a);
			const bRank = modelRank(b);
			if (aRank !== bRank) return aRank - bRank;

			// Then MRU order (models in mruIndex come before those not in it)
			const aMru = mruIndex.get(aKey) ?? Number.MAX_SAFE_INTEGER;
			const bMru = mruIndex.get(bKey) ?? Number.MAX_SAFE_INTEGER;
			if (aMru !== bMru) return aMru - bMru;

			// By provider, then recency within provider
			const providerCmp = a.provider.localeCompare(b.provider);
			if (providerCmp !== 0) return providerCmp;

			// Priority field (lower = better, e.g. OpenAI code backend priority values)
			const aPri = a.model.priority ?? Number.MAX_SAFE_INTEGER;
			const bPri = b.model.priority ?? Number.MAX_SAFE_INTEGER;
			if (aPri !== bPri) return aPri - bPri;

			// Version number descending (higher version = better model)
			const aVer = extractVersionNumber(a.id);
			const bVer = extractVersionNumber(b.id);
			if (aVer !== bVer) return bVer - aVer;

			const aIsLatest = latestRe.test(a.id);
			const bIsLatest = latestRe.test(b.id);
			const aDate = a.id.match(dateRe)?.[1] ?? "";
			const bDate = b.id.match(dateRe)?.[1] ?? "";

			// Both have dates or latest tags — sort by recency
			const aHasRecency = aIsLatest || aDate !== "";
			const bHasRecency = bIsLatest || bDate !== "";

			// Models with recency info come before those without
			if (aHasRecency !== bHasRecency) return aHasRecency ? -1 : 1;

			// If neither has recency info, fall back to alphabetical
			if (!aHasRecency) return a.id.localeCompare(b.id);

			// -latest always sorts first within recency group
			if (aIsLatest !== bIsLatest) return aIsLatest ? -1 : 1;

			// Both have dates — descending (newest first)
			if (aDate && bDate) return bDate.localeCompare(aDate);

			// One has date, other is latest — latest first
			return aIsLatest ? -1 : bIsLatest ? 1 : a.id.localeCompare(b.id);
		});
	}

	#sortCanonicalModels(models: CanonicalModelItem[]): void {
		const mruOrder = this.#settings.getStorage()?.getModelUsageOrder() ?? [];
		const mruIndex = new Map(mruOrder.map((key, i) => [key, i]));

		const modelRank = (item: CanonicalModelItem) => computeModelRank(item.model, this.#roles);

		models.sort((a, b) => {
			const aRank = modelRank(a);
			const bRank = modelRank(b);
			if (aRank !== bRank) return aRank - bRank;

			const aMru = mruIndex.get(`${a.model.provider}/${a.model.id}`) ?? Number.MAX_SAFE_INTEGER;
			const bMru = mruIndex.get(`${b.model.provider}/${b.model.id}`) ?? Number.MAX_SAFE_INTEGER;
			if (aMru !== bMru) return aMru - bMru;

			const providerCmp = a.model.provider.localeCompare(b.model.provider);
			if (providerCmp !== 0) return providerCmp;

			return a.id.localeCompare(b.id);
		});
	}

	async #loadModels(): Promise<void> {
		let models: ModelItem[];

		// Use scoped models if provided via --models flag
		if (this.#scopedModels.length > 0) {
			models = this.#scopedModels.map(scoped => ({
				kind: "provider",
				provider: scoped.model.provider,
				id: scoped.model.id,
				model: scoped.model,
				selector: `${scoped.model.provider}/${scoped.model.id}`,
				thinkingLevel: scoped.thinkingLevel,
				explicitThinkingLevel: scoped.explicitThinkingLevel,
			}));
		} else {
			// Reload config and cached discovery state without blocking on live provider refresh
			await this.#modelRegistry.refresh("offline");

			// Check for models.json errors
			const loadError = this.#modelRegistry.getError();
			if (loadError) {
				this.#errorMessage = loadError;
			} else {
				this.#errorMessage = undefined;
			}

			// Load available models (built-in models still work even if models.json failed)
			try {
				const availableModels = this.#modelRegistry.getAvailable();
				models = availableModels.map((model: Model) => ({
					kind: "provider",
					provider: model.provider,
					id: model.id,
					model,
					selector: `${model.provider}/${model.id}`,
				}));
			} catch (error) {
				this.#allModels = [];
				this.#filteredModels = [];
				this.#canonicalModels = [];
				this.#filteredCanonicalModels = [];
				this.#errorMessage = error instanceof Error ? error.message : String(error);
				return;
			}
		}

		const candidateModels = models.map(item => item.model);
		const canonicalRecords = this.#modelRegistry.getCanonicalModels({
			availableOnly: this.#scopedModels.length === 0,
			candidates: candidateModels,
		});
		const scopedThinkingBySelector = new Map(models.map(item => [item.selector, item.thinkingLevel]));
		const canonicalModels = canonicalRecords
			.map((record): CanonicalModelItem | undefined => {
				const selectedModel = this.#modelRegistry.resolveCanonicalModel(record.id, {
					availableOnly: this.#scopedModels.length === 0,
					candidates: candidateModels,
				});
				if (!selectedModel) return undefined;
				const selectedSelector = `${selectedModel.provider}/${selectedModel.id}`;
				const searchText = [
					record.id,
					record.name,
					selectedModel.provider,
					selectedModel.id,
					selectedModel.name,
					...record.variants.flatMap(variant => [variant.selector, variant.model.name]),
				].join(" ");
				const item: CanonicalModelItem = {
					kind: "canonical",
					id: record.id,
					model: selectedModel,
					selector: record.id,
					variantCount: record.variants.length,
					searchText,
					normalizedSearchText: normalizeSearchText(searchText),
					compactSearchText: compactSearchText(searchText),
				};
				const scopedThinkingLevel = scopedThinkingBySelector.get(selectedSelector);
				if (scopedThinkingLevel !== undefined) {
					item.thinkingLevel = scopedThinkingLevel;
				}
				const scopedModel = models.find(model => `${model.model.provider}/${model.model.id}` === selectedSelector);
				if (scopedModel?.explicitThinkingLevel !== undefined) {
					item.explicitThinkingLevel = scopedModel.explicitThinkingLevel;
				}
				return item;
			})
			.filter((item): item is CanonicalModelItem => item !== undefined);

		this.#sortModels(models);
		this.#sortCanonicalModels(canonicalModels);
		const profiles = this.#modelRegistry.getModelProfiles?.() ?? new Map();
		const profileItems = this.#temporaryOnly
			? []
			: [...profiles.values()]
					.sort((a, b) => a.name.localeCompare(b.name))
					.map(profile => ({ kind: "profile" as const, name: profile.name, profile }));

		this.#allModels = models;
		this.#canonicalModels = canonicalModels;
		// Route through the filter so the unlisted gate applies on initial load
		// too, not only after a search/tab/ctrl+o interaction.
		this.#filteredModels = this.#showUnlisted ? models : models.filter(item => item.model.unlisted !== true);
		this.#filteredCanonicalModels = this.#showUnlisted
			? canonicalModels
			: canonicalModels.filter(item => item.model.unlisted !== true);
		this.#hiddenUnlistedCount = this.#showUnlisted ? 0 : models.length - this.#filteredModels.length;
		this.#profileItems = profileItems;
		this.#selectedIndex = Math.min(this.#selectedIndex, Math.max(0, this.#filteredModels.length - 1));
	}

	#buildProviderTabs(): void {
		const activeTabId = this.#getActiveTab().id;
		const providerSet = new Set<string>();
		for (const item of this.#allModels) {
			providerSet.add(item.provider);
		}
		for (const provider of this.#modelRegistry.getDiscoverableProviders()) {
			providerSet.add(provider);
		}
		const localProviders = LOCAL_TAB_PROVIDERS.filter(provider => providerSet.has(provider));
		for (const provider of localProviders) {
			providerSet.delete(provider);
		}
		const providerTabs = Array.from(providerSet).map(createProviderTab);
		if (localProviders.length > 0) {
			providerTabs.push({ id: LOCAL_TAB, label: LOCAL_TAB, providerIds: localProviders });
		}
		providerTabs.sort((left, right) => left.label.localeCompare(right.label));
		this.#providers = [...STATIC_PROVIDER_TABS, ...providerTabs];
		const activeIndex = this.#providers.findIndex(tab => tab.id === activeTabId);
		this.#activeTabIndex =
			activeIndex >= 0 ? activeIndex : Math.min(this.#activeTabIndex, this.#providers.length - 1);
	}

	async #refreshSelectedProvider(): Promise<void> {
		const providerIds = this.#getActiveProviderIds();
		if (this.#scopedModels.length > 0 || !providerIds || providerIds.length === 0) {
			return;
		}
		for (const providerId of providerIds) {
			await this.#modelRegistry.refreshProvider(providerId);
		}
		await this.#loadModels();
		this.#buildProviderTabs();
		this.#updateTabBar();
		this.#applyTabFilter();
		this.#tui.requestRender();
	}

	#updateTabBar(): void {
		this.#headerContainer.clear();

		const tabs: Tab[] = this.#providers.map(provider => ({ id: provider.id, label: provider.label }));
		const tabBar = new TabBar("Models", tabs, getTabBarTheme(), this.#activeTabIndex);
		tabBar.onTabChange = (_tab, index) => {
			this.#activeTabIndex = index;
			this.#selectedIndex = 0;
			this.#profileSelectedIndex = 0;
			this.#activePaneId = "profiles";
			this.#applyTabFilter();
			void this.#refreshSelectedProvider().catch(error => {
				this.#errorMessage = error instanceof Error ? error.message : String(error);
				this.#updateList();
				this.#tui.requestRender();
			});
		};
		this.#tabBar = tabBar;
		this.#headerContainer.addChild(tabBar);
	}

	#getActiveTab(): ProviderTabState {
		return this.#providers[this.#activeTabIndex] ?? STATIC_PROVIDER_TABS[0]!;
	}

	#getActiveTabId(): string {
		return this.#getActiveTab().id;
	}

	#getActiveProviderIds(): string[] | undefined {
		return this.#getActiveTab().providerIds;
	}

	#isCanonicalTab(): boolean {
		return this.#getActiveTabId() === CANONICAL_TAB;
	}

	#filterModels(query: string): void {
		const activeTabId = this.#getActiveTabId();
		const activeProviderIds = this.#getActiveProviderIds();
		const isCanonicalTab = activeTabId === CANONICAL_TAB;

		// Start with all models or filter by provider/canonical view
		let baseModels = this.#allModels;
		let baseCanonicalModels = this.#canonicalModels;
		if (activeProviderIds && activeProviderIds.length > 0) {
			baseModels = this.#allModels.filter(m => activeProviderIds.includes(m.provider));
		}

		// Unlisted models (not servable on the current auth path) hide by
		// default; ctrl+o reveals them (99.30.04).
		const shouldHideUnlisted = this.#scopedModels.length === 0 && !this.#showUnlisted;
		const unlistedInView = shouldHideUnlisted
			? isCanonicalTab
				? baseCanonicalModels.filter(item => item.model.unlisted === true).length
				: baseModels.filter(item => item.model.unlisted === true).length
			: 0;
		this.#hiddenUnlistedCount = unlistedInView;
		if (shouldHideUnlisted) {
			baseModels = baseModels.filter(item => item.model.unlisted !== true);
			baseCanonicalModels = baseCanonicalModels.filter(item => item.model.unlisted !== true);
		}

		// Apply fuzzy filter if query is present
		if (query.trim()) {
			// If user is searching from a provider tab, auto-switch to ALL to show global provider results.
			if (activeProviderIds && activeProviderIds.length > 0 && !isCanonicalTab) {
				this.#activeTabIndex = 0;
				if (this.#tabBar && this.#tabBar.getActiveIndex() !== 0) {
					this.#tabBar.setActiveIndex(0);
					return;
				}
				this.#updateTabBar();
				baseModels = this.#allModels;
			}

			if (isCanonicalTab) {
				const alphaTokens = getAlphaSearchTokens(query);
				const alphaFiltered =
					alphaTokens.length === 0
						? baseCanonicalModels
						: baseCanonicalModels.filter(item =>
								alphaTokens.every(token => item.normalizedSearchText.includes(token)),
							);
				const compactQuery = compactSearchText(query);
				const substringFiltered =
					compactQuery.length === 0
						? alphaFiltered
						: alphaFiltered.filter(item => item.compactSearchText.includes(compactQuery));
				const fuzzySource =
					substringFiltered.length > 0
						? substringFiltered
						: alphaFiltered.length > 0
							? alphaFiltered
							: baseCanonicalModels;
				const fuzzyMatches = fuzzyFilter(fuzzySource, query, ({ searchText }) => searchText);
				this.#sortCanonicalModels(fuzzyMatches);
				this.#filteredCanonicalModels = fuzzyMatches;
			} else {
				const fuzzyMatches = fuzzyFilter(baseModels, query, ({ id, provider }) => `${id} ${provider}`);
				this.#sortModels(fuzzyMatches);
				this.#filteredModels = fuzzyMatches;
			}
		} else {
			this.#filteredModels = baseModels;
			this.#filteredCanonicalModels = baseCanonicalModels;
		}

		const visibleCount = isCanonicalTab ? this.#filteredCanonicalModels.length : this.#filteredModels.length;
		this.#selectedIndex = Math.min(this.#selectedIndex, Math.max(0, visibleCount - 1));
		this.#profileSelectedIndex = Math.min(
			this.#profileSelectedIndex,
			Math.max(0, this.#getVisibleProfiles().length - 1),
		);
		this.#updateList();
	}

	#applyTabFilter(): void {
		const query = this.#searchInput.getValue();
		this.#filterModels(query);
	}

	#formatDiscoveryAge(fetchedAt: number | undefined): string | undefined {
		if (!fetchedAt) {
			return undefined;
		}
		const ageMs = Math.max(0, Date.now() - fetchedAt);
		if (ageMs < 60_000) {
			return "less than a minute ago";
		}
		const ageMinutes = Math.round(ageMs / 60_000);
		return `${ageMinutes}m ago`;
	}

	#formatDiscoveryErrorHint(error: string | undefined): string | undefined {
		if (!error) {
			return undefined;
		}
		const httpMatch = error.match(/^HTTP (\d+) from (.+)$/);
		if (!httpMatch) {
			return undefined;
		}
		const [, statusCode, url] = httpMatch;
		if (statusCode === "404") {
			return `  Discovery endpoint ${url} returned 404. Point baseUrl at the host that serves /models (usually .../v1).`;
		}
		return `  Discovery failed: ${error}`;
	}

	#getProviderEmptyStateMessage(): string | undefined {
		const activeProviderIds = this.#getActiveProviderIds();
		if (!activeProviderIds || activeProviderIds.length === 0 || this.#searchInput.getValue().trim()) {
			return undefined;
		}
		// Grouped tabs (LOCAL) surface the first member that reports a state.
		const state = activeProviderIds
			.map(providerId => this.#modelRegistry.getProviderDiscoveryState(providerId))
			.find(providerState => providerState !== undefined);
		if (!state) {
			return undefined;
		}
		const age = this.#formatDiscoveryAge(state.fetchedAt);
		switch (state.status) {
			case "cached":
				return age
					? `  Using cached model list from ${age}. Live refresh is still pending.`
					: "  Using cached model list. Live refresh is still pending.";
			case "unavailable":
				return (
					this.#formatDiscoveryErrorHint(state.error) ??
					(age ? `  Provider unavailable. Using cached model list from ${age}.` : "  Provider unavailable.")
				);
			case "unauthenticated":
				return "  Provider requires authentication before discovery. Use /provider login or /login for OAuth/subscription providers, or /provider add for API-compatible providers.";
			case "idle":
				return "  Provider has not been refreshed yet.";
			case "empty":
				return "  Discovery succeeded but returned 0 models. Check that /models returns { data: [{ id }] }.";
			case "ok":
				return undefined;
		}
	}

	#getVisibleProfiles(): ProfileItem[] {
		return !this.#temporaryOnly && !this.#isCanonicalTab() && this.#getActiveTabId() === ALL_TAB
			? this.#profileItems
			: [];
	}

	#buildProfileGroups(): ProfileGroup[] {
		const groups: ProfileGroup[] = [];
		const groupedProfiles = new Set<ProfileItem>();
		for (const definition of PROFILE_GROUP_DEFINITIONS) {
			for (const profile of this.#profileItems) {
				if (definition.matches(profile)) groupedProfiles.add(profile);
			}
		}
		const customProfiles = this.#profileItems.filter(profile => !groupedProfiles.has(profile));
		if (customProfiles.length > 0) {
			groups.push({
				id: CUSTOM_PROFILE_GROUP_DEFINITION.id,
				label: CUSTOM_PROFILE_GROUP_DEFINITION.label,
				description: CUSTOM_PROFILE_GROUP_DEFINITION.description,
				profiles: customProfiles,
			});
		}
		for (const definition of PROFILE_GROUP_DEFINITIONS) {
			const profiles = this.#profileItems.filter(profile => definition.matches(profile));
			if (profiles.length === 0) continue;
			groups.push({
				id: definition.id,
				label: definition.label,
				description: definition.description,
				profiles,
			});
		}
		return groups;
	}

	#getProfileSurfaceLabel(): string {
		const profiles = this.#getVisibleProfiles();
		const groupCount = this.#buildProfileGroups().length;
		return `Browse presets ${theme.fg("dim", `(${profiles.length} profiles in ${groupCount} groups)`)}`;
	}

	#buildModelRowLine(item: ModelItem | CanonicalModelItem, isSelected: boolean): string {
		const isCanonicalTab = this.#isCanonicalTab();
		const showProvider = this.#getActiveTabId() === ALL_TAB;
		const canonicalItem = isCanonicalTab ? (item as CanonicalModelItem) : undefined;
		const providerItem = isCanonicalTab ? undefined : (item as ModelItem);

		// Build role badges (inverted: color as background, black text)
		const roleBadgeTokens: string[] = [];
		for (const role of JWC_MODEL_ASSIGNMENT_TARGET_IDS) {
			const roleInfo = JWC_MODEL_ASSIGNMENT_TARGETS[role];
			const assigned = this.#roles[role];
			if (roleInfo.tag && assigned && modelsAreEqual(assigned.model, item.model)) {
				const badge = makeInvertedBadge(roleInfo.tag, roleInfo.color ?? "muted");
				const thinkingLabel = getThinkingLevelMetadata(assigned.thinkingLevel).label;
				roleBadgeTokens.push(`${badge} ${theme.fg("dim", `(${thinkingLabel})`)}`);
			}
		}
		const badgeText = roleBadgeTokens.length > 0 ? ` ${roleBadgeTokens.join(" ")}` : "";

		let line = "";
		if (isSelected) {
			const prefix = theme.fg("accent", `${theme.nav.cursor} `);
			if (isCanonicalTab) {
				const variants = theme.fg("dim", ` [${canonicalItem?.variantCount ?? 0}]`);
				const backing = theme.fg("dim", ` -> ${item.model.provider}/${item.model.id}`);
				line = `${prefix}${theme.fg("accent", item.id)}${variants}${backing}${badgeText}`;
			} else if (showProvider) {
				const providerPrefix = theme.fg("dim", `${providerItem?.provider ?? ""}/`);
				line = `${prefix}${providerPrefix}${theme.fg("accent", providerItem?.id ?? item.id)}${badgeText}`;
			} else {
				line = `${prefix}${theme.fg("accent", item.id)}${badgeText}`;
			}
		} else {
			const prefix = "  ";
			if (isCanonicalTab) {
				const variants = theme.fg("dim", ` [${canonicalItem?.variantCount ?? 0}]`);
				const backing = theme.fg("dim", ` -> ${item.model.provider}/${item.model.id}`);
				line = `${prefix}${item.id}${variants}${backing}${badgeText}`;
			} else if (showProvider) {
				const providerPrefix = theme.fg("dim", `${providerItem?.provider ?? ""}/`);
				line = `${prefix}${providerPrefix}${providerItem?.id ?? item.id}${badgeText}`;
			} else {
				line = `${prefix}${item.id}${badgeText}`;
			}
		}

		if (item.model.unlisted === true) {
			line += theme.fg("dim", " (unlisted)");
		}
		return line;
	}

	#modelWindow(visibleItems: ReadonlyArray<ModelItem | CanonicalModelItem>): { startIndex: number; endIndex: number } {
		const maxVisible = 10;
		const startIndex = Math.max(
			0,
			Math.min(this.#selectedIndex - Math.floor(maxVisible / 2), visibleItems.length - maxVisible),
		);
		return { startIndex, endIndex: Math.min(startIndex + maxVisible, visibleItems.length) };
	}

	#isTwoPane(): boolean {
		return this.#getVisibleProfiles().length > 0;
	}

	/** ALL tab body: preset controls above the normal filtered model list. */
	#renderAllTabRows(): void {
		const currentProfileName = this.#currentProfileName ?? this.#settings.get("modelProfile.default") ?? "none";
		this.#listContainer.addChild(new Text(theme.fg("muted", `Current preset: ${currentProfileName}`), 0, 0));

		const detailsPrefix =
			this.#activePaneId === "profiles" && this.#selectedPresetHeaderIndex === 0
				? theme.fg("accent", `${theme.nav.cursor} `)
				: "  ";
		const detailsLabel =
			this.#activePaneId === "profiles" && this.#selectedPresetHeaderIndex === 0
				? theme.fg("accent", "View preset configuration")
				: "View preset configuration";
		this.#listContainer.addChild(new Text(`${detailsPrefix}${detailsLabel}`, 0, 0));

		const browsePrefix =
			this.#activePaneId === "profiles" && this.#selectedPresetHeaderIndex === 1
				? theme.fg("accent", `${theme.nav.cursor} `)
				: "  ";
		const browseLabel =
			this.#activePaneId === "profiles" && this.#selectedPresetHeaderIndex === 1
				? theme.fg("accent", "Browse presets")
				: "Browse presets";
		this.#listContainer.addChild(
			new Text(
				`${browsePrefix}${browseLabel} ${this.#getProfileSurfaceLabel().replace(/^Browse presets /, "")}`,
				0,
				0,
			),
		);
		this.#listContainer.addChild(new Spacer(1));
	}

	#updateList(): void {
		this.#listContainer.clear();
		if (this.#pendingActionItem?.kind === "profile-action") {
			this.#listContainer.addChild(new Text(theme.fg("muted", "Presets"), 0, 0));
			this.#listContainer.addChild(new Text(`  ${this.#pendingActionItem.profile.name}`, 0, 0));
			this.#renderProfileActionMenu(this.#pendingActionItem.profile);
			return;
		}

		if (this.#profileMenuState) {
			this.#renderProfileMenu(this.#profileMenuState);
			return;
		}

		const isCanonicalTab = this.#isCanonicalTab();
		const visibleProfiles = this.#getVisibleProfiles();
		const modelSelectedIndex = this.#selectedIndex;
		const visibleItems = isCanonicalTab ? this.#filteredCanonicalModels : this.#filteredModels;
		const twoPane = this.#isTwoPane();

		if (twoPane) {
			this.#renderAllTabRows();
		}
		const { startIndex, endIndex } = this.#modelWindow(visibleItems);
		for (let i = startIndex; i < endIndex; i++) {
			const item = visibleItems[i];
			if (!item) continue;
			const selected = (!twoPane || this.#activePaneId === "models") && i === this.#selectedIndex;
			this.#listContainer.addChild(new Text(this.#buildModelRowLine(item, selected), 0, 0));
		}
		if (startIndex > 0 || endIndex < visibleItems.length) {
			const scrollInfo = theme.fg("muted", `  (${this.#selectedIndex + 1}/${visibleItems.length})`);
			this.#listContainer.addChild(new Text(scrollInfo, 0, 0));
		}

		// ctrl+o discoverability hint (only when the toggle has something to do)
		if (this.#hiddenUnlistedCount > 0) {
			this.#listContainer.addChild(
				new Text(theme.fg("dim", `  ctrl+o show ${this.#hiddenUnlistedCount} unsupported`), 0, 0),
			);
		} else if (this.#showUnlisted) {
			this.#listContainer.addChild(new Text(theme.fg("dim", "  ctrl+o hide unsupported"), 0, 0));
		}

		// Show error message or "no results" if empty
		if (this.#errorMessage) {
			const errorLines = String(this.#errorMessage).split("\n");
			for (const line of errorLines) {
				this.#listContainer.addChild(new Text(theme.fg("error", line), 0, 0));
			}
		} else if (visibleItems.length === 0 && visibleProfiles.length === 0) {
			const statusMessage = this.#getProviderEmptyStateMessage();
			this.#listContainer.addChild(
				new Text(
					theme.fg("muted", statusMessage ?? `  No matching models. ${formatModelOnboardingInlineHint()}`),
					0,
					0,
				),
			);
		} else if (twoPane && this.#activePaneId === "profiles") {
			this.#listContainer.addChild(new Spacer(1));
			this.#listContainer.addChild(new Text(theme.fg("muted", "  Enter to open grouped presets"), 0, 0));
		} else {
			const selected = visibleItems[modelSelectedIndex];
			if (!selected) {
				return;
			}
			this.#listContainer.addChild(new Spacer(1));
			const suffix = isCanonicalTab
				? ` (${selected.model.provider}/${selected.model.id}, ${(selected as CanonicalModelItem).variantCount} variants)`
				: "";
			this.#listContainer.addChild(
				new Text(theme.fg("muted", `  Model Name: ${selected.model.name}${suffix}`), 0, 0),
			);
			if (this.#pendingThinkingChoice) {
				this.#renderThinkingMenu(this.#pendingThinkingChoice);
			} else if (this.#pendingActionItem) {
				this.#renderActionMenu(this.#pendingActionItem);
			}
		}
	}

	#renderActionMenu(item: ModelItem | CanonicalModelItem): void {
		this.#listContainer.addChild(new Spacer(1));
		this.#listContainer.addChild(new Text(theme.fg("muted", `  Action for: ${item.model.id}`), 0, 0));
		this.#listContainer.addChild(new Spacer(1));
		const actionCount = this.#getActionCount(item.model);
		for (let i = 0; i < actionCount; i++) {
			const prefix = i === this.#selectedActionIndex ? theme.fg("accent", `${theme.nav.cursor} `) : "  ";
			const role = JWC_MODEL_ASSIGNMENT_TARGET_IDS[i];
			const applyAllIndex = JWC_MODEL_ASSIGNMENT_TARGET_IDS.length;
			const label = role
				? `Set as ${JWC_MODEL_ASSIGNMENT_TARGETS[role].tag ?? role.toUpperCase()} (${JWC_MODEL_ASSIGNMENT_TARGETS[role].name})`
				: i === applyAllIndex
					? `${APPLY_ALL_ROLES_PRESET.label} (${APPLY_ALL_ROLES_PRESET.description})`
					: `${OPENAI_CODE_PROFILE_PRESET.label} (${OPENAI_CODE_PROFILE_PRESET.description})`;
			this.#listContainer.addChild(
				new Text(`${prefix}${i === this.#selectedActionIndex ? theme.fg("accent", label) : label}`, 0, 0),
			);
		}
	}

	#renderThinkingMenu(choice: PendingThinkingChoice): void {
		const targetLabel =
			choice.role === null
				? "temporary model"
				: choice.role === "all"
					? "all roles"
					: JWC_MODEL_ASSIGNMENT_TARGETS[choice.role].name;
		this.#listContainer.addChild(new Spacer(1));
		this.#listContainer.addChild(
			new Text(theme.fg("muted", `  Reasoning for ${targetLabel}: ${choice.item.model.id}`), 0, 0),
		);
		this.#listContainer.addChild(new Spacer(1));
		for (let i = 0; i < choice.levels.length; i++) {
			const level = choice.levels[i];
			const metadata = getThinkingLevelMetadata(level);
			const prefix = i === this.#selectedThinkingIndex ? theme.fg("accent", `${theme.nav.cursor} `) : "  ";
			const label = `${metadata.label} — ${metadata.description}`;
			this.#listContainer.addChild(
				new Text(`${prefix}${i === this.#selectedThinkingIndex ? theme.fg("accent", label) : label}`, 0, 0),
			);
		}
	}

	#renderProfileActionMenu(profile: ProfileItem): void {
		this.#listContainer.addChild(new Spacer(1));
		this.#listContainer.addChild(new Text(theme.fg("muted", `  Action for profile: ${profile.name}`), 0, 0));
		this.#listContainer.addChild(new Spacer(1));
		const labels = ["Apply for this session", "Set as default"];
		for (let i = 0; i < labels.length; i++) {
			const label = labels[i] ?? "";
			const prefix = i === this.#selectedActionIndex ? theme.fg("accent", `${theme.nav.cursor} `) : "  ";
			this.#listContainer.addChild(
				new Text(`${prefix}${i === this.#selectedActionIndex ? theme.fg("accent", label) : label}`, 0, 0),
			);
		}
	}

	#renderProfileMenu(state: ProfileMenuState): void {
		this.#listContainer.addChild(new Text(theme.fg("muted", "Presets"), 0, 0));
		if (state.kind === "groups") {
			const groups = this.#buildProfileGroups();
			for (let i = 0; i < groups.length; i++) {
				const group = groups[i];
				if (!group) continue;
				const prefix = i === this.#selectedProfileGroupIndex ? theme.fg("accent", `${theme.nav.cursor} `) : "  ";
				const label = i === this.#selectedProfileGroupIndex ? theme.fg("accent", group.label) : group.label;
				const details = theme.fg("dim", ` (${group.profiles.length}) — ${group.description}`);
				this.#listContainer.addChild(new Text(`${prefix}${label}${details}`, 0, 0));
			}
			this.#listContainer.addChild(new Spacer(1));
			this.#listContainer.addChild(
				new Text(theme.fg("muted", "  Enter to open a group; Esc to return to models"), 0, 0),
			);
			return;
		}
		if (state.kind === "details") {
			this.#listContainer.addChild(
				new Text(theme.fg("dim", `  ${state.profile.name} — preset configuration`), 0, 0),
			);
			this.#listContainer.addChild(new Spacer(1));
			const entries = this.#getProfileMappingEntries(state.profile);
			if (entries.length === 0) {
				this.#listContainer.addChild(new Text(theme.fg("muted", "  No model mappings configured"), 0, 0));
			} else {
				for (const [role, selector] of entries) {
					this.#listContainer.addChild(new Text(`  ${role}: ${selector}`, 0, 0));
				}
			}
			this.#listContainer.addChild(new Spacer(1));
			this.#listContainer.addChild(new Text(theme.fg("muted", "  Esc to return"), 0, 0));
			return;
		}

		this.#listContainer.addChild(
			new Text(theme.fg("dim", `  ${state.group.label} — ${state.group.description}`), 0, 0),
		);
		this.#listContainer.addChild(new Spacer(1));
		for (let i = 0; i < state.group.profiles.length; i++) {
			const profile = state.group.profiles[i];
			if (!profile) continue;
			const prefix = i === this.#selectedProfileMenuIndex ? theme.fg("accent", `${theme.nav.cursor} `) : "  ";
			const label = i === this.#selectedProfileMenuIndex ? theme.fg("accent", profile.name) : profile.name;
			this.#listContainer.addChild(new Text(`${prefix}${label}`, 0, 0));
		}
		this.#listContainer.addChild(new Spacer(1));
		this.#listContainer.addChild(
			new Text(theme.fg("muted", "  Enter for actions; Esc to return to preset groups"), 0, 0),
		);
	}

	#getCurrentProfileItem(): ProfileItem | undefined {
		const name = this.#currentProfileName ?? this.#settings.get("modelProfile.default");
		if (!name) return undefined;
		return this.#profileItems.find(profile => profile.name === name);
	}

	#formatRoleAssignment(assignment: RoleAssignment): string {
		const selector = `${assignment.model.provider}/${assignment.model.id}`;
		if (assignment.thinkingLevel === ThinkingLevel.Inherit) {
			return selector;
		}
		return formatModelSelectorValue(selector, assignment.thinkingLevel);
	}

	#getProfileMappingEntries(profile: ProfileItem): [JwcModelSelectorTargetId, string][] {
		const entries = new Map<JwcModelSelectorTargetId, string>();
		for (const [rawRole, selector] of Object.entries(profile.profile.modelMapping) as [
			JwcModelSelectorTargetId,
			string,
		][]) {
			const role = rawRole === "executor" ? "executor_ext" : rawRole;
			if (rawRole === "executor" && entries.has("executor_ext")) continue;
			entries.set(role, selector);
		}
		const currentProfileName = this.#currentProfileName ?? this.#settings.get("modelProfile.default");
		if (profile.name !== currentProfileName) {
			return [...entries.entries()];
		}

		for (const role of JWC_MODEL_ASSIGNMENT_TARGET_IDS) {
			const assignment = this.#roles[role];
			if (assignment) {
				entries.set(role, this.#formatRoleAssignment(assignment));
			}
		}
		return [...entries.entries()];
	}

	#handlePresetHeaderSubmit(): void {
		if (this.#selectedPresetHeaderIndex === 0) {
			const profile = this.#getCurrentProfileItem();
			if (profile) {
				this.#profileMenuState = { kind: "details", profile };
				this.#updateList();
			}
			return;
		}
		this.#openProfileMenu();
	}

	#openProfileMenu(): void {
		const groups = this.#buildProfileGroups();
		if (groups.length === 0) return;
		this.#profileMenuState = { kind: "groups" };
		this.#selectedProfileGroupIndex = Math.min(this.#selectedProfileGroupIndex, groups.length - 1);
		this.#selectedProfileMenuIndex = 0;
		this.#updateList();
	}

	#handleProfileMenuInput(keyData: string): void {
		const state = this.#profileMenuState;
		if (!state) return;
		if (state.kind === "details") {
			if (getKeybindings().matches(keyData, "tui.select.cancel")) {
				this.#profileMenuState = undefined;
				this.#updateList();
			}
			return;
		}
		if (state.kind === "groups") {
			const groups = this.#buildProfileGroups();
			if (groups.length === 0) {
				this.#profileMenuState = undefined;
				this.#updateList();
				return;
			}
			if (matchesKey(keyData, "up")) {
				this.#selectedProfileGroupIndex =
					this.#selectedProfileGroupIndex === 0 ? groups.length - 1 : this.#selectedProfileGroupIndex - 1;
				this.#updateList();
				return;
			}
			if (matchesKey(keyData, "down")) {
				this.#selectedProfileGroupIndex = (this.#selectedProfileGroupIndex + 1) % groups.length;
				this.#updateList();
				return;
			}
			if (matchesKey(keyData, "enter") || matchesKey(keyData, "return") || keyData === "\n") {
				const group = groups[this.#selectedProfileGroupIndex];
				if (!group) return;
				this.#profileMenuState = { kind: "profiles", group };
				this.#selectedProfileMenuIndex = 0;
				this.#updateList();
				return;
			}
			if (getKeybindings().matches(keyData, "tui.select.cancel")) {
				this.#profileMenuState = undefined;
				this.#updateList();
			}
			return;
		}

		const profiles = state.group.profiles;
		if (profiles.length === 0) {
			this.#profileMenuState = { kind: "groups" };
			this.#selectedProfileMenuIndex = 0;
			this.#updateList();
			return;
		}
		if (matchesKey(keyData, "up")) {
			this.#selectedProfileMenuIndex =
				this.#selectedProfileMenuIndex === 0 ? profiles.length - 1 : this.#selectedProfileMenuIndex - 1;
			this.#updateList();
			return;
		}
		if (matchesKey(keyData, "down")) {
			this.#selectedProfileMenuIndex = (this.#selectedProfileMenuIndex + 1) % profiles.length;
			this.#updateList();
			return;
		}
		if (matchesKey(keyData, "enter") || matchesKey(keyData, "return") || keyData === "\n") {
			const profile = profiles[this.#selectedProfileMenuIndex];
			if (!profile) return;
			this.#profileMenuState = undefined;
			this.#pendingActionItem = { kind: "profile-action", profile };
			this.#selectedActionIndex = 0;
			this.#updateList();
			return;
		}
		if (getKeybindings().matches(keyData, "tui.select.cancel")) {
			this.#profileMenuState = { kind: "groups" };
			this.#selectedProfileMenuIndex = 0;
			this.#updateList();
		}
	}

	#getCurrentRoleThinkingLevel(role: string): ThinkingLevel {
		return this.#roles[role]?.thinkingLevel ?? ThinkingLevel.Inherit;
	}
	#getActionCount(model: Model): number {
		return JWC_MODEL_ASSIGNMENT_TARGET_IDS.length + 1 + (supportsOpenAICodexPreset(model) ? 1 : 0);
	}

	#getSelectedItem(): ModelItem | CanonicalModelItem | undefined {
		return this.#isCanonicalTab()
			? this.#filteredCanonicalModels[this.#selectedIndex]
			: this.#filteredModels[this.#selectedIndex];
	}

	handleInput(keyData: string): void {
		if (this.#pendingThinkingChoice) {
			this.#handleThinkingMenuInput(keyData);
			return;
		}
		if (this.#pendingActionItem) {
			this.#handleActionMenuInput(keyData);
			return;
		}
		if (this.#profileMenuState) {
			this.#handleProfileMenuInput(keyData);
			return;
		}
		// ctrl+o reveals unlisted models — selector-scoped "expand" grammar
		// (composer app.tools.expand / tree-selector filter cycle precedent).
		if (matchesKey(keyData, "ctrl+o")) {
			this.#showUnlisted = !this.#showUnlisted;
			this.#applyTabFilter();
			return;
		}

		// Tab bar navigation
		if (this.#tabBar?.handleInput(keyData)) {
			return;
		}

		// Up/down - navigate the focused list (wrap at both ends)
		if (matchesKey(keyData, "up") || matchesKey(keyData, "down")) {
			const goingUp = matchesKey(keyData, "up");
			if (this.#isTwoPane() && this.#activePaneId === "profiles") {
				if (goingUp) {
					this.#selectedPresetHeaderIndex = this.#selectedPresetHeaderIndex === 0 ? 1 : 0;
				} else if (this.#selectedPresetHeaderIndex === 0) {
					this.#selectedPresetHeaderIndex = 1;
				} else {
					this.#activePaneId = "models";
				}
				this.#updateList();
				return;
			}
			const itemCount = this.#isCanonicalTab() ? this.#filteredCanonicalModels.length : this.#filteredModels.length;
			if (itemCount === 0) return;
			if (this.#isTwoPane() && goingUp && this.#selectedIndex === 0) {
				this.#activePaneId = "profiles";
				this.#selectedPresetHeaderIndex = 1;
			} else {
				this.#selectedIndex = goingUp
					? (this.#selectedIndex - 1 + itemCount) % itemCount
					: (this.#selectedIndex + 1) % itemCount;
			}
			this.#updateList();
			return;
		}

		// Enter opens the grouped preset picker or persistent assignment menu.
		// Temporary-only mode keeps the existing non-persistent quick-switch behavior.
		if (matchesKey(keyData, "enter") || matchesKey(keyData, "return") || keyData === "\n") {
			if (this.#isTwoPane() && this.#activePaneId === "profiles") {
				this.#handlePresetHeaderSubmit();
				return;
			}
			const selectedItem = this.#getSelectedItem();
			if (selectedItem) {
				this.#beginActionMenuOrSelect(selectedItem);
			}
			return;
		}

		// Escape or Ctrl+C - close selector
		if (getKeybindings().matches(keyData, "tui.select.cancel")) {
			this.#onCancelCallback();
			return;
		}

		// Pass everything else to search input
		this.#searchInput.handleInput(keyData);
		this.#filterModels(this.#searchInput.getValue());
	}

	#beginActionMenuOrSelect(item: ModelItem | CanonicalModelItem): void {
		if (this.#temporaryOnly) {
			this.#handleSelect(item, null);
			return;
		}
		this.#pendingActionItem = item;
		this.#selectedActionIndex = 0;
		this.#updateList();
	}

	#handleActionMenuInput(keyData: string): void {
		const item = this.#pendingActionItem;
		if (!item) return;
		const actionCount = item.kind === "profile-action" ? 2 : this.#getActionCount(item.model);
		if (matchesKey(keyData, "up")) {
			this.#selectedActionIndex = this.#selectedActionIndex === 0 ? actionCount - 1 : this.#selectedActionIndex - 1;
			this.#updateList();
			return;
		}
		if (matchesKey(keyData, "down")) {
			this.#selectedActionIndex = (this.#selectedActionIndex + 1) % actionCount;
			this.#updateList();
			return;
		}
		if (matchesKey(keyData, "enter") || matchesKey(keyData, "return") || keyData === "\n") {
			this.#pendingActionItem = undefined;
			if (item.kind === "profile-action") {
				this.#onSelectCallback({
					kind: "profile",
					profileName: item.profile.name,
					setDefault: this.#selectedActionIndex === 1,
				});
				this.#currentProfileName = item.profile.name;
				this.#profileMenuState = { kind: "details", profile: item.profile };
				this.#updateList();
			} else {
				const role = JWC_MODEL_ASSIGNMENT_TARGET_IDS[this.#selectedActionIndex];
				const applyAllIndex = JWC_MODEL_ASSIGNMENT_TARGET_IDS.length;
				if (role) {
					this.#handleSelect(item, role);
				} else if (this.#selectedActionIndex === applyAllIndex) {
					this.#handleApplyAllSelect(item);
				} else {
					this.#handlePresetSelect(item, OPENAI_CODE_PROFILE_PRESET);
				}
			}
			return;
		}
		if (getKeybindings().matches(keyData, "tui.select.cancel")) {
			this.#pendingActionItem = undefined;
			this.#updateList();
		}
	}

	#handleThinkingMenuInput(keyData: string): void {
		const choice = this.#pendingThinkingChoice;
		if (!choice) return;
		if (matchesKey(keyData, "up")) {
			this.#selectedThinkingIndex =
				this.#selectedThinkingIndex === 0 ? choice.levels.length - 1 : this.#selectedThinkingIndex - 1;
			this.#updateList();
			return;
		}
		if (matchesKey(keyData, "down")) {
			this.#selectedThinkingIndex = (this.#selectedThinkingIndex + 1) % choice.levels.length;
			this.#updateList();
			return;
		}
		if (matchesKey(keyData, "enter") || matchesKey(keyData, "return") || keyData === "\n") {
			const level = choice.levels[this.#selectedThinkingIndex];
			if (!level) return;
			this.#pendingThinkingChoice = undefined;
			if (choice.role === "all") {
				this.#handleApplyAllSelect(choice.item, level);
			} else {
				this.#handleSelect(choice.item, choice.role, level);
			}
			return;
		}
		if (getKeybindings().matches(keyData, "tui.select.cancel")) {
			this.#pendingThinkingChoice = undefined;
			if (choice.role === "all") {
				this.#pendingActionItem = choice.item;
				this.#selectedActionIndex = JWC_MODEL_ASSIGNMENT_TARGET_IDS.length;
			} else if (choice.role !== null) {
				this.#pendingActionItem = choice.item;
				this.#selectedActionIndex = Math.max(0, JWC_MODEL_ASSIGNMENT_TARGET_IDS.indexOf(choice.role));
			}
			this.#updateList();
		}
	}
	#handlePresetSelect(item: ModelItem | CanonicalModelItem, preset: ModelAssignmentPreset): void {
		const selectorValue = item.selector;
		const assignments = resolvePresetAssignments(item.model, preset);
		for (const [role, thinkingLevel] of Object.entries(assignments) as [JwcModelSelectorTargetId, ThinkingLevel][]) {
			this.#roles[role] = { model: item.model, thinkingLevel };
		}
		this.#onSelectCallback({ kind: "preset", model: item.model, selector: selectorValue, preset, assignments });
		this.#updateList();
	}

	#handleApplyAllSelect(item: ModelItem | CanonicalModelItem, thinkingLevel?: ThinkingLevel): void {
		const itemThinkingLevel = thinkingLevel ?? item.thinkingLevel;
		const hasExplicitThinkingChoice = thinkingLevel !== undefined || item.explicitThinkingLevel === true;
		if (!hasExplicitThinkingChoice && requiresExplicitThinkingChoice(item.model)) {
			this.#pendingThinkingChoice = { item, role: "all", levels: getSelectableThinkingLevels(item.model) };
			this.#selectedThinkingIndex = 0;
			this.#updateList();
			return;
		}

		const selectedThinkingLevel = itemThinkingLevel ?? ThinkingLevel.Inherit;
		const assignments = {} as Record<JwcModelSelectorTargetId, ThinkingLevel>;
		for (const role of JWC_MODEL_ASSIGNMENT_TARGET_IDS) {
			assignments[role] = selectedThinkingLevel;
			this.#roles[role] = { model: item.model, thinkingLevel: selectedThinkingLevel };
		}
		this.#onSelectCallback({
			kind: "preset",
			model: item.model,
			selector: item.selector,
			preset: APPLY_ALL_ROLES_PRESET,
			assignments,
		});
		this.#updateList();
	}

	#handleSelect(
		item: ModelItem | CanonicalModelItem,
		role: JwcModelSelectorTargetId | null,
		thinkingLevel?: ThinkingLevel,
	): void {
		const itemThinkingLevel = thinkingLevel ?? item.thinkingLevel;
		const hasExplicitThinkingChoice = thinkingLevel !== undefined || item.explicitThinkingLevel === true;
		if (!hasExplicitThinkingChoice && requiresExplicitThinkingChoice(item.model)) {
			this.#pendingThinkingChoice = { item, role, levels: getSelectableThinkingLevels(item.model) };
			this.#selectedThinkingIndex = 0;
			this.#updateList();
			return;
		}

		// For temporary role, don't save to settings - just notify caller
		if (role === null) {
			this.#onSelectCallback({
				kind: "assignment",
				model: item.model,
				role: null,
				thinkingLevel: itemThinkingLevel,
				selector: item.selector,
			});
			return;
		}

		const selectedThinkingLevel = itemThinkingLevel ?? this.#getCurrentRoleThinkingLevel(role);
		const selectorValue =
			role === "default" ? item.selector : formatModelSelectorValue(item.selector, selectedThinkingLevel);

		// Update local state for UI
		this.#roles[role] = { model: item.model, thinkingLevel: selectedThinkingLevel };

		// Notify caller (for updating agent state if needed)
		this.#onSelectCallback({
			kind: "assignment",
			model: item.model,
			role,
			thinkingLevel: selectedThinkingLevel,
			selector: selectorValue,
		});

		// Update list to show new badges
		this.#updateList();
	}

	getSearchInput(): Input {
		return this.#searchInput;
	}

	refreshFromSettings(options?: { currentProfileName?: string }): void {
		if (options?.currentProfileName !== undefined) {
			this.#currentProfileName = options.currentProfileName;
		}
		this.#roles = {};
		this.#loadRoleModels();
		this.#sortModels(this.#allModels);
		this.#sortCanonicalModels(this.#canonicalModels);
		this.#applyTabFilter();
	}
	async __testSelectProfile(profileName: string, setDefault: boolean): Promise<void> {
		await this.#onSelectCallback({ kind: "profile", profileName, setDefault });
	}
}

function requiresExplicitThinkingChoice(model: Model): boolean {
	return model.reasoning === true && (model.provider === "openai" || model.provider === "openai-codex");
}

function supportsOpenAICodexPreset(model: Model): boolean {
	return model.provider === "openai-codex" && model.reasoning === true;
}

function resolvePresetAssignments(
	model: Model,
	preset: ModelAssignmentPreset,
): Partial<Record<JwcModelSelectorTargetId, ThinkingLevel>> {
	const resolved = {} as Record<JwcModelSelectorTargetId, ThinkingLevel>;
	for (const [role, requestedLevel] of Object.entries(preset.assignments) as [
		JwcModelSelectorTargetId,
		ThinkingLevel,
	][]) {
		const clampedLevel =
			requestedLevel === ThinkingLevel.Off || requestedLevel === ThinkingLevel.Inherit
				? requestedLevel
				: clampThinkingLevelForModel(model, requestedLevel);
		if (!clampedLevel) {
			throw new Error(`Model ${model.provider}/${model.id} does not support ${requestedLevel} reasoning`);
		}
		resolved[role] = clampedLevel;
	}
	return resolved;
}

function getSelectableThinkingLevels(model: Model): ThinkingLevel[] {
	const levels: ThinkingLevel[] = [ThinkingLevel.Off];
	let efforts: readonly string[];
	try {
		efforts = getSupportedEfforts(model);
	} catch {
		return levels;
	}
	for (const effort of efforts) {
		const level = parseThinkingLevel(effort);
		if (level && !levels.includes(level)) {
			levels.push(level);
		}
	}
	return levels;
}

/** Extract the first version number from a model ID (e.g. "gemini-2.5-pro" → 2.5, "Anthropic model-sonnet-4-6" → 4.6). */
function extractVersionNumber(id: string): number {
	// Dot-separated version: "gemini-2.5-pro" → 2.5
	const dotMatch = id.match(/(?:^|[-_])(\d+\.\d+)/);
	if (dotMatch) return Number.parseFloat(dotMatch[1]);
	// Dash-separated short segments: "Anthropic model-sonnet-4-6" → 4.6, "llama-3-1-8b" → 3.1
	const dashMatch = id.match(/(?:^|[-_])(\d{1,2})-(\d{1,2})(?=-|$)/);
	if (dashMatch) return Number.parseFloat(`${dashMatch[1]}.${dashMatch[2]}`);
	// Single number after separator: "gpt-4o" → 4
	const singleMatch = id.match(/(?:^|[-_])(\d+)/);
	if (singleMatch) return Number.parseFloat(singleMatch[1]);
	return 0;
}
