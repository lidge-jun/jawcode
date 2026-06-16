/**
 * xAI (Grok) subscription usage via the grok-cli chat proxy billing endpoint.
 *
 * xAI exposes no quota endpoint on `api.x.ai` — subscription credit usage is
 * only served by `cli-chat-proxy.grok.com` (the grok-cli backend), which
 * accepts the same `auth.x.ai` OAuth access token used for inference.
 * Amounts are reported in cents and normalized to USD here.
 */
import type {
	UsageAmount,
	UsageFetchContext,
	UsageFetchParams,
	UsageLimit,
	UsageProvider,
	UsageReport,
	UsageStatus,
	UsageWindow,
} from "../usage";
import { isRecord, toNumber } from "../utils";

const DEFAULT_ENDPOINT = "https://cli-chat-proxy.grok.com/v1";
const BILLING_PATH = "/billing";
const USER_PATH = "/user";

function normalizeXaiBaseUrl(baseUrl?: string): string {
	if (!baseUrl?.trim()) return DEFAULT_ENDPOINT;
	return baseUrl.trim().replace(/\/+$/, "");
}

interface XaiBillingConfig {
	monthlyLimitCents?: number;
	usedCents?: number;
	onDemandCapCents?: number;
	billingPeriodStart?: number;
	billingPeriodEnd?: number;
}

function parseCents(value: unknown): number | undefined {
	if (!isRecord(value)) return undefined;
	return toNumber(value.val);
}

function parseEpochMs(value: unknown): number | undefined {
	if (typeof value !== "string" || value.length === 0) return undefined;
	const parsed = Date.parse(value);
	return Number.isFinite(parsed) ? parsed : undefined;
}

function parseBillingConfig(payload: unknown): XaiBillingConfig | null {
	if (!isRecord(payload) || !isRecord(payload.config)) return null;
	const config = payload.config;
	const monthlyLimitCents = parseCents(config.monthlyLimit);
	const usedCents = parseCents(config.used);
	if (monthlyLimitCents === undefined || usedCents === undefined) return null;
	return {
		monthlyLimitCents,
		usedCents,
		onDemandCapCents: parseCents(config.onDemandCap),
		billingPeriodStart: parseEpochMs(config.billingPeriodStart),
		billingPeriodEnd: parseEpochMs(config.billingPeriodEnd),
	};
}

/** Subscription tier inferred from the monthly credit limit (cents). */
function tierFromLimit(limitCents: number): string {
	if (limitCents >= 150_000) return "SuperGrok Heavy";
	if (limitCents >= 15_000) return "SuperGrok";
	return "Grok";
}

function buildUsageStatus(usedFraction: number | undefined): UsageStatus | undefined {
	if (usedFraction === undefined) return undefined;
	if (usedFraction >= 1) return "exhausted";
	if (usedFraction >= 0.9) return "warning";
	return "ok";
}

function buildMonthlyLimit(config: XaiBillingConfig): UsageLimit | null {
	const limitUsd = (config.monthlyLimitCents ?? 0) / 100;
	const usedUsd = (config.usedCents ?? 0) / 100;
	if (!(limitUsd > 0)) return null;

	const usedFraction = Math.min(Math.max(usedUsd / limitUsd, 0), 1);
	const amount: UsageAmount = {
		used: usedUsd,
		limit: limitUsd,
		remaining: Math.max(limitUsd - usedUsd, 0),
		usedFraction,
		remainingFraction: Math.max(1 - usedFraction, 0),
		unit: "usd",
	};
	const window: UsageWindow = {
		id: "monthly",
		label: "Monthly",
		...(config.billingPeriodStart !== undefined && config.billingPeriodEnd !== undefined
			? { durationMs: config.billingPeriodEnd - config.billingPeriodStart }
			: {}),
		...(config.billingPeriodEnd !== undefined ? { resetsAt: config.billingPeriodEnd } : {}),
	};
	return {
		id: "xai:monthly",
		label: "Grok Monthly Credits",
		scope: {
			provider: "xai",
			windowId: window.id,
			tier: tierFromLimit(config.monthlyLimitCents ?? 0),
			shared: true,
		},
		window,
		amount,
		status: buildUsageStatus(usedFraction),
	};
}

async function fetchProfileIdentity(
	baseUrl: string,
	headers: Record<string, string>,
	ctx: UsageFetchContext,
	signal?: AbortSignal,
): Promise<{ accountId?: string; email?: string }> {
	try {
		const response = await ctx.fetch(`${baseUrl}${USER_PATH}`, { headers, signal });
		if (!response.ok) return {};
		const payload = (await response.json()) as unknown;
		if (!isRecord(payload)) return {};
		return {
			accountId: typeof payload.userId === "string" && payload.userId.length > 0 ? payload.userId : undefined,
			email: typeof payload.email === "string" && payload.email.length > 0 ? payload.email : undefined,
		};
	} catch (error) {
		ctx.logger?.debug("xAI user profile fetch failed", { error: String(error) });
		return {};
	}
}

async function fetchXaiUsage(params: UsageFetchParams, ctx: UsageFetchContext): Promise<UsageReport | null> {
	if (params.provider !== "xai") return null;
	const credential = params.credential;
	if (credential.type !== "oauth" || !credential.accessToken) return null;

	const baseUrl = normalizeXaiBaseUrl(params.baseUrl);
	const url = `${baseUrl}${BILLING_PATH}`;
	const headers: Record<string, string> = {
		accept: "application/json",
		authorization: `Bearer ${credential.accessToken}`,
	};

	let payload: unknown;
	try {
		const response = await ctx.fetch(url, { headers, signal: params.signal });
		if (!response.ok) {
			ctx.logger?.warn("xAI usage fetch failed", { status: response.status, statusText: response.statusText });
			return null;
		}
		payload = (await response.json()) as unknown;
	} catch (error) {
		ctx.logger?.warn("xAI usage fetch error", { error: String(error) });
		return null;
	}

	const config = parseBillingConfig(payload);
	if (!config) {
		ctx.logger?.warn("xAI usage response missing billing config");
		return null;
	}

	const monthly = buildMonthlyLimit(config);
	if (!monthly) return null;

	let accountId = credential.accountId;
	let email = credential.email;
	if ((!accountId || !email) && !params.signal?.aborted) {
		const identity = await fetchProfileIdentity(baseUrl, headers, ctx, params.signal);
		accountId = accountId ?? identity.accountId;
		email = email ?? identity.email;
	}

	return {
		provider: params.provider,
		fetchedAt: Date.now(),
		limits: [monthly],
		metadata: {
			endpoint: url,
			tier: monthly.scope.tier,
			...(accountId ? { accountId } : {}),
			...(email ? { email } : {}),
			...(config.onDemandCapCents !== undefined ? { onDemandCapUsd: config.onDemandCapCents / 100 } : {}),
		},
		raw: payload,
	};
}

export const xaiUsageProvider: UsageProvider = {
	id: "xai",
	fetchUsage: fetchXaiUsage,
	supports: params => params.provider === "xai" && params.credential.type === "oauth",
};
