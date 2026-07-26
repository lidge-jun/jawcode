import { afterEach, beforeEach, describe, expect, spyOn, test } from "bun:test";
import * as fs from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";
import type { FetchImpl } from "@jawcode-dev/ai";
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

	test("quarantines revoked OAuth and refreshes the healthy account", async () => {
		authStorage.close();
		authStorage = await AuthStorage.create(path.join(tempDir, "auth-revoked.db"), {
			refreshOAuthCredential: async (_provider, _id, credential): Promise<OAuthCredentials> => {
				if (credential.accountId === "revoked") throw new Error("invalid_grant: revoked credential");
				return { ...credential, access: "healthy-fresh", expires: Date.now() + 60_000 };
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
	});
});
