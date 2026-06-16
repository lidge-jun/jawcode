import { describe, expect, it, spyOn } from "bun:test";
import { BUILTIN_SLASH_COMMANDS_INTERNAL } from "../../src/slash-commands/builtin-registry";
import type { SlashCommandRuntime } from "../../src/slash-commands/types";
import * as searchProviderModule from "../../src/web/search/provider";

function findSearchEngineCommand() {
	const command = BUILTIN_SLASH_COMMANDS_INTERNAL.find(entry => entry.name === "searchengine");
	expect(command).toBeTruthy();
	return command;
}

function createRuntime(options: {
	outputs: string[];
	settingsLog: Array<{ key: string; value: unknown }>;
	currentWebSearch?: string;
	activeModelProvider?: string;
	configChanges?: number[];
	/** When omitted, no authStorage is exposed (status falls back to a plain candidate list). */
	withAuthStorage?: boolean;
	/** Provider keys reporting an OAuth credential (e.g. "openai-codex", "anthropic"). */
	oauthKeys?: string[];
	/** Provider keys reporting a stored (non-OAuth) auth credential. */
	authKeys?: string[];
}): SlashCommandRuntime {
	// AuthStorage stub: only keys in oauthKeys/authKeys report available, so the
	// gating mirrors real OAuth-vs-key activation (env-keyed providers stay off).
	const oauth = new Set(options.oauthKeys ?? []);
	const auth = new Set([...(options.authKeys ?? []), ...(options.oauthKeys ?? [])]);
	const authStorage = options.withAuthStorage
		? {
				getAll: () => ({}),
				hasAuth: (provider: string) => auth.has(provider),
				hasOAuth: (provider: string) => oauth.has(provider),
				getApiKey: () => undefined,
				getOAuthAccess: () => undefined,
				getOAuthAccountId: () => undefined,
			}
		: undefined;
	return {
		session: {
			model: options.activeModelProvider ? { provider: options.activeModelProvider } : undefined,
			modelRegistry: authStorage ? { authStorage } : undefined,
		},
		sessionManager: {},
		settings: {
			get: (key: string) => (key === "providers.webSearch" ? (options.currentWebSearch ?? "auto") : undefined),
			set: (key: string, value: unknown) => {
				options.settingsLog.push({ key, value });
			},
		},
		cwd: process.cwd(),
		output: (text: string) => {
			options.outputs.push(text);
		},
		refreshCommands: () => undefined,
		reloadPlugins: async () => undefined,
		notifyConfigChanged: () => {
			options.configChanges?.push(1);
		},
	} as unknown as SlashCommandRuntime;
}

