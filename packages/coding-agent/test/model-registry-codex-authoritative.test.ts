import { afterEach, beforeEach, describe, expect, spyOn, test } from "bun:test";
import * as fs from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";
import type { FetchImpl } from "@jawcode-dev/ai";
import { OpenAICodexTerminalOAuthError } from "@jawcode-dev/ai/utils/oauth/openai-codex";
import type { OAuthCredentials } from "@jawcode-dev/ai/utils/oauth/types";
import { ModelRegistry } from "../src/config/model-registry";
import { AuthStorage } from "../src/session/auth-storage";

describe("ModelRegistry Codex authoritative discovery", () => {
	let authStorage: AuthStorage;
	let tempDir: string;
	let modelsPath: string;

	beforeEach(async () => {
		tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "jwc-codex-registry-"));
		modelsPath = path.join(tempDir, "models.json");
		authStorage = await AuthStorage.create(path.join(tempDir, "auth.db"));
	});

	afterEach(async () => {
		authStorage.close();
		await fs.rm(tempDir, { recursive: true, force: true });
	});

	async function useFailingRefresh(message: string, onDisabled?: (cause: string) => void): Promise<ModelRegistry> {
		authStorage.close();
		authStorage = await AuthStorage.create(path.join(tempDir, `auth-failure-${crypto.randomUUID()}.db`), {
			refreshOAuthCredential: async () => {
				throw new Error(message);
			},
			onCredentialDisabled: event => onDisabled?.(event.disabledCause),
		});
		await authStorage.set("openai-codex", {
			type: "oauth",
			access: "expired",
			refresh: "refresh",
			expires: 0,
			accountId: "account-under-test",
		});
		return new ModelRegistry(authStorage, modelsPath, { fetch: async () => Response.json({ models: [] }) });
	}

	test("runtime token fallback uses the injected fetch", async () => {
		authStorage.setRuntimeApiKey("openai-codex", "runtime-token");
		let modelCalls = 0;
		const fetchFn: FetchImpl = async (input, init) => {
			if (String(input).includes("registry.npmjs.org")) return Response.json({ version: "0.139.0" });
			modelCalls++;
			expect(new Headers(init?.headers).get("Authorization")).toBe("Bearer runtime-token");
			return Response.json({ models: [{ slug: "runtime-codex-model" }] });
		};
		const registry = new ModelRegistry(authStorage, modelsPath, { fetch: fetchFn });
		await registry.refreshProvider("openai-codex", "online");
		expect(modelCalls).toBe(1);
		expect(registry.find("openai-codex", "runtime-codex-model")).toBeDefined();
	});

	test("offline performs zero OAuth refresh and zero model fetch", async () => {
		let refreshCalls = 0;
		authStorage.close();
		authStorage = await AuthStorage.create(path.join(tempDir, "auth-offline.db"), {
			refreshOAuthCredential: async (_provider, _id, credential): Promise<OAuthCredentials> => {
				refreshCalls++;
				return credential;
			},
		});
		await authStorage.set("openai-codex", {
			type: "oauth",
			access: "expired",
			refresh: "refresh",
			expires: 0,
		});
		let fetchCalls = 0;
		const registry = new ModelRegistry(authStorage, modelsPath, {
			fetch: async () => {
				fetchCalls++;
				return Response.json({ models: [] });
			},
		});
		await registry.refreshProvider("openai-codex", "offline");
		expect(refreshCalls).toBe(0);
		expect(fetchCalls).toBe(0);
	});

	test("foreground refresh is abort-bounded and background refresh returns immediately", async () => {
		const timeoutSpy = spyOn(AbortSignal, "timeout").mockReturnValue(AbortSignal.abort(new Error("bounded")));
		try {
			authStorage.setRuntimeApiKey("openai-codex", "runtime-token");
			const registry = new ModelRegistry(authStorage, modelsPath, {
				fetch: async (_input, init) => {
					init?.signal?.throwIfAborted();
					return Response.json({ models: [] });
				},
			});
			await registry.refreshProvider("openai-codex", "online");
			expect(timeoutSpy).toHaveBeenCalled();
			expect(registry.refreshInBackground()).toBeUndefined();
		} finally {
			timeoutSpy.mockRestore();
		}
	});

	test("transient timeout aborts discovery without disabling credentials", async () => {
		authStorage.close();
		authStorage = await AuthStorage.create(path.join(tempDir, "auth-timeout.db"), {
			refreshOAuthCredential: async () => {
				throw new Error("network timeout");
			},
		});
		await authStorage.set("openai-codex", {
			type: "oauth",
			access: "expired",
			refresh: "refresh",
			expires: 0,
		});
		const registry = new ModelRegistry(authStorage, modelsPath, { fetch: async () => Response.json({ models: [] }) });
		await registry.refreshProvider("openai-codex", "online");
		expect(authStorage.exportSnapshot().credentials).toHaveLength(1);
	});

	for (const [name, message] of [
		["proxy 401 HTML", "OpenAI Codex token refresh failed: 401 <html>proxy auth</html>"],
		["403 rate limit", "OpenAI Codex token refresh failed: 403 rate limit exceeded"],
		["malformed 401 body", "OpenAI Codex token refresh failed: 401 {not-json"],
		["HTML script containing invalid_grant JSON text", '502 <script>...{"error":"invalid_grant"}...</script>'],
		["truncated invalid_grant JSON", '401 {"error":"invalid_grant"'],
		["502 corporate WAF JSON", '502 application/json {"error":"invalid_grant","proxy":"corp-waf"}'],
		["502 text/html valid JSON body", '502 text/html {"error":"invalid_grant"}'],
		["429 terminal-looking body", '429 {"error":"invalid_grant"}'],
	] as const) {
		test(`${name} is transient and does not disable the credential`, async () => {
			const registry = await useFailingRefresh(message);
			await registry.refreshProvider("openai-codex", "online");
			expect(authStorage.exportSnapshot().credentials).toHaveLength(1);
		});
	}

	test("underlying refresh observes caller abort and cannot complete its mutation", async () => {
		let observedAbort = false;
		let completedMutation = false;
		authStorage.close();
		authStorage = await AuthStorage.create(path.join(tempDir, "auth-abort.db"), {
			refreshOAuthCredential: async (_provider, _id, credential, signal): Promise<OAuthCredentials> => {
				const aborted = Promise.withResolvers<void>();
				if (signal?.aborted) {
					observedAbort = true;
					aborted.reject(signal.reason);
				} else {
					signal?.addEventListener(
						"abort",
						() => {
							observedAbort = true;
							aborted.reject(signal.reason);
						},
						{ once: true },
					);
				}
				await aborted.promise;
				completedMutation = true;
				return credential;
			},
		});
		await authStorage.set("openai-codex", {
			type: "oauth",
			access: "expired",
			refresh: "refresh",
			expires: 0,
		});
		const row = authStorage.exportSnapshot().credentials[0];
		if (!row) throw new Error("expected stored OAuth credential");
		const controller = new AbortController();
		const refresh = authStorage.refreshCredentialById(row.id, controller.signal);
		controller.abort(new Error("test abort"));
		await expect(refresh).rejects.toThrow();
		expect(observedAbort).toBe(true);
		expect(completedMutation).toBe(false);
	});

	test("quarantines revoked OAuth and refreshes the healthy account", async () => {
		const disabledCauses: string[] = [];
		authStorage.close();
		authStorage = await AuthStorage.create(path.join(tempDir, "auth-revoked.db"), {
			refreshOAuthCredential: async (_provider, _id, credential): Promise<OAuthCredentials> => {
				if (credential.accountId === "revoked") {
					throw new OpenAICodexTerminalOAuthError("invalid_grant", "refresh token revoked");
				}
				return { ...credential, access: "healthy-fresh", expires: Date.now() + 60_000 };
			},
			onCredentialDisabled: event => {
				disabledCauses.push(event.disabledCause);
			},
		});
		await authStorage.set("openai-codex", [
			{ type: "oauth", access: "bad", refresh: "bad-refresh", expires: 0, accountId: "revoked" },
			{ type: "oauth", access: "good", refresh: "good-refresh", expires: 0, accountId: "healthy" },
		]);
		const registry = new ModelRegistry(authStorage, modelsPath, {
			fetch: async (_input, init) => {
				expect(new Headers(init?.headers).get("chatgpt-account-id")).toBe("healthy");
				return Response.json({ models: [{ slug: "healthy-model" }] });
			},
		});
		await registry.refreshProvider("openai-codex", "online");
		expect(registry.find("openai-codex", "healthy-model")).toBeDefined();
		const activeAccountIds = authStorage
			.exportSnapshot()
			.credentials.flatMap(entry => (entry.credential.type === "oauth" ? [entry.credential.accountId] : []));
		expect(activeAccountIds).toEqual(["healthy"]);
		expect(disabledCauses).toHaveLength(1);
		expect(disabledCauses[0]).toContain("revoked");
		expect(disabledCauses[0]).toContain("/login codex");
	});
});
