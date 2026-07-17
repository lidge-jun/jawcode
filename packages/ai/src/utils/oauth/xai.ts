/** xAI OAuth device flow (Grok account login). */
import { type OAuthDeviceCodePollResult, pollOAuthDeviceCodeFlow } from "./device-code";
import { detectGrokCliToken } from "./local-token-detect";
import type { LocalTokenImportMode, OAuthController, OAuthCredentials } from "./types";

const XAI_OAUTH_ISSUER = "https://auth.x.ai";
export const XAI_OAUTH_DISCOVERY_URL = `${XAI_OAUTH_ISSUER}/.well-known/openid-configuration`;
export const XAI_OAUTH_DEVICE_CODE_URL = `${XAI_OAUTH_ISSUER}/oauth2/device/code`;
export const XAI_OAUTH_CLIENT_ID = "b1a00492-073a-47ea-816f-4c329264a828";
export const XAI_OAUTH_SCOPE = "openid profile email offline_access grok-cli:access api:access";
const XAI_OAUTH_REFRESH_SKEW_MS = 2 * 60 * 1000;
const TOKEN_REQUEST_TIMEOUT_MS = 30_000;

interface XaiDiscovery {
	deviceAuthorizationEndpoint: string;
	tokenEndpoint: string;
}

interface XaiDiscoveryPayload {
	device_authorization_endpoint?: unknown;
	token_endpoint?: unknown;
}

interface XaiDeviceAuthorizationPayload {
	device_code?: unknown;
	user_code?: unknown;
	verification_uri?: unknown;
	verification_uri_complete?: unknown;
	expires_in?: unknown;
	interval?: unknown;
}

interface XaiDeviceAuthorization {
	deviceCode: string;
	userCode: string;
	verificationUri: string;
	verificationUriComplete?: string;
	expiresInSeconds: number;
	intervalSeconds: number;
}

interface XaiTokenPayload {
	access_token?: unknown;
	refresh_token?: unknown;
	expires_in?: unknown;
	id_token?: unknown;
	error?: unknown;
	error_description?: unknown;
}

interface XaiJwtPayload {
	sub?: unknown;
	email?: unknown;
	[key: string]: unknown;
}

function requestSignal(signal: AbortSignal | undefined): AbortSignal {
	const timeoutSignal = AbortSignal.timeout(TOKEN_REQUEST_TIMEOUT_MS);
	return signal ? AbortSignal.any([signal, timeoutSignal]) : timeoutSignal;
}

function validateXaiEndpoint(rawUrl: string): string {
	const parsed = new URL(rawUrl);
	const host = parsed.hostname.toLowerCase();
	if (parsed.protocol !== "https:" || (host !== "x.ai" && !host.endsWith(".x.ai"))) {
		throw new Error(`xAI OAuth discovery returned an unexpected endpoint: ${rawUrl}`);
	}
	return parsed.toString();
}

async function readJson(response: Response, label: string): Promise<unknown> {
	try {
		return await response.json();
	} catch (error) {
		throw new Error(`${label} returned invalid JSON: ${error instanceof Error ? error.message : String(error)}`);
	}
}

export async function discoverXaiOAuthEndpoints(signal?: AbortSignal): Promise<XaiDiscovery> {
	const response = await fetch(XAI_OAUTH_DISCOVERY_URL, {
		headers: { Accept: "application/json" },
		signal: requestSignal(signal),
	});
	if (!response.ok) {
		throw new Error(`xAI OAuth discovery failed: ${response.status} ${await response.text()}`);
	}

	const payload = (await readJson(response, "xAI OAuth discovery")) as XaiDiscoveryPayload;
	if (typeof payload.token_endpoint !== "string") {
		throw new Error("xAI OAuth discovery response missing token endpoint");
	}
	const deviceAuthorizationEndpoint =
		typeof payload.device_authorization_endpoint === "string"
			? payload.device_authorization_endpoint
			: XAI_OAUTH_DEVICE_CODE_URL;

	return {
		deviceAuthorizationEndpoint: validateXaiEndpoint(deviceAuthorizationEndpoint),
		tokenEndpoint: validateXaiEndpoint(payload.token_endpoint),
	};
}

