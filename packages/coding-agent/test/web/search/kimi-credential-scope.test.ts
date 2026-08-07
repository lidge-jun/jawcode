/**
 * Kimi web search must use Kimi Code credentials, not Moonshot Open Platform.
 *
 * The adapter posts to `api.kimi.com/coding/v1/search`. That is a different
 * credential system from the Moonshot Open Platform (`api.moonshot.ai`,
 * `MOONSHOT_API_KEY`). Resolving a `moonshot` key here sent a perfectly valid
 * Open Platform key to an endpoint that rejects it with 401 — and since a
 * provider failure demotes the engine, the user's *preferred* search provider
 * silently fell back to another one.
 *
 * `isAvailable()` has to agree with `findApiKey()`: advertising availability on
 * a credential the request cannot use makes the provider selectable and then
 * guarantees the 401.
 */
import { describe, expect, it } from "bun:test";
import type { AuthStorage } from "@jawcode-dev/coding-agent/session/auth-storage";
import { KimiProvider } from "@jawcode-dev/coding-agent/web/search/providers/kimi";

/** Minimal AuthStorage surface `isAvailable` touches. */
function authWith(providers: string[]): AuthStorage {
	return { hasAuth: (provider: string) => providers.includes(provider) } as unknown as AuthStorage;
}

const provider = new KimiProvider();

describe("kimi search credential scope", () => {
	it("is available with a Kimi Code credential", () => {
		expect(provider.isAvailable(authWith(["kimi-code"]))).toBe(true);
	});

	it("is NOT available with only a Moonshot Open Platform credential", () => {
		// The regression: this used to report true, so the provider was chosen
		// and then failed with 401 against api.kimi.com.
		expect(provider.isAvailable(authWith(["moonshot"]))).toBe(false);
	});

	it("is not available with no credential at all", () => {
		expect(provider.isAvailable(authWith([]))).toBe(false);
	});

	it("resolves only kimi-code from storage", async () => {
		const source = await Bun.file(
			new URL("../../../src/web/search/providers/kimi.ts", import.meta.url).pathname,
		).text();
		const storageLookups = source
			.split("\n")
			.filter(line => line.includes("authStorage.getApiKey("))
			.map(line => line.trim());

		expect(storageLookups).toEqual([
			'return (await authStorage.getApiKey("kimi-code", sessionId, { signal })) ?? null;',
		]);
	});

	it("names the Kimi Code requirement in the missing-credential error", async () => {
		const source = await Bun.file(
			new URL("../../../src/web/search/providers/kimi.ts", import.meta.url).pathname,
		).text();

		expect(source).toContain("needs a Kimi Code credential");
		// The old message told the user to run a `gjc` command, which does not
		// exist in this fork.
		expect(source).not.toContain("gjc /login");
	});
});
