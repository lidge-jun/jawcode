import { afterEach, describe, expect, test } from "bun:test";
import * as fs from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";
import { AuthStorage, type CredentialDisabledEvent } from "../src/auth-storage";
import { OpenAICodexTerminalOAuthError } from "../src/utils/oauth/openai-codex";

describe("AuthStorage Codex request-time terminal classification", () => {
	const cleanup: Array<() => Promise<void>> = [];

	afterEach(async () => {
		for (const dispose of cleanup.splice(0)) await dispose();
	});

	async function exercise(error: Error): Promise<{
		activeCredentials: number;
		disabledEvents: CredentialDisabledEvent[];
	}> {
		const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "jwc-auth-codex-terminal-"));
		const disabledEvents: CredentialDisabledEvent[] = [];
		const authStorage = await AuthStorage.create(path.join(tempDir, "auth.db"), {
			refreshOAuthCredential: async () => {
				throw error;
			},
			onCredentialDisabled: event => {
				disabledEvents.push(event);
			},
		});
		cleanup.push(async () => {
			authStorage.close();
			await fs.rm(tempDir, { recursive: true, force: true });
		});
		await authStorage.set("openai-codex", {
			type: "oauth",
			access: "expired-access",
			refresh: "refresh-token",
			expires: 0,
			accountId: "request-account",
		});

		await expect(authStorage.getApiKey("openai-codex", "request-session")).resolves.toBeUndefined();
		return {
			activeCredentials: authStorage.exportSnapshot().credentials.length,
			disabledEvents,
		};
	}

	for (const [name, error] of [
		["proxy 401 HTML", new Error("OpenAI Codex token refresh failed: 401 <html>proxy</html>")],
		["403 rate limiting", new Error("OpenAI Codex token refresh failed: 403 rate limit exceeded")],
		["malformed body", new Error('OpenAI Codex token refresh failed: 401 {"error":"invalid_grant"')],
	] as const) {
		test(`${name} remains active during getApiKey`, async () => {
			const result = await exercise(error);
			expect(result.activeCredentials).toBe(1);
			expect(result.disabledEvents).toHaveLength(0);
		});
	}

	test("typed invalid_grant disables exactly once during getApiKey", async () => {
		const result = await exercise(new OpenAICodexTerminalOAuthError("invalid_grant", "refresh token revoked"));
		expect(result.activeCredentials).toBe(0);
		expect(result.disabledEvents).toHaveLength(1);
		expect(result.disabledEvents[0]?.disabledCause).toContain("invalid_grant");
	});
});
