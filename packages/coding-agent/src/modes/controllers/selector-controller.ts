import { ThinkingLevel } from "@gajae-code/agent-core";
import { getOAuthProviders } from "@gajae-code/ai/utils/oauth";
import type { OAuthProvider } from "@gajae-code/ai/utils/oauth/types";
import type { Component, OverlayHandle, SelectItem } from "@gajae-code/tui";
import { Container, Input, Loader, SelectList, Spacer, Text } from "@gajae-code/tui";
import { APP_NAME, getAgentDbPath, getProjectDir } from "@gajae-code/utils";
import { activateModelProfile } from "../../config/model-profile-activation";
import { resolveOAuthProviderId } from "../../config/oauth-provider-aliases";
import { settings } from "../../config/settings";
import { DebugSelectorComponent } from "../../debug";
import { disableProvider, enableProvider } from "../../discovery";
import { clearPluginRootsAndCaches, resolveActiveProjectRegistryPath } from "../../discovery/helpers";
import {
	getInstalledPluginsRegistryPath,
	getMarketplacesCacheDir,
	getMarketplacesRegistryPath,
	getPluginsCacheDir,
	MarketplaceManager,
} from "../../extensibility/plugins/marketplace";
import { DynamicBorder } from "../../modes/components/dynamic-border";
import { type HelpCatalogEntry, HelpSelectorComponent } from "../../modes/components/help-selector";
import { QuotaPanelComponent } from "../../modes/components/quota-panel";
import {
	getAvailableThemes,
	getCurrentThemeName,
	getDetectedThemeSettingsPath,
	getSelectListTheme,
	getSymbolTheme,
	previewTheme,
	restoreThemePreview,
	setColorBlindMode,
	setSymbolPreset,
	setTheme,
	theme,
} from "../../modes/theme/theme";
import type { InteractiveModeContext } from "../../modes/types";
import { resolveResumableSession, type SessionInfo, SessionManager } from "../../session/session-manager";
import { FileSessionStorage } from "../../session/session-storage";
import {
	MODEL_ONBOARDING_API_PROVIDER_COMMAND,
	MODEL_ONBOARDING_PROVIDER_PRESET_COMMAND,
	MODEL_ONBOARDING_SETUP_COMMAND,
} from "../../setup/model-onboarding-guidance";
import { addApiCompatibleProvider, formatProviderSetupResult } from "../../setup/provider-onboarding";
import { BUILTIN_SLASH_COMMANDS_INTERNAL } from "../../slash-commands/builtin-registry";
import { isSearchProviderPreference, setPreferredImageProvider, setPreferredSearchProvider } from "../../tools";
import { setSessionTerminalTitle } from "../../utils/title-generator";
import type { SearchProviderId } from "../../web/search/types";
import { AgentDashboard } from "../components/agent-dashboard";
import { AssistantMessageComponent } from "../components/assistant-message";
import { CustomProviderWizardComponent, type CustomProviderWizardSubmit } from "../components/custom-provider-wizard";
import { ExtensionDashboard } from "../components/extensions";
import { HistorySearchComponent } from "../components/history-search";
import { JobsOverlayComponent } from "../components/jobs-overlay";
import { ModelSelectorComponent, type ModelSelectorSelection } from "../components/model-selector";
import { OAuthSelectorComponent } from "../components/oauth-selector";
import { PluginSelectorComponent } from "../components/plugin-selector";
import {
	type ProviderOnboardingAction,
	ProviderOnboardingSelectorComponent,
} from "../components/provider-onboarding-selector";
import { SessionObserverOverlayComponent } from "../components/session-observer-overlay";
import { SessionSelectorComponent } from "../components/session-selector";
import { SettingsSelectorComponent } from "../components/settings-selector";
import { ThemeSelectorComponent } from "../components/theme-selector";
import { ToolExecutionComponent } from "../components/tool-execution";
import { TreeSelectorComponent } from "../components/tree-selector";
import { UserMessageSelectorComponent } from "../components/user-message-selector";
import type { JobsObserver } from "../jobs-observer";
import type { SessionObserverRegistry } from "../session-observer-registry";

const CALLBACK_SERVER_PROVIDERS = new Set<string>([
	"anthropic",
	"openai-codex",
	"gitlab-duo",
	"google-gemini-cli",
	"google-antigravity",
	"xai",
]);

const MANUAL_LOGIN_TIP = "Tip: You can complete pairing with /login <redirect URL>.";

function isThemePreviewSuperseded(result: { success: boolean; error?: string }): boolean {
	return !result.success && result.error?.includes("superseded by a newer request") === true;
}

function formatProviderOnboardingCommandGuide(): string {
	return [
		"Provider preset setup:",
		MODEL_ONBOARDING_PROVIDER_PRESET_COMMAND,
		"Custom API-compatible provider setup:",
		MODEL_ONBOARDING_API_PROVIDER_COMMAND,
		MODEL_ONBOARDING_SETUP_COMMAND,
	].join("\n");
}

export class SelectorController {
	constructor(private ctx: InteractiveModeContext) {}

