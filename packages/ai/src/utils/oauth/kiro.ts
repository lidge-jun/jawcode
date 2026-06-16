/**
 * Kiro login flow — reads credentials from kiro-cli SQLite database.
 *
 * Auth method: "social" (Google/GitHub via Kiro Desktop Auth refresh endpoint).
 * The kiro-cli manages the initial browser-based login; we piggyback off its stored tokens.
 *
 * Fallback: manual token paste if SQLite is unavailable.
 */
import { Database } from "bun:sqlite";
import { existsSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import type { OAuthController, OAuthCredentials } from "./types";

const KIRO_CLI_DB_PATHS = [
	join(homedir(), "Library", "Application Support", "kiro-cli", "data.sqlite3"),
	join(homedir(), ".kiro", "sso", "cache.db"),
];

const KIRO_REFRESH_URL = "https://prod.us-east-1.auth.desktop.kiro.dev/refreshToken";
const TOKEN_KEYS = ["kirocli:social:token", "kirocli:odic:token", "codewhisperer:odic:token"];

interface KiroCliToken {
	access_token: string;
	refresh_token: string;
	expires_at: string;
	provider?: string;
	profile_arn?: string;
}

function findKiroCliDb(): string | null {
	for (const p of KIRO_CLI_DB_PATHS) {
		if (existsSync(p)) return p;
	}
	return null;
}

function readKiroCliCredentials(): KiroCliToken | null {
	const dbPath = findKiroCliDb();
	if (!dbPath) return null;

	const db = new Database(dbPath, { readonly: true });
	try {
		for (const key of TOKEN_KEYS) {
			const row = db.query("SELECT value FROM auth_kv WHERE key = ?").get(key) as { value: string } | null;
			if (row) {
				return JSON.parse(row.value) as KiroCliToken;
			}
		}
		return null;
	} finally {
		db.close();
	}
}

export async function refreshKiroToken(refreshToken: string): Promise<OAuthCredentials> {
	const res = await fetch(KIRO_REFRESH_URL, {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({ refreshToken }),
		signal: AbortSignal.timeout(30_000),
	});

	if (!res.ok) {
		throw new Error(`Kiro token refresh failed: ${res.status}`);
	}

	const data = (await res.json()) as {
		accessToken?: string;
		refreshToken?: string;
		expiresIn?: number;
	};

	if (!data.accessToken) {
		throw new Error("Kiro refresh returned no accessToken");
	}

	return {
		access: data.accessToken,
		refresh: data.refreshToken ?? refreshToken,
		expires: Date.now() + (data.expiresIn ?? 3600) * 1000,
	};
}

export async function loginKiro(options: OAuthController): Promise<OAuthCredentials> {
	options.onProgress?.("Looking for kiro-cli credentials...");

	let cliToken: KiroCliToken | null = null;
	try {
		cliToken = readKiroCliCredentials();
	} catch (e) {
		options.onProgress?.(`kiro-cli SQLite read failed: ${e}`);
	}

	if (cliToken) {
		const expiresAt = new Date(cliToken.expires_at).getTime();
		const isExpired = Date.now() >= expiresAt;

		if (!isExpired) {
			options.onProgress?.("Found valid kiro-cli token");
			return {
				access: cliToken.access_token,
				refresh: cliToken.refresh_token,
				expires: expiresAt,
			};
		}

		if (cliToken.refresh_token) {
			options.onProgress?.("Token expired, refreshing...");
			return await refreshKiroToken(cliToken.refresh_token);
		}
	}

	// Fallback: manual paste
	if (!options.onPrompt) {
		throw new Error("Kiro login requires onPrompt callback");
	}

	options.onAuth?.({
		url: "https://kiro.dev",
		instructions: "Login via Kiro CLI first (`kiro login`), or paste your access token manually",
	});

	const token = await options.onPrompt({
		message: "Paste your Kiro access token (or run `kiro login` in terminal first, then retry)",
		placeholder: "aoaAAAA...",
	});

	if (options.signal?.aborted) {
		throw new Error("Login cancelled");
	}

	const trimmed = token.trim();
	if (!trimmed) {
		throw new Error("Access token is required");
	}

	return {
		access: trimmed,
		refresh: "",
		expires: Date.now() + 3600 * 1000,
	};
}
