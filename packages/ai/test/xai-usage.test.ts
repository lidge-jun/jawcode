/**
 * xAI (Grok) billing usage parser regressions. The billing endpoint lives on
 * `cli-chat-proxy.grok.com` (NOT `api.x.ai`, which has no quota routes) and
 * reports credit amounts in cents — the provider must normalize to USD.
 */
import { describe, expect, it } from "bun:test";
import type { UsageFetchContext } from "../src/usage";
import { xaiUsageProvider } from "../src/usage/xai";

function makeBillingPayload(overrides: Record<string, unknown> = {}) {
	return {
		config: {
			monthlyLimit: { val: 150_000 },
			used: { val: 38_637 },
			onDemandCap: { val: 0 },
			billingPeriodStart: "2026-06-01T00:00:00+00:00",
			billingPeriodEnd: "2026-07-01T00:00:00+00:00",
			history: [],
			...overrides,
		},
	};
}

function makeCtx(handler: (input: string, init?: RequestInit) => Response): {
	ctx: UsageFetchContext;
	calls: Array<{ input: string; init?: RequestInit }>;
} {
	const calls: Array<{ input: string; init?: RequestInit }> = [];
	const fetchMock = (async (input: string | URL, init?: RequestInit) => {
		calls.push({ input: String(input), init });
		return handler(String(input), init);
	}) as unknown as typeof fetch;
	return { ctx: { fetch: fetchMock }, calls };
}

const oauthCredential = {
	type: "oauth" as const,
	accessToken: "xai-test-access-token",
	accountId: "account-123",
	email: "user@example.com",
};

describe("xai usage provider", () => {
	it("parses billing config into a monthly USD limit", async () => {
		const { ctx, calls } = makeCtx(() => new Response(JSON.stringify(makeBillingPayload()), { status: 200 }));

		const report = await xaiUsageProvider.fetchUsage({ provider: "xai", credential: oauthCredential }, ctx);

		expect(report).not.toBeNull();
		expect(calls).toHaveLength(1);
		expect(calls[0]?.input).toBe("https://cli-chat-proxy.grok.com/v1/billing");

		const headers = calls[0]?.init?.headers as Record<string, string>;
		expect(headers.authorization).toBe("Bearer xai-test-access-token");

		const limit = report?.limits[0];
		expect(limit?.id).toBe("xai:monthly");
		expect(limit?.amount.unit).toBe("usd");
		expect(limit?.amount.limit).toBe(1500);
		expect(limit?.amount.used).toBeCloseTo(386.37);
		expect(limit?.amount.remaining).toBeCloseTo(1113.63);
		expect(limit?.amount.usedFraction).toBeCloseTo(0.25758);
		expect(limit?.status).toBe("ok");
		expect(limit?.scope.tier).toBe("SuperGrok Heavy");
		expect(limit?.window?.resetsAt).toBe(Date.parse("2026-07-01T00:00:00+00:00"));
		expect(report?.metadata?.email).toBe("user@example.com");
	});

	it("flags warning and exhausted statuses from used fraction", async () => {
		const warning = makeBillingPayload({ monthlyLimit: { val: 15_000 }, used: { val: 14_000 } });
		const { ctx } = makeCtx(() => new Response(JSON.stringify(warning), { status: 200 }));
		const report = await xaiUsageProvider.fetchUsage({ provider: "xai", credential: oauthCredential }, ctx);
		expect(report?.limits[0]?.status).toBe("warning");
		expect(report?.limits[0]?.scope.tier).toBe("SuperGrok");

		const exhausted = makeBillingPayload({ monthlyLimit: { val: 15_000 }, used: { val: 15_000 } });
		const { ctx: ctx2 } = makeCtx(() => new Response(JSON.stringify(exhausted), { status: 200 }));
		const report2 = await xaiUsageProvider.fetchUsage({ provider: "xai", credential: oauthCredential }, ctx2);
		expect(report2?.limits[0]?.status).toBe("exhausted");
	});

	it("falls back to the user endpoint when credential identity is missing", async () => {
		const { ctx, calls } = makeCtx(input => {
			if (input.endsWith("/billing")) {
				return new Response(JSON.stringify(makeBillingPayload()), { status: 200 });
			}
			return new Response(JSON.stringify({ userId: "account-from-api", email: "api@example.com" }), {
				status: 200,
			});
		});

		const report = await xaiUsageProvider.fetchUsage(
			{ provider: "xai", credential: { type: "oauth", accessToken: "xai-test-access-token" } },
			ctx,
		);

		expect(calls.map(c => c.input)).toEqual([
			"https://cli-chat-proxy.grok.com/v1/billing",
			"https://cli-chat-proxy.grok.com/v1/user",
		]);
		expect(report?.metadata?.accountId).toBe("account-from-api");
		expect(report?.metadata?.email).toBe("api@example.com");
	});

	it("returns null for non-oauth credentials, http errors, and malformed payloads", async () => {
		const { ctx } = makeCtx(() => new Response(JSON.stringify(makeBillingPayload()), { status: 200 }));
		expect(
			await xaiUsageProvider.fetchUsage({ provider: "xai", credential: { type: "api_key", apiKey: "k" } }, ctx),
		).toBeNull();
		expect(xaiUsageProvider.supports?.({ provider: "xai", credential: { type: "api_key", apiKey: "k" } })).toBe(
			false,
		);

		const { ctx: errCtx } = makeCtx(() => new Response("nope", { status: 500 }));
		expect(await xaiUsageProvider.fetchUsage({ provider: "xai", credential: oauthCredential }, errCtx)).toBeNull();

		const { ctx: badCtx } = makeCtx(() => new Response(JSON.stringify({ config: {} }), { status: 200 }));
		expect(await xaiUsageProvider.fetchUsage({ provider: "xai", credential: oauthCredential }, badCtx)).toBeNull();
	});
});