function decodeJwtPayload(token: string): XaiJwtPayload | undefined {
	const parts = token.split(".");
	const payload = parts[1];
	if (parts.length !== 3 || !payload) return undefined;
	try {
		return JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as XaiJwtPayload;
	} catch {
		return undefined;
	}
}

function getTokenIdentity(accessToken: string, idToken: string | undefined): { accountId?: string; email?: string } {
	const payload = (idToken ? decodeJwtPayload(idToken) : undefined) ?? decodeJwtPayload(accessToken);
	const accountId = typeof payload?.sub === "string" && payload.sub.length > 0 ? payload.sub : undefined;
	const email =
		typeof payload?.email === "string" && payload.email.length > 0 ? payload.email.toLowerCase() : undefined;
	return { accountId, email };
}

function credentialsFromTokenPayload(payload: XaiTokenPayload, refreshFallback = ""): OAuthCredentials {
	if (typeof payload.access_token !== "string" || payload.access_token.length === 0) {
		throw new Error("xAI token response did not include an access token");
	}
	const refresh =
		typeof payload.refresh_token === "string" && payload.refresh_token.length > 0
			? payload.refresh_token
			: refreshFallback;
	if (!refresh) throw new Error("xAI token response did not include a refresh token");
	const expiresIn =
		typeof payload.expires_in === "number" && Number.isFinite(payload.expires_in) ? payload.expires_in : 3600;
	const idToken = typeof payload.id_token === "string" ? payload.id_token : undefined;
	const { accountId, email } = getTokenIdentity(payload.access_token, idToken);
	return {
		refresh,
		access: payload.access_token,
		expires: Date.now() + expiresIn * 1000 - XAI_OAUTH_REFRESH_SKEW_MS,
		accountId,
		email,
	};
}

function parseDeviceAuthorization(payload: unknown): XaiDeviceAuthorization {
	if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
		throw new Error("xAI device authorization response was not a JSON object");
	}
	const value = payload as XaiDeviceAuthorizationPayload;
	const deviceCode = typeof value.device_code === "string" ? value.device_code.trim() : "";
	const userCode = typeof value.user_code === "string" ? value.user_code.trim() : "";
	const verificationUri = typeof value.verification_uri === "string" ? value.verification_uri.trim() : "";
	const verificationUriComplete =
		typeof value.verification_uri_complete === "string" ? value.verification_uri_complete.trim() : "";
	if (
		!deviceCode ||
		!userCode ||
		!verificationUri ||
		typeof value.expires_in !== "number" ||
		!Number.isFinite(value.expires_in) ||
		value.expires_in <= 0
	) {
		throw new Error("xAI device authorization response missing required fields");
	}
	const intervalSeconds =
		typeof value.interval === "number" && Number.isFinite(value.interval) && value.interval > 0 ? value.interval : 5;
	return {
		deviceCode,
		userCode,
		verificationUri: validateXaiEndpoint(verificationUri),
		verificationUriComplete: verificationUriComplete
			? validateXaiEndpoint(verificationUriComplete)
			: undefined,
		expiresInSeconds: value.expires_in,
		intervalSeconds,
	};
}

async function requestXaiDeviceAuthorization(
	endpoint: string,
	signal?: AbortSignal,
): Promise<XaiDeviceAuthorization> {
	const response = await fetch(endpoint, {
		method: "POST",
		headers: {
			Accept: "application/json",
			"Content-Type": "application/x-www-form-urlencoded",
		},
		body: new URLSearchParams({ client_id: XAI_OAUTH_CLIENT_ID, scope: XAI_OAUTH_SCOPE }),
		signal: requestSignal(signal),
	});
	if (!response.ok) {
		throw new Error(`xAI device authorization failed: ${response.status} ${await response.text()}`);
	}
	return parseDeviceAuthorization(await readJson(response, "xAI device authorization"));
}

