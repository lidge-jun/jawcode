/**
 * Local token auto-detection — reads credentials from locally installed CLI tools.
 * Read-only: never writes to external credential stores.
 */

import { execSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import type { OAuthCredentials } from "./types";

const SECURE_STORAGE_SERVICE = "Claude Code-credentials";
const XAI_AUTH_KEY_PREFIX = "https://auth.x.ai::";

function getCodexHome(): string {
	return process.env.CODEX_HOME ?? join(homedir(), ".codex");
}

export function detectCodexCliToken(): OAuthCredentials | null {
	const authPath = join(getCodexHome(), "auth.json");
	if (!existsSync(authPath)) return null;

	try {
		const raw = JSON.parse(readFileSync(authPath, "utf8"));
		const tokens = raw?.tokens;
		if (!tokens?.access_token || !tokens?.refresh_token) return null;

		const parts = tokens.access_token.split(".");
		let expiresMs = 0;
		if (parts.length === 3 && parts[1]) {
			try {
				const payload = JSON.parse(Buffer.from(parts[1], "base64url").toString());
				if (typeof payload.exp === "number") expiresMs = payload.exp * 1000;
			} catch {}
		}

		return {
			refresh: tokens.refresh_token,
			access: tokens.access_token,
			expires: expiresMs,
			accountId: tokens.account_id,
		};
	} catch {
		return null;
	}
}

function readFromSecureStorage(): string | null {
	try {
		if (process.platform === "darwin") {
			return execSync(`security find-generic-password -s "${SECURE_STORAGE_SERVICE}" -w`, {
				encoding: "utf8",
				timeout: 5000,
				stdio: ["pipe", "pipe", "pipe"],
			}).trim();
		}
		if (process.platform === "linux") {
			return execSync(`secret-tool lookup service "${SECURE_STORAGE_SERVICE}"`, {
				encoding: "utf8",
				timeout: 5000,
				stdio: ["pipe", "pipe", "pipe"],
			}).trim();
		}
		return null;
	} catch {
		return null;
	}
}

export function detectClaudeCodeToken(): OAuthCredentials | null {
	const raw = readFromSecureStorage();
	if (!raw) return null;

	try {
		const data = JSON.parse(raw);
		const oauth = data?.claudeAiOauth;
		if (!oauth?.accessToken || !oauth?.refreshToken) return null;

		return {
			refresh: oauth.refreshToken,
			access: oauth.accessToken,
			expires: oauth.expiresAt ?? 0,
		};
	} catch {
		return null;
	}
}

export function detectGrokCliToken(): OAuthCredentials | null {
	const authPath = join(homedir(), ".grok", "auth.json");
	if (!existsSync(authPath)) return null;

	try {
		const raw = JSON.parse(readFileSync(authPath, "utf8")) as Record<string, Record<string, unknown>>;

		const entry = Object.entries(raw).find(([key]) => key.startsWith(XAI_AUTH_KEY_PREFIX))?.[1];
		if (!entry?.key || !entry?.refresh_token) return null;

		const accessToken = entry.key as string;
		const refreshToken = entry.refresh_token as string;
		const expiresAt = entry.expires_at ? new Date(entry.expires_at as string).getTime() : 0;

		return {
			refresh: refreshToken,
			access: accessToken,
			expires: expiresAt,
			accountId: entry.user_id as string | undefined,
			email: entry.email as string | undefined,
		};
	} catch {
		return null;
	}
}
