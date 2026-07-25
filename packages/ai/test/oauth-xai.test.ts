import { afterEach, beforeEach, describe, expect, it, vi } from "bun:test";
import * as fs from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";

import { AuthStorage, SqliteAuthCredentialStore } from "../src/auth-storage";
import { getOAuthProviders, refreshOAuthToken } from "../src/utils/oauth";
import type { OAuthCredentials } from "../src/utils/oauth/types";
import {
	discoverXaiOAuthEndpoints,
	loginXaiDeviceFlow,
	XAI_OAUTH_CLIENT_ID,
	XAI_OAUTH_DEVICE_CODE_URL,
	XAI_OAUTH_DISCOVERY_URL,
	XAI_OAUTH_SCOPE,
} from "../src/utils/oauth/xai";
import { withEnv } from "./helpers";

const originalFetch = global.fetch;
const SUPPRESS_XAI_ENV = { XAI_API_KEY: undefined } as const;
const DEVICE_AUTHORIZATION_ENDPOINT = "https://auth.x.ai/oauth2/device/code";
const TOKEN_ENDPOINT = "https://auth.x.ai/oauth2/token";
const DEVICE_AUTHORIZATION = {
	device_code: "device-code-123",
	user_code: "ABCD-EFGH",
	verification_uri: "https://auth.x.ai/activate",
	verification_uri_complete: "https://auth.x.ai/activate?user_code=ABCD-EFGH",
	expires_in: 600,
	interval: 1,
} as const;

function jsonResponse(body: unknown, status = 200): Response {
	return new Response(JSON.stringify(body), {
		status,
		headers: { "Content-Type": "application/json" },
	});
}

function discoveryResponse(overrides: Record<string, unknown> = {}): Response {
	return jsonResponse({
		issuer: "https://auth.x.ai",
		device_authorization_endpoint: DEVICE_AUTHORIZATION_ENDPOINT,
		token_endpoint: TOKEN_ENDPOINT,
		...overrides,
	});
}

function tokenResponse(accessToken: string, refreshToken: string, accountId: string, email: string): Response {
	return jsonResponse({
		access_token: accessToken,
		refresh_token: refreshToken,
		id_token: jwt({ sub: accountId, email }),
		expires_in: 3600,
		token_type: "Bearer",
	});
}

function jwt(payload: Record<string, unknown>): string {
	const encode = (value: unknown) => Buffer.from(JSON.stringify(value)).toString("base64url");
	return `${encode({ alg: "none", typ: "JWT" })}.${encode(payload)}.`;
}

function requestUrl(input: string | URL | Request): string {
	return typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
}

function requestForm(init: RequestInit | undefined): URLSearchParams {
	const body = init?.body;
	if (!(body instanceof URLSearchParams)) throw new Error("Expected URLSearchParams request body");
	return body;
}

