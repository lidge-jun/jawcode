import { describe, expect, it } from "bun:test";
import { resolveOAuthProviderId } from "../src/config/oauth-provider-aliases";
import { executeBuiltinSlashCommand } from "../src/slash-commands/builtin-registry";

interface OAuthSelectorCall {
	mode: "login" | "logout";
	providerId: string | undefined;
	opts: { importLocal?: boolean } | undefined;
}

function createLoginRuntime(calls: OAuthSelectorCall[]) {
	return {
		ctx: {
			oauthManualInput: {
				hasPending: () => false,
				submit: () => false,
				pendingProviderId: undefined,
			},
			showOAuthSelector: (mode: "login" | "logout", providerId?: string, opts?: { importLocal?: boolean }) => {
				calls.push({ mode, providerId, opts });
				return Promise.resolve();
			},
			showWarning: () => undefined,
			showStatus: () => undefined,
			editor: { setText: () => undefined },
		},
		handleBackgroundCommand: () => undefined,
	} as unknown as Parameters<typeof executeBuiltinSlashCommand>[1];
}

describe("OAuth provider aliases", () => {
	it("resolves short login aliases while preserving exact one-word providers", () => {
		expect(resolveOAuthProviderId("claude")).toBe("anthropic");
		expect(resolveOAuthProviderId("codex")).toBe("openai-codex");
		expect(resolveOAuthProviderId("openai")).toBe("openai-codex");
		expect(resolveOAuthProviderId("grok")).toBe("xai");
		expect(resolveOAuthProviderId("xai")).toBe("xai");
		expect(resolveOAuthProviderId("gemini")).toBe("google-gemini-cli");
		expect(resolveOAuthProviderId("kimi")).toBe("kimi-code");
	});

	it("routes /login aliases to canonical OAuth providers", async () => {
		const calls: OAuthSelectorCall[] = [];
		const runtime = createLoginRuntime(calls);

		expect(await executeBuiltinSlashCommand("/login codex", runtime)).toBe(true);
		expect(await executeBuiltinSlashCommand("/login claude local", runtime)).toBe(true);
		expect(await executeBuiltinSlashCommand("/login grok local", runtime)).toBe(true);

		expect(calls).toEqual([
			{ mode: "login", providerId: "openai-codex", opts: undefined },
			{ mode: "login", providerId: "anthropic", opts: { importLocal: true } },
			{ mode: "login", providerId: "xai", opts: { importLocal: true } },
		]);
	});
});