describe("searchengine slash command", () => {
	it("declares allowArgs so '/searchengine chatgpt' dispatches instead of falling through to chat", () => {
		// cmd_audit P1: an args-advertising spec without allowArgs is silently
		// refused by the TUI dispatcher and the input leaks to the LLM as chat.
		const command = findSearchEngineCommand();
		expect(command?.allowArgs).toBe(true);
	});

	it("uses a lowercase-only name (parser lowercases the verb, so an uppercase alias was dead)", () => {
		const command = findSearchEngineCommand();
		expect(command?.name).toBe("searchengine");
		expect(command?.aliases ?? []).not.toContain("SEARCHENGINE");
	});

	it("prints current provider and candidates on bare invocation", async () => {
		const outputs: string[] = [];
		const settingsLog: Array<{ key: string; value: unknown }> = [];
		const command = findSearchEngineCommand();

		await command?.handle?.(
			{ name: "searchengine", args: "", text: "/searchengine" },
			createRuntime({ outputs, settingsLog, currentWebSearch: "auto", activeModelProvider: "openai-codex" }),
		);

		const output = outputs.join("\n");
		expect(output).toContain("Search engine: auto");
		expect(output).toContain("codex");
		expect(output).toContain("Providers:");
		expect(settingsLog).toHaveLength(0);
	});

	it("canonicalizes chatgpt alias to codex and persists + notifies", async () => {
		const outputs: string[] = [];
		const settingsLog: Array<{ key: string; value: unknown }> = [];
		const configChanges: number[] = [];
		const command = findSearchEngineCommand();

		await command?.handle?.(
			{ name: "searchengine", args: "chatgpt", text: "/searchengine chatgpt" },
			createRuntime({ outputs, settingsLog, configChanges }),
		);

		expect(settingsLog).toEqual([{ key: "providers.webSearch", value: "codex" }]);
		expect(configChanges).toHaveLength(1);
		expect(outputs.join("\n")).toContain("Search engine set to codex");
	});

	it("calls the runtime setter as the second half of the mandatory dual-write", async () => {
		// providers.webSearch has no SETTING_HOOK, so settings.set alone does
		// NOT update the in-process preferred provider — the handler must also
		// call setPreferredSearchProvider. Guard against silently dropping it.
		const spy = spyOn(searchProviderModule, "setPreferredSearchProvider");
		try {
			const outputs: string[] = [];
			const settingsLog: Array<{ key: string; value: unknown }> = [];
			const command = findSearchEngineCommand();

			await command?.handle?.(
				{ name: "searchengine", args: "claude", text: "/searchengine claude" },
				createRuntime({ outputs, settingsLog }),
			);

			expect(spy).toHaveBeenCalledWith("anthropic");
		} finally {
			spy.mockRestore();
		}
	});

	it("accepts canonical provider ids directly", async () => {
		const outputs: string[] = [];
		const settingsLog: Array<{ key: string; value: unknown }> = [];
		const command = findSearchEngineCommand();

		await command?.handle?.(
			{ name: "searchengine", args: "perplexity", text: "/searchengine perplexity" },
			createRuntime({ outputs, settingsLog }),
		);

		expect(settingsLog).toEqual([{ key: "providers.webSearch", value: "perplexity" }]);
	});

	it("restores auto and describes the active model's native target", async () => {
		const outputs: string[] = [];
		const settingsLog: Array<{ key: string; value: unknown }> = [];
		const command = findSearchEngineCommand();

		await command?.handle?.(
			{ name: "searchengine", args: "auto", text: "/searchengine auto" },
			createRuntime({ outputs, settingsLog, activeModelProvider: "anthropic" }),
		);

		expect(settingsLog).toEqual([{ key: "providers.webSearch", value: "auto" }]);
		expect(outputs.join("\n")).toContain("anthropic");
	});

	it("rejects unknown providers with usage and does not mutate settings", async () => {
		const outputs: string[] = [];
		const settingsLog: Array<{ key: string; value: unknown }> = [];
		const command = findSearchEngineCommand();

		await command?.handle?.(
			{ name: "searchengine", args: "altavista", text: "/searchengine altavista" },
			createRuntime({ outputs, settingsLog }),
		);

		expect(settingsLog).toHaveLength(0);
		const output = outputs.join("\n");
		expect(output).toContain("Unknown search engine: altavista");
		expect(output).toContain("Aliases:");
	});

	it("status: OAuth credential activates codex; keyless DuckDuckGo always activated; keyed providers stay in Needs setup", async () => {
		const outputs: string[] = [];
		const settingsLog: Array<{ key: string; value: unknown }> = [];
		const command = findSearchEngineCommand();

		// OAuth-logged into OpenAI (codex) — mirrors model-layer OAuth gating.
		await command?.handle?.(
			{ name: "searchengine", args: "status", text: "/searchengine status" },
			createRuntime({ outputs, settingsLog, withAuthStorage: true, oauthKeys: ["openai-codex"] }),
		);

		const output = outputs.join("\n");
		const activatedLine = output.split("\n").find(l => l.startsWith("Activated:")) ?? "";
		expect(activatedLine).toContain("duckduckgo");
		expect(activatedLine).toContain("codex");
		// A keyed-only provider with no key must NOT be activated.
		expect(activatedLine).not.toContain("brave");
		expect(output).toContain("Needs setup:");
		expect(output).toContain("brave — set BRAVE_API_KEY");
	});

	it("status: stored anthropic auth (Claude OAuth) activates anthropic search without a separate search key", async () => {
		const outputs: string[] = [];
		const settingsLog: Array<{ key: string; value: unknown }> = [];
		const command = findSearchEngineCommand();

		await command?.handle?.(
			{ name: "searchengine", args: "status", text: "/searchengine status" },
			createRuntime({ outputs, settingsLog, withAuthStorage: true, authKeys: ["anthropic"] }),
		);

		const activatedLine =
			outputs
				.join("\n")
				.split("\n")
				.find(l => l.startsWith("Activated:")) ?? "";
		expect(activatedLine).toContain("anthropic");
	});

	it("warns when selecting a keyed provider with no credential (persists but flags setup)", async () => {
		const outputs: string[] = [];
		const settingsLog: Array<{ key: string; value: unknown }> = [];
		const command = findSearchEngineCommand();

		await command?.handle?.(
			{ name: "searchengine", args: "brave", text: "/searchengine brave" },
			createRuntime({ outputs, settingsLog, withAuthStorage: true }),
		);

		// Still persisted (operator may add the key next)...
		expect(settingsLog).toEqual([{ key: "providers.webSearch", value: "brave" }]);
		// ...but warned it's not active yet.
		const output = outputs.join("\n");
		expect(output).toContain("not activated yet");
		expect(output).toContain("BRAVE_API_KEY");
	});
});
