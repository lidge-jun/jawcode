export type OAuthCredentials = {
	refresh: string;
	access: string;
	expires: number;
	enterpriseUrl?: string;
	projectId?: string;
	email?: string;
	accountId?: string;
};

export type OAuthProvider =
	| "alibaba-coding-plan"
	| "anthropic"
	| "cerebras"
	| "cloudflare-ai-gateway"
	| "cursor"
	| "deepseek"
	| "fireworks"
	| "firepass"
	| "github-copilot"
	| "google-gemini-cli"
	| "google-antigravity"
	| "gitlab-duo"
	| "huggingface"
	| "kimi-code"
	| "kilo"
	| "kiro"
	| "kagi"
	| "litellm"
	| "lm-studio"
	| "minimax-code"
	| "minimax-code-cn"
	| "moonshot"
	| "nvidia"
	| "nanogpt"
	| "ollama"
	| "ollama-cloud"
	| "openai-codex"
	| "openai-codex-device"
	| "opencode-go"
	| "opencode-zen"
	| "parallel"
	| "perplexity"
	| "qianfan"
	| "qwen-portal"
	| "synthetic"
	| "tavily"
	| "together"
	| "venice"
	| "vercel-ai-gateway"
	| "vllm"
	| "xai"
	| "xiaomi"
	| "zenmux"
	| "zai";

export type OAuthProviderId = OAuthProvider | (string & {});

/**
 * How a login flow may use a locally detected CLI token (grok-cli, codex,
 * Claude Code keychain). "off" goes straight to the real OAuth flow,
 * "fallback" imports a local token when present and falls back to OAuth
 * otherwise (first-time login), "only" imports without any OAuth fallback
 * (explicit `/login <provider> local`).
 */
export type LocalTokenImportMode = "off" | "fallback" | "only";

export type OAuthPrompt = {
	message: string;
	placeholder?: string;
	allowEmpty?: boolean;
};

export type OAuthAuthInfo = {
	url: string;
	instructions?: string;
};

export interface OAuthProviderInfo {
	id: OAuthProviderId;
	name: string;
	available: boolean;
}

export interface OAuthController {
	onAuth?(info: OAuthAuthInfo): void;
	onProgress?(message: string): void;
	onManualCodeInput?(): Promise<string>;
	onPrompt?(prompt: OAuthPrompt): Promise<string>;
	signal?: AbortSignal;
}

export interface OAuthLoginCallbacks extends OAuthController {
	onAuth: (info: OAuthAuthInfo) => void;
	onPrompt: (prompt: OAuthPrompt) => Promise<string>;
}

export interface OAuthProviderInterface {
	readonly id: OAuthProviderId;
	readonly name: string;
	readonly sourceId?: string;
	login(callbacks: OAuthLoginCallbacks): Promise<OAuthCredentials | string>;
	refreshToken?(credentials: OAuthCredentials): Promise<OAuthCredentials>;
	getApiKey?(credentials: OAuthCredentials): string;
}
