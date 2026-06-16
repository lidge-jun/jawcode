/**
 * xAI OAuth exposure policy (99.30.04 S4). On the OAuth/subscription path
 * (JWT access token) only progrok's canonical chat set is listed; everything
 * else the discovery returns is tagged unlisted. Platform API keys (xai-…)
 * keep the unfiltered behavior. Allowlist live-verified 260613 on
 * /v1/chat/completions (multi-agent excluded — Responses-only, 400).
 */
import { afterEach, describe, expect, it } from "bun:test";
import { xaiModelManagerOptions } from "../src/provider-models/openai-compat";

const FAKE_JWT = "eyJhbGciOiJFUzI1NiJ9.eyJzdWIiOiJ0ZXN0In0.sig";

const originalFetch = global.fetch;

afterEach(() => {
	global.fetch = originalFetch;
});

function mockModelsEndpoint(ids: string[]): void {
	global.fetch = (async () =>
		new Response(JSON.stringify({ data: ids.map(id => ({ id, object: "model" })) }), {
			status: 200,
			headers: { "Content-Type": "application/json" },
		})) as unknown as typeof fetch;
}

describe("xai OAuth model exposure", () => {
	it("lists the progrok canonical set and tags the rest unlisted", async () => {
		mockModelsEndpoint(["grok-4.3", "grok-4.20-0309-reasoning", "grok-2", "grok-3-mini", "grok-4-1-fast"]);
		const options = xaiModelManagerOptions({ apiKey: FAKE_JWT });
		expect(options.markUnlistedOutsideDynamic).toBe(true);
		const models = await options.fetchDynamicModels?.();
		const byId = new Map(models?.map(model => [model.id, model]) ?? []);
		expect(byId.get("grok-4.3")?.unlisted).toBeUndefined();
		expect(byId.get("grok-4.20-0309-reasoning")?.unlisted).toBeUndefined();
		expect(byId.get("grok-2")?.unlisted).toBe(true);
		expect(byId.get("grok-3-mini")?.unlisted).toBe(true);
		expect(byId.get("grok-4-1-fast")?.unlisted).toBe(true);
	});

	it("keeps platform API keys unfiltered", async () => {
		mockModelsEndpoint(["grok-4.3", "grok-2"]);
		const options = xaiModelManagerOptions({ apiKey: "xai-platform-key" });
		expect(options.markUnlistedOutsideDynamic).toBeUndefined();
		const models = await options.fetchDynamicModels?.();
		expect(models?.every(model => model.unlisted === undefined)).toBe(true);
	});
});

describe("xai composer injection", () => {
	it("injects grok-composer-2.5-fast when discovery omits it (hidden on the wire)", async () => {
		mockModelsEndpoint(["grok-4.3", "grok-2"]);
		const options = xaiModelManagerOptions({ apiKey: FAKE_JWT });
		const models = await options.fetchDynamicModels?.();
		const composer = models?.find(model => model.id === "grok-composer-2.5-fast");
		expect(composer).toBeDefined();
		expect(composer?.unlisted).toBeUndefined();
		expect(composer?.reasoning).toBe(false);
	});

	it("does not inject on the platform API key path", async () => {
		mockModelsEndpoint(["grok-4.3"]);
		const options = xaiModelManagerOptions({ apiKey: "xai-platform-key" });
		const models = await options.fetchDynamicModels?.();
		expect(models?.some(model => model.id === "grok-composer-2.5-fast")).toBe(false);
	});
});
