import { describe, expect, it } from "bun:test";
import {
	type AuthCredential,
	type AuthCredentialStore,
	AuthStorage,
	type Model,
	type StoredAuthCredential,
	startAuthGateway,
} from "../src";

function makeStore(rows: StoredAuthCredential[] = []): AuthCredentialStore {
	const cache = new Map<string, { value: string; expiresAtSec: number }>();
	return {
		close() {},
		listAuthCredentials(provider?: string) {
			return provider ? rows.filter(row => row.provider === provider) : rows;
		},
		updateAuthCredential() {},
		deleteAuthCredential() {},
		tryDisableAuthCredentialIfMatches() {
			return false;
		},
		replaceAuthCredentialsForProvider(provider: string, credentials: AuthCredential[]) {
			return credentials.map((credential, index) => ({
				id: index + 1,
				provider,
				credential,
				disabledCause: null,
			}));
		},
		upsertAuthCredentialForProvider(provider: string, credential: AuthCredential) {
			return [{ id: rows.length + 1, provider, credential, disabledCause: null }];
		},
		deleteAuthCredentialsForProvider() {},
		getCache(key) {
			const entry = cache.get(key);
			if (!entry) return null;
			if (entry.expiresAtSec * 1000 <= Date.now()) return null;
			return entry.value;
		},
		setCache(key, value, expiresAtSec) {
			cache.set(key, { value, expiresAtSec });
		},
		cleanExpiredCache() {},
	};
}

function browserHeaders(extra?: Record<string, string>): Record<string, string> {
	return {
		Origin: "https://browser.example",
		...extra,
	};
}

describe("auth-gateway browser-origin guard", () => {
	it("allows preflight while requiring bearer auth for browser-origin routes", async () => {
		const storage = new AuthStorage(makeStore());
		await storage.reload();
		const model = {
			id: "jwc-test-model",
			name: "JWC Test Model",
			api: "openai-responses",
			provider: "openai",
			baseUrl: "https://api.openai.com/v1",
			reasoning: false,
			input: ["text"],
			cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
			contextWindow: 8192,
			maxTokens: 1024,
		} satisfies Model<"openai-responses">;
		const handle = startAuthGateway({
			storage,
			bind: "127.0.0.1:0",
			bearerTokens: ["secret"],
			version: "test",
			resolveModel: id => (id === model.id ? model : undefined),
			listModels: () => [model],
		});

		try {
			const preflight = await fetch(`${handle.url}/v1/responses`, {
				method: "OPTIONS",
				headers: browserHeaders({
					"Access-Control-Request-Method": "POST",
					"Access-Control-Request-Headers": "authorization, content-type",
				}),
			});
			expect(preflight.status).toBe(204);
			expect(preflight.headers.get("access-control-allow-origin")).toBe("*");
			expect(preflight.headers.get("access-control-allow-methods")).toContain("POST");

			const modelsWithoutAuth = await fetch(`${handle.url}/v1/models`, {
				headers: browserHeaders(),
			});
			expect(modelsWithoutAuth.status).toBe(401);
			expect(modelsWithoutAuth.headers.get("access-control-allow-origin")).toBe("*");
			expect(await modelsWithoutAuth.json()).toEqual({ error: "unauthorized" });

			const responsesWithoutAuth = await fetch(`${handle.url}/v1/responses`, {
				method: "POST",
				headers: browserHeaders({ "Content-Type": "application/json" }),
				body: JSON.stringify({ model: model.id, input: "hello" }),
			});
			expect(responsesWithoutAuth.status).toBe(401);
			expect(responsesWithoutAuth.headers.get("access-control-allow-origin")).toBe("*");
			expect(await responsesWithoutAuth.json()).toEqual({ error: "unauthorized" });

			const modelsWithAuth = await fetch(`${handle.url}/v1/models`, {
				headers: browserHeaders({ Authorization: "Bearer secret" }),
			});
			expect(modelsWithAuth.status).toBe(200);
			expect(modelsWithAuth.headers.get("access-control-allow-origin")).toBe("*");
			const body = (await modelsWithAuth.json()) as { data: Array<{ id: string; owned_by: string }> };
			expect(body.data).toEqual([
				expect.objectContaining({
					id: model.id,
					owned_by: "openai",
				}),
			]);
		} finally {
			await handle.close();
			storage.close();
		}
	});
});
