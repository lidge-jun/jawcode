/**
 * A Perplexity OAuth session token must never reach the API-key endpoint.
 *
 * The OAuth bearer and the `PERPLEXITY_API_KEY` bearer are different
 * credentials for different hosts. Upstream shipped a leak where the OAuth
 * session JWT was also emitted as a direct `api.perplexity.ai` api-key config,
 * so a transport failure on the consumer ask endpoint fell through and sent
 * the session token to the direct API — whose 401 then masked the real error
 * (oh-my-pi #5315).
 *
 * JWC resolves exactly one credential and dispatches on its type, so the leak
 * is structurally absent. That is worth pinning: the property is enforced by
 * control flow, and control flow is easy to "improve" into a fallback.
 */
import { describe, expect, it } from "bun:test";

const PROVIDER_SOURCE = new URL("../../../src/web/search/providers/perplexity.ts", import.meta.url).pathname;

describe("perplexity credential isolation", () => {
	it("calls the api-key endpoint from exactly one site", async () => {
		const source = await Bun.file(PROVIDER_SOURCE).text();
		const callSites = source.split("\n").filter(line => line.includes("callPerplexityApi("));
		// One definition, one invocation. A second invocation would be a fallback
		// path, which is precisely how the upstream leak happened.
		const invocations = callSites.filter(line => !line.includes("async function"));

		expect(invocations).toHaveLength(1);
	});

	it("reaches the api-key endpoint only after the oauth and cookie branches return", async () => {
		const source = await Bun.file(PROVIDER_SOURCE).text();
		const oauthBranch = source.indexOf('if (auth.type === "oauth" || auth.type === "cookies")');
		const apiInvocation = source.indexOf("await callPerplexityApi(");

		expect(oauthBranch).toBeGreaterThan(-1);
		expect(apiInvocation).toBeGreaterThan(oauthBranch);

		// The oauth branch must RETURN rather than fall through, otherwise the
		// oauth token continues into the api-key request below it.
		const branchBody = source.slice(oauthBranch, apiInvocation);
		expect(branchBody).toContain("return applySourceLimit(");
	});

	it("never passes an oauth-typed credential into the api-key call", async () => {
		const source = await Bun.file(PROVIDER_SOURCE).text();
		const invocation = source.split("\n").find(line => line.includes("await callPerplexityApi("));

		// `auth.token` here is narrowed to the api_key branch by the early return
		// above; the assertion pins that it is the resolved credential rather than
		// a separately fetched oauth token.
		expect(invocation).toContain("auth.token");
		expect(invocation).not.toContain("oauth");
	});
});