async function pollXaiDeviceToken(
	tokenEndpoint: string,
	deviceCode: string,
	signal?: AbortSignal,
): Promise<OAuthDeviceCodePollResult<OAuthCredentials>> {
	const response = await fetch(tokenEndpoint, {
		method: "POST",
		headers: {
			Accept: "application/json",
			"Content-Type": "application/x-www-form-urlencoded",
		},
		body: new URLSearchParams({
			grant_type: "urn:ietf:params:oauth:grant-type:device_code",
			client_id: XAI_OAUTH_CLIENT_ID,
			device_code: deviceCode,
		}),
		signal: requestSignal(signal),
	});
	const payload = (await readJson(response, "xAI device token polling")) as XaiTokenPayload;
	if (response.ok) return { status: "complete", value: credentialsFromTokenPayload(payload) };

	const errorCode = typeof payload.error === "string" ? payload.error : "";
	if (errorCode === "authorization_pending") return { status: "pending" };
	if (errorCode === "slow_down") return { status: "slow_down" };
	const description = typeof payload.error_description === "string" ? payload.error_description : "";
	return {
		status: "failed",
		message: `xAI device token polling failed: ${description || errorCode || response.status}`,
	};
}

export async function loginXaiDeviceFlow(ctrl: OAuthController): Promise<OAuthCredentials> {
	const discovery = await discoverXaiOAuthEndpoints(ctrl.signal);
	const device = await requestXaiDeviceAuthorization(discovery.deviceAuthorizationEndpoint, ctrl.signal);
	ctrl.onAuth?.({
		url: device.verificationUriComplete ?? device.verificationUri,
		instructions: `Enter code: ${device.userCode}`,
	});
	ctrl.onProgress?.("Waiting for xAI device authorization...");

	return pollOAuthDeviceCodeFlow({
		poll: () => pollXaiDeviceToken(discovery.tokenEndpoint, device.deviceCode, ctrl.signal),
		intervalSeconds: device.intervalSeconds,
		expiresInSeconds: device.expiresInSeconds,
		signal: ctrl.signal,
	});
}

export async function loginXai(
	ctrl: OAuthController,
	opts?: { importLocal?: LocalTokenImportMode },
): Promise<OAuthCredentials> {
	const importLocal = opts?.importLocal ?? "off";
	if (importLocal !== "off") {
		const local = detectGrokCliToken();
		if (local) {
			ctrl.onProgress?.("Found Grok CLI token, importing automatically");
			if (local.expires >= Date.now() + 60_000) return local;
			try {
				return await refreshXaiToken(local.refresh, ctrl.signal);
			} catch (error) {
				if (importLocal === "only") {
					throw new Error(
						`Grok CLI token is expired and could not be refreshed: ${error instanceof Error ? error.message : String(error)}`,
					);
				}
			}
		} else if (importLocal === "only") {
			throw new Error("No Grok CLI token found at ~/.grok/auth.json. Run /login xai for device OAuth.");
		}
	}

	return loginXaiDeviceFlow(ctrl);
}

export async function refreshXaiToken(refreshToken: string, signal?: AbortSignal): Promise<OAuthCredentials> {
	if (!refreshToken) throw new Error("xAI credentials are expired and do not include a refresh token");
	const discovery = await discoverXaiOAuthEndpoints(signal);
	const response = await fetch(discovery.tokenEndpoint, {
		method: "POST",
		headers: {
			Accept: "application/json",
			"Content-Type": "application/x-www-form-urlencoded",
		},
		body: new URLSearchParams({
			grant_type: "refresh_token",
			client_id: XAI_OAUTH_CLIENT_ID,
			refresh_token: refreshToken,
		}),
		signal: requestSignal(signal),
	});
	if (!response.ok) throw new Error(`xAI token request failed: ${response.status} ${await response.text()}`);
	const payload = (await readJson(response, "xAI token request")) as XaiTokenPayload;
	return credentialsFromTokenPayload(payload, refreshToken);
}