	async #refreshOAuthProviderAuthState(): Promise<void> {
		const oauthProviders = getOAuthProviders();
		await Promise.all(
			oauthProviders.map(provider =>
				this.ctx.session.modelRegistry
					.getApiKeyForProvider(provider.id, this.ctx.session.sessionId)
					.catch(() => undefined),
			),
		);
	}
	/**
	 * Shows a selector component in place of the editor.
	 * @param create Factory that receives a `done` callback and returns the component and focus target
	 */
	showSelector(create: (done: () => void) => { component: Component; focus: Component }): void {
		const done = () => {
			this.ctx.editorContainer.clear();
			this.ctx.editorContainer.addChild(this.ctx.editor);
			this.ctx.ui.setFocus(this.ctx.editor);
		};
		const { component, focus } = create(done);
		this.ctx.editorContainer.clear();
		this.ctx.editorContainer.addChild(component);
		this.ctx.ui.setFocus(focus);
		this.ctx.ui.requestRender();
	}

	showProviderOnboarding(): void {
		this.showSelector(done => {
			const selector = new ProviderOnboardingSelectorComponent(
				(action: ProviderOnboardingAction) => {
					done();
					if (action === "custom-provider-wizard") {
						this.showCustomProviderWizard();
					} else if (action === "oauth-login") {
						void this.showOAuthSelector("login");
					} else {
						this.ctx.showStatus(formatProviderOnboardingCommandGuide());
					}
				},
				() => {
					done();
					this.ctx.ui.requestRender();
				},
			);
			return { component: selector, focus: selector };
		});
	}

	showCustomProviderWizard(): void {
		this.showSelector(done => {
			let wizard: CustomProviderWizardComponent;
			const submit = async (input: CustomProviderWizardSubmit): Promise<void> => {
				try {
					const result = await addApiCompatibleProvider(input);
					await this.ctx.session.modelRegistry.refresh("offline");
					await this.ctx.notifyConfigChanged?.();
					this.ctx.showStatus(formatProviderSetupResult(result));
					done();
					this.ctx.ui.requestRender();
				} catch (err) {
					const message = err instanceof Error ? err.message : String(err);
					wizard.setSubmitError(`Provider setup failed: ${message}`);
				}
			};
			wizard = new CustomProviderWizardComponent(
				input => {
					void submit(input);
				},
				() => {
					done();
					this.ctx.ui.requestRender();
				},
				() => this.ctx.ui.requestRender(),
			);
			return { component: wizard, focus: wizard };
		});
	}

	showSettingsSelector(): void {
		getAvailableThemes().then(availableThemes => {
			this.showSelector(done => {
				const selector = new SettingsSelectorComponent(
					{
						availableThinkingLevels: [...this.ctx.session.getAvailableThinkingLevels()],
						thinkingLevel: this.ctx.session.thinkingLevel,
						availableThemes,
						cwd: getProjectDir(),
					},
					{
						onChange: (id, value) => this.handleSettingChange(id, value),
						onThemePreview: themeName => {
							return previewTheme(themeName).then(result => {
								if (!result.success && result.error && !isThemePreviewSuperseded(result)) {
									this.ctx.showError(`Failed to preview theme: ${result.error}`);
								}
								this.#refreshThemeUi();
							});
						},
						onThemePreviewCancel: themeName => {
							return restoreThemePreview(themeName).then(result => {
								if (!result.success && result.error && !isThemePreviewSuperseded(result)) {
									this.ctx.showError(`Failed to restore theme preview: ${result.error}`);
								}
								this.#refreshThemeUi();
							});
						},
						onStatusLinePreview: previewSettings => {
							// Update status line with preview settings
							this.ctx.statusLine.updateSettings({
								preset: settings.get("statusLine.preset"),
								leftSegments: settings.get("statusLine.leftSegments"),
								rightSegments: settings.get("statusLine.rightSegments"),
								separator: settings.get("statusLine.separator"),
								showHookStatus: settings.get("statusLine.showHookStatus"),
								sessionAccent: settings.get("statusLine.sessionAccent"),
								...previewSettings,
							});
							this.ctx.updateEditorTopBorder();
							this.ctx.ui.requestRender();
						},
						getStatusLinePreview: () => {
							// Return the rendered status line for inline preview
							const availableWidth = this.ctx.editor.getTopBorderAvailableWidth(this.ctx.ui.terminal.columns);
							return this.ctx.statusLine.getTopBorder(availableWidth).content;
						},
						onPluginsChanged: () => {
							this.ctx.ui.requestRender();
						},
						onCancel: () => {
							done();
							// Restore status line to saved settings
							this.ctx.statusLine.updateSettings({
								preset: settings.get("statusLine.preset"),
								leftSegments: settings.get("statusLine.leftSegments"),
								rightSegments: settings.get("statusLine.rightSegments"),
								separator: settings.get("statusLine.separator"),
								showHookStatus: settings.get("statusLine.showHookStatus"),
								sessionAccent: settings.get("statusLine.sessionAccent"),
							});
							this.ctx.updateEditorTopBorder();
							this.ctx.ui.requestRender();
						},
					},
				);
				return { component: selector, focus: selector };
			});
		});
	}

	#refreshThemeUi(): void {
		this.ctx.statusLine.invalidate();
		this.ctx.updateEditorTopBorder();
		this.ctx.ui.requestRender();
	}

	/** 083.4: dropdown for /effort — pick a reasoning effort (thinking level). */
	showEffortSelector(): void {
		const levels: SelectItem[] = [
			{ value: "off", label: "off", description: "No reasoning" },
			{ value: "min", label: "minimal", description: "Very brief reasoning (~1k tokens)" },
			{ value: "low", label: "low", description: "Light reasoning (~2k tokens)" },
			{ value: "medium", label: "medium", description: "Moderate reasoning (~8k tokens)" },
			{ value: "high", label: "high", description: "Deep reasoning (~16k tokens)" },
			{ value: "xhigh", label: "xhigh", description: "Maximum reasoning (~32k tokens)" },
			{ value: "max", label: "max", description: "Unrestricted reasoning" },
		];
		this.showSelector(done => {
			const container = new Container();
			container.addChild(new DynamicBorder());
			container.addChild(new Text(theme.fg("accent", " Reasoning effort"), 1, 0));
			const list = new SelectList(levels, 8, getSelectListTheme());
			const current = this.ctx.session.thinkingLevel;
			const currentIndex = levels.findIndex(item => item.value === current);
			if (currentIndex >= 0) list.setSelectedIndex(currentIndex);
			list.onSelect = item => {
				done();
				this.ctx.session.setThinkingLevel(item.value as ThinkingLevel);
				this.ctx.statusLine.invalidate();
				this.ctx.showStatus(`Reasoning effort set to ${this.ctx.session.thinkingLevel ?? "off"}.`);
				this.ctx.ui.requestRender();
			};
			list.onCancel = () => {
				done();
				this.ctx.ui.requestRender();
			};
			container.addChild(list);
			container.addChild(new DynamicBorder());
			return { component: container, focus: list };
		});
	}

	/** 2-pane dropdown for /searchengine — provider list + settings form (space to toggle, 080). */
	showSearchEngineSelector(): void {
		const engines: SelectItem[] = [
			{ value: "auto", label: "auto", description: "Active model's native search, DuckDuckGo fallback" },
			{ value: "codex", label: "chatgpt", description: "ChatGPT/OpenAI native search (codex)" },
			{ value: "anthropic", label: "claude", description: "Anthropic native search" },
			{ value: "gemini", label: "gemini", description: "Google Gemini native search" },
			{ value: "xai", label: "grok", description: "xAI Grok unified web + X search" },
			{ value: "duckduckgo", label: "duckduckgo", description: "Keyless DuckDuckGo (always available)" },
			{ value: "perplexity", label: "perplexity", description: "Perplexity search" },
			{ value: "exa", label: "exa", description: "Exa keyed search API" },
			{ value: "brave", label: "brave", description: "Brave keyed search API" },
			{ value: "tavily", label: "tavily", description: "Tavily keyed search API" },
		];

		// Settings form options
		const ctx = this.ctx; // capture for closure (wrapper is a plain object, not a class method)
		const DEPTHS = ["fast", "deep"] as const;
		const EFFORTS = ["none", "low", "medium", "high"] as const;
		const CONTEXTS = ["low", "medium", "high"] as const;

		this.showSelector(done => {
			let pane: "providers" | "settings" = "providers";
			let settingsRow = 0; // 0=depth, 1=reasoning, 2=contextSize

			// Read current settings
			let depth = (ctx.settings.get("web_search.depth") as string) ?? "fast";
			let effort = (ctx.settings.get("web_search.reasoningEffort") as string) ?? "none";
			let ctxSize = (ctx.settings.get("web_search.contextSize") as string) ?? "high";
			const selectedProvider = () => (ctx.settings.get("providers.webSearch") as string) ?? "auto";
			const isCodexProvider = () => ["codex", "auto"].includes(selectedProvider());
			const maxRow = () => (isCodexProvider() ? 2 : 1); // hide contextSize for non-codex

			// Provider list (pane 0)
			const list = new SelectList(engines, 10, getSelectListTheme());
			const currentIndex = engines.findIndex(item => item.value === ctx.settings.get("providers.webSearch"));
			if (currentIndex >= 0) list.setSelectedIndex(currentIndex);
			list.onSelect = item => {
				done();
				const next = item.value as SearchProviderId | "auto";
				ctx.settings.set("providers.webSearch", next);
				setPreferredSearchProvider(next);
				void ctx.notifyConfigChanged?.();
				ctx.statusLine.invalidate();
				ctx.showStatus(`Search engine set to ${next}. Fallback remains DuckDuckGo.`);
				ctx.ui.requestRender();
			};
			list.onCancel = () => {
				done();
				ctx.ui.requestRender();
			};

			// 2-pane wrapper component
			const wrapper: Component = {
				render(width: number): string[] {
					if (pane === "providers") {
						const header = theme.fg("accent", " Web search engine") + theme.fg("dim", "  ·  space for settings");
						return [
							...new DynamicBorder().render(width),
							header,
							...list.render(width),
							...new DynamicBorder().render(width),
						];
					}
					// Settings pane
					const rows: string[] = [];
					const label = (text: string, active: boolean) =>
						active ? theme.fg("accent", `▸ ${text}`) : `  ${text}`;
					const seg = <T extends string>(options: readonly T[], current: string, active: boolean) =>
						options
							.map(o => {
								const selected = o === current;
								if (selected && active) return theme.fg("accent", `[${o}]`);
								if (selected) return `[${o}]`;
								return theme.fg("dim", ` ${o} `);
							})
							.join(" ");

					rows.push(
						theme.fg("accent", " Search settings") +
							theme.fg("dim", `  ·  provider: ${selectedProvider()}  ·  space for providers`),
					);
					rows.push("");
					rows.push(`${label("Depth", settingsRow === 0)}       ${seg(DEPTHS, depth, settingsRow === 0)}`);
					rows.push(`${label("Reasoning", settingsRow === 1)}   ${seg(EFFORTS, effort, settingsRow === 1)}`);
					if (isCodexProvider()) {
						rows.push(`${label("Context", settingsRow === 2)}     ${seg(CONTEXTS, ctxSize, settingsRow === 2)}`);
					}
					rows.push("");
					rows.push(theme.fg("dim", " ←/→ change · ↑/↓ move · ⏎ apply · esc back · space providers"));
					return [...new DynamicBorder().render(width), ...rows, ...new DynamicBorder().render(width)];
				},

				handleInput(data: string) {
					// Space toggles pane (model-selector pattern)
					if (data === " ") {
						pane = pane === "providers" ? "settings" : "providers";
						wrapper.invalidate?.();
						return;
					}

					if (pane === "providers") {
						list.handleInput(data);
						return;
					}

					// Settings pane key handling (080 §7: ↑/↓ row, ←/→ value, Enter apply)
					if (data === "\x1b[A" || data === "\x1bOA") {
						// up
						settingsRow = Math.max(0, settingsRow - 1);
					} else if (data === "\x1b[B" || data === "\x1bOB") {
						// down
						settingsRow = Math.min(maxRow(), settingsRow + 1);
					} else if (data === "\x1b[D" || data === "\x1bOD") {
						// left
						if (settingsRow === 0)
							depth = DEPTHS[Math.max(0, DEPTHS.indexOf(depth as (typeof DEPTHS)[number]) - 1)] ?? depth;
						else if (settingsRow === 1)
							effort = EFFORTS[Math.max(0, EFFORTS.indexOf(effort as (typeof EFFORTS)[number]) - 1)] ?? effort;
						else if (settingsRow === 2)
							ctxSize =
								CONTEXTS[Math.max(0, CONTEXTS.indexOf(ctxSize as (typeof CONTEXTS)[number]) - 1)] ?? ctxSize;
					} else if (data === "\x1b[C" || data === "\x1bOC") {
						// right
						if (settingsRow === 0)
							depth =
								DEPTHS[Math.min(DEPTHS.length - 1, DEPTHS.indexOf(depth as (typeof DEPTHS)[number]) + 1)] ??
								depth;
						else if (settingsRow === 1)
							effort =
								EFFORTS[
									Math.min(EFFORTS.length - 1, EFFORTS.indexOf(effort as (typeof EFFORTS)[number]) + 1)
								] ?? effort;
						else if (settingsRow === 2)
							ctxSize =
								CONTEXTS[
									Math.min(CONTEXTS.length - 1, CONTEXTS.indexOf(ctxSize as (typeof CONTEXTS)[number]) + 1)
								] ?? ctxSize;
					} else if (data === "\r" || data === "\n") {
						// Enter = apply
						ctx.settings.set("web_search.depth", depth);
						ctx.settings.set("web_search.reasoningEffort", effort);
						ctx.settings.set("web_search.contextSize", ctxSize);
						void ctx.notifyConfigChanged?.();
						done();
						ctx.showStatus(`Search: depth=${depth} reasoning=${effort} context=${ctxSize}`);
						ctx.ui.requestRender();
						return;
					} else if (data === "\x1b" || data === "\x1b\x1b") {
						// Esc = back to providers
						pane = "providers";
					}
					wrapper.invalidate?.();
				},

				invalidate() {
					// no-op — TUI re-renders on requestRender
				},
			};

			return { component: wrapper, focus: wrapper };
		});
	}

	/**
	 * Docked usage/quota report panel — renders on the editor surface like the
	 * settings selector instead of inserting into the chat transcript. `load`
	 * resolves to a width-aware line renderer on success or a status message
	 * string (e.g. "No quota data available") on empty/soft-failure.
	 */
	showUsageReportPanel(title: string, load: () => Promise<((width: number) => string[]) | string>): void {
		this.showSelector(done => {
			const container = new Container();
			container.addChild(new DynamicBorder());
			const panel = new QuotaPanelComponent(title, {
				close: () => {
					done();
					this.ctx.ui.requestRender();
				},
				requestRender: () => this.ctx.ui.requestRender(),
			});
			container.addChild(panel);
			container.addChild(new DynamicBorder());
			void load()
				.then(result => {
					if (typeof result === "string") panel.setMessage(result);
					else panel.setContent(result);
				})
				.catch(error => {
					panel.setMessage(
						`Failed to fetch usage data: ${error instanceof Error ? error.message : String(error)}`,
					);
				});
			return { component: container, focus: panel };
		});
	}

	/**
	 * 99.20.08 (나): docked /help catalog — model-selector grammar (tab bar
	 * Built-in/Skills/Custom + search + list). Enter inserts the command into
	 * the editor; the transcript stays untouched (99.20.07 read-once).
	 */
	showHelpSelector(): void {
		const builtinSpecs = new Map(BUILTIN_SLASH_COMMANDS_INTERNAL.map(spec => [spec.name, spec]));
		const seen = new Set<string>();
		const entries: HelpCatalogEntry[] = [];
		for (const command of this.ctx.allSlashCommands) {
			if (seen.has(command.name)) continue;
			seen.add(command.name);
			const spec = builtinSpecs.get(command.name);
			const skill = this.ctx.skillCommands.get(command.name);
			entries.push({
				name: command.name,
				description: command.description,
				origin: spec ? "builtin" : skill ? "skill" : "custom",
				aliases: spec?.aliases,
				inlineHint: spec?.inlineHint,
				subcommands: spec?.subcommands,
				sourceLabel: skill ? `source: ${skill.source}` : undefined,
			});
		}
		this.showSelector(done => {
			const selector = new HelpSelectorComponent(
				entries,
				commandName => {
					done();
					this.ctx.editor.setText(`/${commandName} `);
					this.ctx.ui.requestRender();
				},
				() => {
					done();
					this.ctx.ui.requestRender();
				},
			);
			return { component: selector, focus: selector };
		});
	}

	/** 094.4: dropdown for /quota — pick an OAuth provider to show usage. */
	showQuotaSelector(): void {
		const oauthProviders = getOAuthProviders().filter(provider =>
			this.ctx.session.modelRegistry.authStorage.hasOAuth(provider.id),
		);
		if (oauthProviders.length === 0) {
			this.ctx.showStatus("No OAuth credentials found. Use /login to authenticate with a provider first.");
			return;
		}
		if (oauthProviders.length === 1) {
			void this.ctx.handleQuotaForProvider(oauthProviders[0].id);
			return;
		}
		const items: SelectItem[] = oauthProviders.map(provider => ({
			value: provider.id,
			label: provider.name,
			description: provider.id,
		}));
		this.showSelector(done => {
			const container = new Container();
			container.addChild(new DynamicBorder());
			container.addChild(new Text(theme.fg("accent", " Provider quota"), 1, 0));
			const list = new SelectList(items, 8, getSelectListTheme());
			list.onSelect = item => {
				done();
				void this.ctx.handleQuotaForProvider(item.value);
			};
			list.onCancel = () => {
				done();
				this.ctx.ui.requestRender();
			};
			container.addChild(list);
			container.addChild(new DynamicBorder());
			return { component: container, focus: list };
		});
	}

	showThemeSelector(): void {
		getAvailableThemes().then(availableThemes => {
			const initialTheme = getCurrentThemeName() ?? "red-claw";
			this.showSelector(done => {
				const selector = new ThemeSelectorComponent(
					initialTheme,
					availableThemes,
					themeName => {
						const settingPath = getDetectedThemeSettingsPath();
						settings.set(settingPath, themeName);
						this.#refreshThemeUi();
						done();
					},
					() => {
						void restoreThemePreview(initialTheme).then(result => {
							if (!result.success && result.error) {
								this.ctx.showError(`Failed to restore theme preview: ${result.error}`);
							}
							this.#refreshThemeUi();
						});
						done();
					},
					themeName => {
						void previewTheme(themeName).then(result => {
							if (!result.success && result.error) {
								this.ctx.showError(`Failed to preview theme: ${result.error}`);
							}
							this.#refreshThemeUi();
						});
					},
				);
				return { component: selector, focus: selector.getSelectList() };
			});
		});
	}

	showHistorySearch(): void {
		const historyStorage = this.ctx.historyStorage;
		if (!historyStorage) return;

		this.showSelector(done => {
			const component = new HistorySearchComponent(
				historyStorage,
				prompt => {
					done();
					this.ctx.editor.setText(prompt);
					this.ctx.ui.requestRender();
				},
				() => {
					done();
					this.ctx.ui.requestRender();
				},
			);
			return { component, focus: component };
		});
	}

	/**
	 * Show the Extension Control Center dashboard.
	 * Replaces /status with a unified view of all providers and extensions.
	 */
	async showExtensionsDashboard(): Promise<void> {
		const dashboard = await ExtensionDashboard.create(getProjectDir(), this.ctx.settings, this.ctx.ui.terminal.rows);
		this.showSelector(done => {
			dashboard.onClose = () => {
				done();
				this.ctx.ui.requestRender();
			};
			dashboard.onRequestRender = () => {
				this.ctx.ui.requestRender();
			};
			return { component: dashboard, focus: dashboard };
		});
	}

	/**
	 * Show the Agent Control Center dashboard.
	 */
	async showAgentsDashboard(): Promise<void> {
		const activeModel = this.ctx.session.model;
		const activeModelPattern = activeModel ? `${activeModel.provider}/${activeModel.id}` : undefined;
		const defaultModelPattern = this.ctx.settings.getModelRole("default");
		const dashboard = await AgentDashboard.create(getProjectDir(), this.ctx.settings, this.ctx.ui.terminal.rows, {
			modelRegistry: this.ctx.session.modelRegistry,
			activeModelPattern,
			defaultModelPattern,
		});
		this.showSelector(done => {
			dashboard.onClose = () => {
				done();
				this.ctx.ui.requestRender();
			};
			dashboard.onRequestRender = () => {
				this.ctx.ui.requestRender();
			};
			return { component: dashboard, focus: dashboard };
		});
	}

	/**
	 * Handle setting changes from the settings selector.
	 * Most settings are saved directly via SettingsManager in the definitions.
	 * This handles side effects and session-specific settings.
	 */
	handleSettingChange(id: string, value: unknown): void {
		// Discovery provider toggles
		if (id.startsWith("discovery.")) {
			const providerId = id.replace("discovery.", "");
			if (value) {
				enableProvider(providerId);
			} else {
				disableProvider(providerId);
			}
			return;
		}

		switch (id) {
			// Session-managed settings (not in SettingsManager)
			case "autoCompact":
				this.ctx.session.setAutoCompactionEnabled(value as boolean);
				this.ctx.statusLine.setAutoCompactEnabled(value as boolean);
				break;
			case "steeringMode":
				this.ctx.session.setSteeringMode(value as "all" | "one-at-a-time");
				break;
			case "followUpMode":
				this.ctx.session.setFollowUpMode(value as "all" | "one-at-a-time");
				break;
			case "interruptMode":
				this.ctx.session.setInterruptMode(value as "immediate" | "wait");
				break;
			case "thinkingLevel":
			case "defaultThinkingLevel":
				this.ctx.session.setThinkingLevel(value as ThinkingLevel, true);
				this.ctx.statusLine.invalidate();
				this.ctx.updateEditorBorderColor();
				break;

			case "clearOnShrink":
				this.ctx.ui.setClearOnShrink(value as boolean);
				break;

			case "autocompleteMaxVisible":
				this.ctx.editor.setAutocompleteMaxVisible(typeof value === "number" ? value : Number(value));
				break;

			// Settings with UI side effects
			case "showImages":
				for (const child of this.ctx.chatContainer.children) {
					if (child instanceof ToolExecutionComponent) {
						child.setShowImages(value as boolean);
					}
				}
				break;
			case "hideThinking":
				this.ctx.hideThinkingBlock = value as boolean;
				this.ctx.session.agent.hideThinkingSummary = value as boolean;
				for (const child of this.ctx.chatContainer.children) {
					if (child instanceof AssistantMessageComponent) {
						child.setHideThinkingBlock(value as boolean);
					}
				}
				this.ctx.chatContainer.clear();
				this.ctx.rebuildChatFromMessages();
				break;
			case "theme": {
				setTheme(value as string, true).then(result => {
					this.ctx.statusLine.invalidate();
					this.ctx.updateEditorTopBorder();
					this.ctx.ui.invalidate();
					if (!result.success) {
						this.ctx.showError(`Failed to load theme "${value}": ${result.error}\nFell back to dark theme.`);
					}
				});
				break;
			}
			case "symbolPreset": {
				setSymbolPreset(value as "unicode" | "nerd" | "ascii").then(() => {
					this.ctx.statusLine.invalidate();
					this.ctx.updateEditorTopBorder();
					this.ctx.ui.invalidate();
				});
				break;
			}
			case "colorBlindMode": {
				setColorBlindMode(value === "true" || value === true).then(() => {
					this.ctx.ui.invalidate();
				});
				break;
			}
			case "temperature": {
				const temp = typeof value === "number" ? value : Number(value);
				this.ctx.session.agent.temperature = temp >= 0 ? temp : undefined;
				break;
			}
			case "topP": {
				const topP = typeof value === "number" ? value : Number(value);
				this.ctx.session.agent.topP = topP >= 0 ? topP : undefined;
				break;
			}
			case "topK": {
				const topK = typeof value === "number" ? value : Number(value);
				this.ctx.session.agent.topK = topK >= 0 ? topK : undefined;
				break;
			}
			case "minP": {
				const minP = typeof value === "number" ? value : Number(value);
				this.ctx.session.agent.minP = minP >= 0 ? minP : undefined;
				break;
			}
			case "presencePenalty": {
				const presencePenalty = typeof value === "number" ? value : Number(value);
				this.ctx.session.agent.presencePenalty = presencePenalty >= 0 ? presencePenalty : undefined;
				break;
			}
			case "repetitionPenalty": {
				const repetitionPenalty = typeof value === "number" ? value : Number(value);
				this.ctx.session.agent.repetitionPenalty = repetitionPenalty >= 0 ? repetitionPenalty : undefined;
				break;
			}
			case "statusLinePreset":
			case "statusLine.preset":
			case "statusLineSeparator":
			case "statusLine.separator":
			case "statusLineShowHooks":
			case "statusLine.showHookStatus":
			case "statusLine.sessionAccent":
			case "statusLineSegments":
			case "statusLineModelThinking":
			case "statusLinePathAbbreviate":
			case "statusLinePathMaxLength":
			case "statusLinePathStripWorkPrefix":
			case "statusLineGitShowBranch":
			case "statusLineGitShowStaged":
			case "statusLineGitShowUnstaged":
			case "statusLineGitShowUntracked":
			case "statusLineTimeFormat":
			case "statusLineTimeShowSeconds": {
				const statusLineSettings = {
					preset: settings.get("statusLine.preset"),
					leftSegments: settings.get("statusLine.leftSegments"),
					rightSegments: settings.get("statusLine.rightSegments"),
					separator: settings.get("statusLine.separator"),
					showHookStatus: settings.get("statusLine.showHookStatus"),
					sessionAccent: settings.get("statusLine.sessionAccent"),
					segmentOptions: settings.get("statusLine.segmentOptions"),
				};
				this.ctx.statusLine.updateSettings(statusLineSettings);
				this.ctx.updateEditorTopBorder();
				this.ctx.ui.requestRender();
				break;
			}

			// Provider settings - update runtime preferences
			case "providers.webSearch":
				if (typeof value === "string" && isSearchProviderPreference(value)) {
					setPreferredSearchProvider(value);
				}
				break;
			case "providers.image":
				if (
					value === "auto" ||
					value === "openai" ||
					value === "gemini" ||
					value === "openrouter" ||
					value === "antigravity"
				) {
					setPreferredImageProvider(value);
				}
				break;

			// MCP update injection - live subscribe/unsubscribe
			case "mcp.notifications":
				this.ctx.mcpManager?.setNotificationsEnabled(value as boolean);
				break;

			// All other settings are handled by the definitions (get/set on SettingsManager)
			// No additional side effects needed
		}
	}

	showModelSelector(options?: { temporaryOnly?: boolean }): void {
		this.showSelector(done => {
			let modelSelector: ModelSelectorComponent;
			modelSelector = new ModelSelectorComponent(
				this.ctx.ui,
				this.ctx.session.model,
				this.ctx.settings,
				this.ctx.session.modelRegistry,
				this.ctx.session.scopedModels,
				async selection => {
					try {
						if (selection.kind === "preset") {
							await this.#applyModelAssignmentPreset(selection);
							modelSelector.refreshFromSettings();
							this.ctx.ui.requestRender();
							return;
						}
						if (selection.kind === "profile") {
							await activateModelProfile(
								{
									session: this.ctx.session,
									modelRegistry: this.ctx.session.modelRegistry,
									settings: this.ctx.settings,
									profileName: selection.profileName,
								},
								{ persistDefault: selection.setDefault },
							);
							modelSelector.refreshFromSettings({ currentProfileName: selection.profileName });
							this.ctx.statusLine.invalidate();
							this.ctx.updateEditorBorderColor();
							this.ctx.showStatus(
								selection.setDefault
									? `Default model profile: ${selection.profileName}`
									: `Model profile: ${selection.profileName}`,
							);
							this.ctx.ui.requestRender();
							return;
						}
						const { model, role, thinkingLevel, selector: selectedSelector } = selection;
						if (role === null) {
							// Temporary: update agent state but don't persist to settings
							await this.ctx.session.setModelTemporary(model, thinkingLevel);
							this.ctx.statusLine.invalidate();
							this.ctx.updateEditorBorderColor();
							this.ctx.showStatus(`Temporary model: ${selectedSelector ?? model.id}`);
							done();
							this.ctx.ui.requestRender();
						} else if (role === "default") {
							// Default: update agent state and persist as the active default model.
							await this.ctx.session.setModel(model, role, {
								selector: selectedSelector,
								thinkingLevel,
							});
							if (thinkingLevel && thinkingLevel !== ThinkingLevel.Inherit) {
								this.ctx.session.setThinkingLevel(thinkingLevel);
							}
							modelSelector.refreshFromSettings();
							this.ctx.statusLine.invalidate();
							this.ctx.updateEditorBorderColor();
							this.ctx.showStatus(`Default model: ${selectedSelector ?? model.id}`);
							this.ctx.ui.requestRender();
						} else {
							// Role-agent assignments configure Task dispatch and must not switch the active chat model.
							const apiKey = await this.ctx.session.modelRegistry.getApiKey(model, this.ctx.session.sessionId);
							if (!apiKey) {
								throw new Error(`No API key for ${model.provider}/${model.id}`);
							}
							const overrides = this.ctx.settings.get("task.agentModelOverrides");
							const value = selectedSelector ?? `${model.provider}/${model.id}`;
							const nextOverrides = { ...overrides, [role]: value };
							if (role === "executor_ext") delete nextOverrides.executor;
							this.ctx.settings.set("task.agentModelOverrides", nextOverrides);
							this.ctx.settings.override("task.agentModelOverrides", nextOverrides);
							this.ctx.settings.getStorage()?.recordModelUsage(`${model.provider}/${model.id}`);
							modelSelector.refreshFromSettings();
							this.ctx.showStatus(`${role} agent model: ${value}`);
							this.ctx.ui.requestRender();
						}
					} catch (error) {
						modelSelector.refreshFromSettings({
							currentProfileName:
								this.ctx.session.getActiveModelProfile?.() ?? this.ctx.settings.get("modelProfile.default"),
						});
						this.ctx.ui.requestRender();
						this.ctx.showError(error instanceof Error ? error.message : String(error));
					}
				},
				() => {
					done();
					this.ctx.ui.requestRender();
				},
				{
					...options,
					currentProfileName:
						this.ctx.session.getActiveModelProfile?.() ?? this.ctx.settings.get("modelProfile.default"),
				},
			);
			return { component: modelSelector, focus: modelSelector };
		});
	}

	async #applyModelAssignmentPreset(selection: Extract<ModelSelectorSelection, { kind: "preset" }>): Promise<void> {
		const { assignments, model, preset, selector } = selection;
		const apiKey = await this.ctx.session.modelRegistry.getApiKey(model, this.ctx.session.sessionId);
		if (!apiKey) {
			throw new Error(`No API key for ${model.provider}/${model.id}`);
		}

		const defaultThinkingLevel = assignments.default;
		await this.ctx.session.setModel(model, "default", {
			selector,
			thinkingLevel: defaultThinkingLevel,
		});
		if (defaultThinkingLevel && defaultThinkingLevel !== ThinkingLevel.Inherit) {
			this.ctx.session.setThinkingLevel(defaultThinkingLevel);
		}

		const overrides = this.ctx.settings.get("task.agentModelOverrides");
		const nextOverrides = { ...overrides };
		for (const [targetRole, presetThinkingLevel] of Object.entries(assignments) as [
			keyof Extract<ModelSelectorSelection, { kind: "preset" }>["assignments"],
			ThinkingLevel,
		][]) {
			if (!targetRole || targetRole === "default") continue;
			nextOverrides[targetRole] =
				presetThinkingLevel === ThinkingLevel.Inherit ? selector : `${selector}:${presetThinkingLevel}`;
			if (targetRole === "executor_ext") delete nextOverrides.executor;
		}
		this.ctx.settings.set("task.agentModelOverrides", nextOverrides);
		this.ctx.settings.override("task.agentModelOverrides", nextOverrides);
		this.ctx.settings.getStorage()?.recordModelUsage(`${model.provider}/${model.id}`);
		this.ctx.statusLine.invalidate();
		this.ctx.updateEditorBorderColor();
		this.ctx.showStatus(`${preset.label}: ${selector}`);
	}

	async showPluginSelector(mode: "install" | "uninstall" = "install"): Promise<void> {
		const mgr = new MarketplaceManager({
			marketplacesRegistryPath: getMarketplacesRegistryPath(),
			installedRegistryPath: getInstalledPluginsRegistryPath(),
			projectInstalledRegistryPath: (await resolveActiveProjectRegistryPath(getProjectDir())) ?? undefined,
			marketplacesCacheDir: getMarketplacesCacheDir(),
			pluginsCacheDir: getPluginsCacheDir(),
			clearPluginRootsCache: clearPluginRootsAndCaches,
		});

		const [marketplaces, installed] = await Promise.all([mgr.listMarketplaces(), mgr.listInstalledPlugins()]);
		const installedIds = new Set(installed.map(p => p.id));

		if (mode === "uninstall") {
			// Show only installed plugins for uninstall
			const items = installed.map(p => {
				const entry = p.entries[0];
				const atIdx = p.id.lastIndexOf("@");
				const pluginName = atIdx > 0 ? p.id.slice(0, atIdx) : p.id;
				const mkt = atIdx > 0 ? p.id.slice(atIdx + 1) : "unknown";
				return {
					plugin: { name: pluginName, version: entry?.version, description: undefined as string | undefined },
					marketplace: mkt,
					scope: p.scope,
				};
			});
			this.showSelector(done => {
				const selector = new PluginSelectorComponent(marketplaces.length, items, new Set(), {
					onSelect: async (name, marketplace, scope) => {
						done();
						const pluginId = `${name}@${marketplace}`;
						this.ctx.showStatus(`Uninstalling ${pluginId}...`);
						this.ctx.ui.requestRender();
						try {
							await mgr.uninstallPlugin(pluginId, scope);
							this.ctx.showStatus(`Uninstalled ${pluginId}`);
						} catch (err) {
							this.ctx.showStatus(`Uninstall failed: ${err}`);
						}
						this.ctx.ui.requestRender();
					},
					onCancel: () => {
						done();
						this.ctx.ui.requestRender();
					},
				});
				return { component: selector, focus: selector.getSelectList() };
			});
			return;
		}

		// Install mode: show all available plugins from all marketplaces
		const allPlugins: Array<{
			plugin: { name: string; version?: string; description?: string };
			marketplace: string;
		}> = [];
		for (const mkt of marketplaces) {
			const plugins = await mgr.listAvailablePlugins(mkt.name);
			for (const plugin of plugins) {
				allPlugins.push({ plugin, marketplace: mkt.name });
			}
		}

		this.showSelector(done => {
			const selector = new PluginSelectorComponent(marketplaces.length, allPlugins, installedIds, {
				onSelect: async (name, marketplace) => {
					done();
					this.ctx.showStatus(`Installing ${name} from ${marketplace}...`);
					this.ctx.ui.requestRender();
					try {
						const force = installedIds.has(`${name}@${marketplace}`);
						await mgr.installPlugin(name, marketplace, { force });
						this.ctx.showStatus(`Installed ${name} from ${marketplace}`);
					} catch (err) {
						this.ctx.showStatus(`Install failed: ${err}`);
					}
					this.ctx.ui.requestRender();
				},
				onCancel: () => {
					done();
					this.ctx.ui.requestRender();
				},
			});
			return { component: selector, focus: selector.getSelectList() };
		});
	}

	showUserMessageSelector(): void {
		const userMessages = this.ctx.session.getUserMessagesForBranching();

		if (userMessages.length === 0) {
			this.ctx.showStatus("No messages to branch from");
			return;
		}

		this.showSelector(done => {
			const selector = new UserMessageSelectorComponent(
				userMessages.map(m => ({ id: m.entryId, text: m.text })),
				async entryId => {
					const result = await this.ctx.session.branch(entryId);
					if (result.cancelled) {
						// Hook cancelled the branch
						done();
						this.ctx.ui.requestRender();
						return;
					}

					this.ctx.chatContainer.clear();
					this.ctx.renderInitialMessages();
					this.ctx.editor.setText(result.selectedText);
					done();
					this.ctx.showStatus("Branched to new session");
				},
				() => {
					done();
					this.ctx.ui.requestRender();
				},
			);
			return { component: selector, focus: selector.getMessageList() };
		});
	}

	showTreeSelector(): void {
		const tree = this.ctx.sessionManager.getTree();
		const realLeafId = this.ctx.sessionManager.getLeafId();

		if (tree.length === 0) {
			this.ctx.showStatus("No entries in session");
			return;
		}

		this.showSelector(done => {
			const selector = new TreeSelectorComponent(
				tree,
				realLeafId,
				this.ctx.ui.terminal.rows,
				async entryId => {
					// Selecting the current leaf is a no-op (already there)
					if (entryId === realLeafId) {
						done();
						this.ctx.showStatus("Already at this point");
						return;
					}

					// Ask about summarization
					done(); // Close selector first

					// Loop until user makes a complete choice or cancels to tree
					let wantsSummary = false;
					let customInstructions: string | undefined;

					const branchSummariesEnabled = settings.get("branchSummary.enabled");

					while (branchSummariesEnabled) {
						const summaryChoice = await this.ctx.showHookSelector("Summarize branch?", [
							"No summary",
							"Summarize",
							"Summarize with custom prompt",
						]);

						if (summaryChoice === undefined) {
							// User pressed escape - re-show tree selector
							this.showTreeSelector();
							return;
						}

						wantsSummary = summaryChoice !== "No summary";

						if (summaryChoice === "Summarize with custom prompt") {
							customInstructions = await this.ctx.showHookEditor("Custom summarization instructions");
							if (customInstructions === undefined) {
								// User cancelled - loop back to summary selector
								continue;
							}
						}

						// User made a complete choice
						break;
					}

					// Set up escape handler and loader if summarizing
					let summaryLoader: Loader | undefined;
					const originalOnEscape = this.ctx.editor.onEscape;

					if (wantsSummary) {
						this.ctx.editor.onEscape = () => {
							this.ctx.session.abortBranchSummary();
						};
						this.ctx.chatContainer.addChild(new Spacer(1));
						summaryLoader = new Loader(
							this.ctx.ui,
							spinner => theme.fg("accent", spinner),
							text => theme.fg("muted", text),
							"Summarizing branch... (esc to cancel)",
							getSymbolTheme().spinnerFrames,
						);
						this.ctx.statusContainer.addChild(summaryLoader);
						this.ctx.ui.requestRender();
					}

					try {
						const result = await this.ctx.session.navigateTree(entryId, {
							summarize: wantsSummary,
							customInstructions,
						});

						if (result.aborted) {
							// Summarization aborted - re-show tree selector
							this.ctx.showStatus("Branch summarization cancelled");
							this.showTreeSelector();
							return;
						}
						if (result.cancelled) {
							this.ctx.showStatus("Navigation cancelled");
							return;
						}

						// Update UI — pass the context built by navigateTree to skip a second O(N) walk.
						this.ctx.chatContainer.clear();
						this.ctx.renderInitialMessages(result.sessionContext);
						await this.ctx.reloadTodos();
						if (result.editorText && !this.ctx.editor.getText().trim()) {
							this.ctx.editor.setText(result.editorText);
						}
						this.ctx.showStatus("Navigated to selected point");
					} catch (error) {
						this.ctx.showError(error instanceof Error ? error.message : String(error));
					} finally {
						if (summaryLoader) {
							summaryLoader.stop();
							this.ctx.statusContainer.clear();
						}
						this.ctx.editor.onEscape = originalOnEscape;
					}
				},
				() => {
					done();
					this.ctx.ui.requestRender();
				},
				(entryId, label) => {
					this.ctx.sessionManager.appendLabelChange(entryId, label);
					this.ctx.ui.requestRender();
				},
				settings.get("treeFilterMode"),
			);
			return { component: selector, focus: selector };
		});
	}

	async showSessionSelector(): Promise<void> {
		const sessions = await SessionManager.list(
			this.ctx.sessionManager.getCwd(),
			this.ctx.sessionManager.getSessionDir(),
		);
		this.showSelector(done => {
			const selector = new SessionSelectorComponent(
				sessions,
				async sessionPath => {
					done();
					await this.handleResumeSession(sessionPath);
				},
				() => {
					done();
					this.ctx.ui.requestRender();
				},
				() => {
					void this.ctx.shutdown();
				},
				async (session: SessionInfo) => {
					if (!(await this.#detachActiveSessionBeforeDeletion(session.path))) {
						return false;
					}
					const storage = new FileSessionStorage();
					try {
						await storage.deleteSessionWithArtifacts(session.path);
						return true;
					} catch (err) {
						throw new Error(`Failed to delete session: ${err instanceof Error ? err.message : String(err)}`, {
							cause: err,
						});
					}
				},
			);
			selector.setOnRequestRender(() => this.ctx.ui.requestRender());
			return { component: selector, focus: selector };
		});
	}

	#clearTransientSessionUi(): void {
		if (this.ctx.loadingAnimation) {
			this.ctx.loadingAnimation.stop();
			this.ctx.loadingAnimation = undefined;
		}
		this.ctx.statusContainer.clear();
		this.ctx.pendingMessagesContainer.clear();
		this.ctx.compactionQueuedMessages = [];
		this.ctx.streamingComponent = undefined;
		this.ctx.streamingMessage = undefined;
		this.ctx.pendingTools.clear();
	}

	#refreshSessionTerminalTitle(): void {
		const sessionManager = this.ctx.sessionManager as {
			getSessionName?: () => string | undefined;
			getCwd: () => string;
			titleSource?: "auto" | "user" | undefined;
		};
		setSessionTerminalTitle(sessionManager.getSessionName?.(), sessionManager.getCwd());
	}

	async #detachActiveSessionBeforeDeletion(sessionPath: string): Promise<boolean> {
		const currentSessionFile = this.ctx.sessionManager.getSessionFile();
		if (currentSessionFile !== sessionPath) {
			return true;
		}

		const detached = await this.ctx.session.newSession();
		if (!detached) {
			return false;
		}
		this.#refreshSessionTerminalTitle();

		this.#clearTransientSessionUi();
		this.ctx.statusLine.invalidate();
		this.ctx.statusLine.setSessionStartTime(Date.now());
		this.ctx.updateEditorTopBorder();
		this.ctx.updateEditorBorderColor();
		this.ctx.renderInitialMessages();
		await this.ctx.reloadTodos();
		this.ctx.ui.requestRender();
		return true;
	}

	async handleResumeByIdCommand(sessionArg: string): Promise<void> {
		const match = await resolveResumableSession(
			sessionArg,
			this.ctx.sessionManager.getCwd(),
			this.ctx.sessionManager.getSessionDir(),
		);
		if (!match) {
			this.ctx.showError(`No session matching "${sessionArg}". Use /resume to open the selector.`);
			return;
		}
		if (match.session.cwd !== this.ctx.sessionManager.getCwd()) {
			this.ctx.showError(
				`Session ${sessionArg} belongs to a different project (${match.session.cwd}). Run \`${APP_NAME} -r ${sessionArg}\` there.`,
			);
			return;
		}
		// Route through the interactive-mode wrapper so btw disposal and observer reset run.
		await this.ctx.handleResumeSession(match.session.path);
	}

	async handleResumeSession(sessionPath: string): Promise<void> {
		this.#clearTransientSessionUi();

		// Switch session via AgentSession (emits hook and tool session events)
		await this.ctx.session.switchSession(sessionPath);
		this.#refreshSessionTerminalTitle();
		this.ctx.updateEditorBorderColor();

		// Clear and re-render the chat
		this.ctx.chatContainer.clear();
		this.ctx.renderInitialMessages();
		await this.ctx.reloadTodos();
		this.ctx.showStatus("Resumed session");
	}

	async handleSessionDeleteCommand(): Promise<void> {
		const sessionFile = this.ctx.sessionManager.getSessionFile();
		if (!sessionFile) {
			this.ctx.showError("No session file to delete (in-memory session)");
			return;
		}

		// Check if session file exists (may not exist for brand new sessions)
		const storage = new FileSessionStorage();
		const fileExists = await storage.exists(sessionFile);
		if (!fileExists) {
			this.ctx.showError("Session has not been saved yet");
			return;
		}

		const confirmed = await this.ctx.showHookConfirm(
			"Delete Session",
			"This will permanently delete the current session.\nYou will be returned to the session selector.",
		);

		if (!confirmed) {
			this.ctx.showStatus("Delete cancelled");
			return;
		}

		if (!(await this.#detachActiveSessionBeforeDeletion(sessionFile))) {
			this.ctx.showStatus("Delete cancelled");
			return;
		}

		// Delete the session file and artifacts directory
		await storage.deleteSessionWithArtifacts(sessionFile);

		// Show session selector
		this.ctx.showStatus("Session deleted");
		await this.showSessionSelector();
	}

	async #handleOAuthLogin(providerId: string, opts?: { importLocal?: boolean }): Promise<void> {
		this.ctx.showStatus(`Logging in to ${providerId}…`);
		const manualInput = this.ctx.oauthManualInput;
		const useManualInput = CALLBACK_SERVER_PROVIDERS.has(providerId as OAuthProvider);
		try {
			await this.ctx.session.modelRegistry.authStorage.login(
				providerId as OAuthProvider,
				{
					onAuth: (info: { url: string; instructions?: string }) => {
						this.ctx.chatContainer.addChild(new Spacer(1));
						this.ctx.chatContainer.addChild(new Text(theme.fg("dim", info.url), 1, 0));
						const hyperlink = `\x1b]8;;${info.url}\x07Click here to login\x1b]8;;\x07`;
						this.ctx.chatContainer.addChild(new Text(theme.fg("accent", hyperlink), 1, 0));
						if (info.instructions) {
							this.ctx.chatContainer.addChild(new Spacer(1));
							this.ctx.chatContainer.addChild(new Text(theme.fg("warning", info.instructions), 1, 0));
						}
						if (useManualInput) {
							this.ctx.chatContainer.addChild(new Spacer(1));
							this.ctx.chatContainer.addChild(new Text(theme.fg("dim", MANUAL_LOGIN_TIP), 1, 0));
						}
						this.ctx.ui.requestRender();
						this.ctx.openInBrowser(info.url);
					},
					onPrompt: async (prompt: { message: string; placeholder?: string }) => {
						this.ctx.chatContainer.addChild(new Spacer(1));
						this.ctx.chatContainer.addChild(new Text(theme.fg("warning", prompt.message), 1, 0));
						if (prompt.placeholder) {
							this.ctx.chatContainer.addChild(new Text(theme.fg("dim", prompt.placeholder), 1, 0));
						}
						this.ctx.ui.requestRender();
						const { promise, resolve } = Promise.withResolvers<string>();
						const codeInput = new Input();
						codeInput.onSubmit = () => {
							const code = codeInput.getValue();
							this.ctx.editorContainer.clear();
							this.ctx.editorContainer.addChild(this.ctx.editor);
							this.ctx.ui.setFocus(this.ctx.editor);
							resolve(code);
						};
						this.ctx.editorContainer.clear();
						this.ctx.editorContainer.addChild(codeInput);
						this.ctx.ui.setFocus(codeInput);
						this.ctx.ui.requestRender();
						return promise;
					},
					onProgress: (message: string) => {
						this.ctx.chatContainer.addChild(new Text(theme.fg("dim", message), 1, 0));
						this.ctx.ui.requestRender();
					},
					onManualCodeInput: useManualInput ? () => manualInput.waitForInput(providerId) : undefined,
				},
				opts,
			);
			await this.ctx.session.modelRegistry.refresh();
			this.ctx.chatContainer.addChild(new Spacer(1));
			this.ctx.chatContainer.addChild(
				new Text(theme.fg("success", `${theme.status.success} Successfully logged in to ${providerId}`), 1, 0),
			);
			this.ctx.chatContainer.addChild(new Text(theme.fg("dim", `Credentials saved to ${getAgentDbPath()}`), 1, 0));
			this.ctx.ui.requestRender();
		} catch (error: unknown) {
			this.ctx.showError(`Login failed: ${error instanceof Error ? error.message : String(error)}`);
		} finally {
			if (useManualInput) {
				manualInput.clear(`Manual OAuth input cleared for ${providerId}`);
			}
		}
	}

	async #handleOAuthLogout(providerId: string): Promise<void> {
		try {
			await this.ctx.session.modelRegistry.authStorage.logout(providerId);
			await this.ctx.session.modelRegistry.refresh();
			this.ctx.chatContainer.addChild(new Spacer(1));
			this.ctx.chatContainer.addChild(
				new Text(theme.fg("success", `${theme.status.success} Successfully logged out of ${providerId}`), 1, 0),
			);
			this.ctx.chatContainer.addChild(
				new Text(theme.fg("dim", `Credentials removed from ${getAgentDbPath()}`), 1, 0),
			);
			this.ctx.ui.requestRender();
		} catch (error: unknown) {
			this.ctx.showError(`Logout failed: ${error instanceof Error ? error.message : String(error)}`);
		}
	}

	async showOAuthSelector(
		mode: "login" | "logout",
		providerId?: string,
		opts?: { importLocal?: boolean },
	): Promise<void> {
		if (providerId) {
			const resolvedProviderId = resolveOAuthProviderId(providerId);
			if (!resolvedProviderId) {
				this.ctx.showError(`Unknown OAuth provider: ${providerId}`);
				return;
			}
			if (mode === "login") {
				await this.#handleOAuthLogin(resolvedProviderId, opts);
			} else {
				await this.#handleOAuthLogout(resolvedProviderId);
			}
			return;
		}

		if (mode === "logout") {
			await this.#refreshOAuthProviderAuthState();
			const oauthProviders = getOAuthProviders();
			const loggedInProviders = oauthProviders.filter(provider =>
				this.ctx.session.modelRegistry.authStorage.hasAuth(provider.id),
			);
			if (loggedInProviders.length === 0) {
				this.ctx.showStatus("No OAuth providers logged in. Use /login first.");
				return;
			}
		}

		this.showSelector(done => {
			let selector: OAuthSelectorComponent;
			selector = new OAuthSelectorComponent(
				mode,
				this.ctx.session.modelRegistry.authStorage,
				async (selectedProviderId: string) => {
					selector.stopValidation();
					done();
					if (mode === "login") {
						await this.#handleOAuthLogin(selectedProviderId);
					} else {
						await this.#handleOAuthLogout(selectedProviderId);
					}
				},
				() => {
					selector.stopValidation();
					done();
					this.ctx.ui.requestRender();
				},
				{
					validateAuth: async (selectedProviderId: string) => {
						const apiKey = await this.ctx.session.modelRegistry.getApiKeyForProvider(
							selectedProviderId,
							this.ctx.session.sessionId,
						);
						return !!apiKey;
					},
					requestRender: () => {
						this.ctx.ui.requestRender();
					},
				},
			);
			return { component: selector, focus: selector };
		});
	}

	showDebugSelector(): void {
		this.showSelector(done => {
			const selector = new DebugSelectorComponent(this.ctx, done);
			return { component: selector, focus: selector };
		});
	}

	showSessionObserver(registry: SessionObserverRegistry): void {
		const observeKeys = this.ctx.keybindings.getKeys("app.session.observe");
		let cleanup: (() => void) | undefined;
		let overlayHandle: OverlayHandle | undefined;

		const done = () => {
			cleanup?.();
			overlayHandle?.hide();
			this.ctx.ui.requestRender();
		};

		const selector = new SessionObserverOverlayComponent(registry, done, observeKeys);

		cleanup = registry.onChange(() => {
			selector.refreshFromRegistry();
			this.ctx.ui.requestRender();
		});

		overlayHandle = this.ctx.ui.showOverlay(selector, {
			anchor: "bottom-center",
			width: "100%",
			maxHeight: "100%",
			margin: 0,
		});
		this.ctx.ui.setFocus(selector);
		this.ctx.ui.requestRender();
	}

	/**
	 * Jobs overlay: navigate ongoing monitor + cron jobs (Monitors then Crons,
	 * newest-first), drill into per-type detail, and cancel/delete with a y/N
	 * confirm. Built from nested SelectLists (list -> detail -> confirm) so focus
	 * stays on the active SelectList.
	 */
	showJobsOverlay(observer: JobsObserver): void {
		let overlay: JobsOverlayComponent | undefined;
		const close = () => {
			this.ctx.editorContainer.clear();
			this.ctx.editorContainer.addChild(this.ctx.editor);
			this.ctx.ui.setFocus(this.ctx.editor);
			this.ctx.ui.requestRender();
		};
		overlay = new JobsOverlayComponent(observer, {
			close,
			requestRender: () => {
				if (overlay) this.ctx.ui.setFocus(overlay.getFocus());
				this.ctx.ui.requestRender();
			},
		});
		this.ctx.editorContainer.clear();
		this.ctx.editorContainer.addChild(overlay);
		this.ctx.ui.setFocus(overlay.getFocus());
		this.ctx.ui.requestRender();
	}
}