describe("xAI OAuth login provider", () => {
	let tempDir = "";
	let store: SqliteAuthCredentialStore | undefined;
	let authStorage: AuthStorage | undefined;

	beforeEach(async () => {
		tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "pi-ai-xai-oauth-"));
		store = await SqliteAuthCredentialStore.open(path.join(tempDir, "agent.db"));
		authStorage = new AuthStorage(store);
	});

	afterEach(async () => {
		global.fetch = originalFetch;
		vi.restoreAllMocks();
		store?.close();
		store = undefined;
		authStorage = undefined;
		if (tempDir) {
			await fs.rm(tempDir, { recursive: true, force: true });
			tempDir = "";
		}
	});

	it("registers xAI as an available login provider", () => {
		expect(getOAuthProviders().find(provider => provider.id === "xai")).toEqual({
			id: "xai",
			name: "xAI",
			available: true,
		});
	});

	it("discovers and pins xAI device/token endpoints to x.ai", async () => {
		const fetchMock = vi.fn(async () => discoveryResponse());
		global.fetch = fetchMock as unknown as typeof fetch;

		await expect(discoverXaiOAuthEndpoints()).resolves.toEqual({
			deviceAuthorizationEndpoint: DEVICE_AUTHORIZATION_ENDPOINT,
			tokenEndpoint: TOKEN_ENDPOINT,
		});
		expect(fetchMock).toHaveBeenCalledWith(XAI_OAUTH_DISCOVERY_URL, expect.any(Object));
	});

	it("rejects OAuth discovery endpoints outside x.ai", async () => {
		global.fetch = vi.fn(async () =>
			discoveryResponse({ token_endpoint: "https://evil.example/oauth2/token" }),
		) as unknown as typeof fetch;

		await expect(discoverXaiOAuthEndpoints()).rejects.toThrow(/unexpected endpoint/i);
	});

	it("performs device login without callback or pasted-code stages", async () => {
		const sleepSpy = vi.spyOn(Bun, "sleep").mockResolvedValue(undefined);
		const serveSpy = vi.spyOn(Bun, "serve");
		const tokenResponses = [
			jsonResponse({ error: "authorization_pending" }, 400),
			jsonResponse({ error: "slow_down" }, 400),
			tokenResponse("access-device", "refresh-device", "account-device", "Device@Example.com"),
		];
		const requests: Array<{ url: string; init?: RequestInit }> = [];
		const fetchMock = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
			const url = requestUrl(input);
			requests.push({ url, init });
			if (url === XAI_OAUTH_DISCOVERY_URL) return discoveryResponse();
			if (url === DEVICE_AUTHORIZATION_ENDPOINT) return jsonResponse(DEVICE_AUTHORIZATION);
			if (url === TOKEN_ENDPOINT) {
				const response = tokenResponses.shift();
				if (!response) throw new Error("Unexpected token poll");
				return response;
			}
			throw new Error(`Unexpected fetch: ${url}`);
		});
		global.fetch = fetchMock as unknown as typeof fetch;
		const authEvents: Array<{ url: string; instructions?: string }> = [];
		const progress: string[] = [];
		const onManualCodeInput = vi.fn(async () => "legacy-code");

		const credentials = await loginXaiDeviceFlow({
			onAuth: info => authEvents.push(info),
			onProgress: message => progress.push(message),
			onManualCodeInput,
		});

		expect(serveSpy).not.toHaveBeenCalled();
		expect(onManualCodeInput).not.toHaveBeenCalled();
		expect(authEvents).toEqual([
			{
				url: DEVICE_AUTHORIZATION.verification_uri_complete,
				instructions: `Enter code: ${DEVICE_AUTHORIZATION.user_code}`,
			},
		]);
		expect(progress).toEqual(["Waiting for xAI device authorization..."]);
		expect(sleepSpy.mock.calls).toEqual([[1000], [6000]]);
		expect(credentials).toMatchObject({
			access: "access-device",
			refresh: "refresh-device",
			accountId: "account-device",
			email: "device@example.com",
		});

		const deviceRequest = requests.find(request => request.url === DEVICE_AUTHORIZATION_ENDPOINT);
		expect(Object.fromEntries(requestForm(deviceRequest?.init))).toEqual({
			client_id: XAI_OAUTH_CLIENT_ID,
			scope: XAI_OAUTH_SCOPE,
		});
		const tokenRequests = requests.filter(request => request.url === TOKEN_ENDPOINT);
		expect(tokenRequests).toHaveLength(3);
		expect(Object.fromEntries(requestForm(tokenRequests[0]?.init))).toEqual({
			grant_type: "urn:ietf:params:oauth:grant-type:device_code",
			client_id: XAI_OAUTH_CLIENT_ID,
			device_code: DEVICE_AUTHORIZATION.device_code,
		});
	});

	it("stores device-flow credentials as refreshable OAuth credentials", async () => {
		if (!store || !authStorage) throw new Error("test setup failed");
		global.fetch = vi.fn(async (input: string | URL | Request) => {
			const url = requestUrl(input);
			if (url === XAI_OAUTH_DISCOVERY_URL) return discoveryResponse();
			if (url === DEVICE_AUTHORIZATION_ENDPOINT) return jsonResponse(DEVICE_AUTHORIZATION);
			if (url === TOKEN_ENDPOINT) {
				return tokenResponse("access-login", "refresh-login", "account-login", "login@example.com");
			}
			throw new Error(`Unexpected fetch: ${url}`);
		}) as unknown as typeof fetch;
		await authStorage.set("xai", { type: "api_key", key: "legacy-api-key" });

		await authStorage.login("xai", {
			onAuth: () => {},
			onPrompt: async () => "",
			onManualCodeInput: async () => {
				throw new Error("manual code input must not be requested");
			},
		});

		const credentials = store.listAuthCredentials("xai");
		expect(credentials).toHaveLength(1);
		expect(credentials[0]?.credential).toMatchObject({
			type: "oauth",
			access: "access-login",
			refresh: "refresh-login",
			accountId: "account-login",
			email: "login@example.com",
		});
		await withEnv(SUPPRESS_XAI_ENV, async () => {
			expect(await authStorage?.getApiKey("xai", "session-xai-login")).toBe("access-login");
		});
	});

	it("refreshes expired xAI OAuth credentials with the refresh token", async () => {
		let tokenBody: URLSearchParams | undefined;
		global.fetch = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
			const url = requestUrl(input);
			if (url === XAI_OAUTH_DISCOVERY_URL) return discoveryResponse();
			if (url === TOKEN_ENDPOINT) {
				tokenBody = requestForm(init);
				return tokenResponse("access-rotated", "refresh-rotated", "account-rotated", "rotated@example.com");
			}
			throw new Error(`Unexpected fetch: ${url}`);
		}) as unknown as typeof fetch;
		const credentials: OAuthCredentials = {
			access: "access-old",
			refresh: "refresh-old",
			expires: Date.now() - 60_000,
		};

		const refreshed = await refreshOAuthToken("xai", credentials);

		expect(tokenBody?.get("grant_type")).toBe("refresh_token");
		expect(tokenBody?.get("client_id")).toBe(XAI_OAUTH_CLIENT_ID);
		expect(tokenBody?.get("refresh_token")).toBe("refresh-old");
		expect(refreshed).toMatchObject({
			access: "access-rotated",
			refresh: "refresh-rotated",
			accountId: "account-rotated",
			email: "rotated@example.com",
		});
	});

	it("uses the official device endpoint when discovery omits it", async () => {
		global.fetch = vi.fn(async () =>
			discoveryResponse({ device_authorization_endpoint: undefined }),
		) as unknown as typeof fetch;

		await expect(discoverXaiOAuthEndpoints()).resolves.toMatchObject({
			deviceAuthorizationEndpoint: XAI_OAUTH_DEVICE_CODE_URL,
		});
	});
});
