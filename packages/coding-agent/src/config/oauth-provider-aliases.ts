import { getOAuthProviders } from "@gajae-code/ai/utils/oauth";

const OAUTH_PROVIDER_ALIASES: Record<string, string> = {
	claude: "anthropic",
	codex: "openai-codex",
	chatgpt: "openai-codex",
	openai: "openai-codex",
	grok: "xai",
	gemini: "google-gemini-cli",
	google: "google-gemini-cli",
	antigravity: "google-antigravity",
	kimi: "kimi-code",
	copilot: "github-copilot",
	qwen: "qwen-portal",
	cloudflare: "cloudflare-ai-gateway",
	vercel: "vercel-ai-gateway",
	alibaba: "alibaba-coding-plan",
	device: "openai-codex-device",
	glm: "zai",
	"z.ai": "zai",
	minimax: "minimax-code",
	"minimax-cn": "minimax-code-cn",
	zen: "opencode-zen",
	cf: "cloudflare-ai-gateway",
};

export function resolveOAuthProviderId(input: string): string | undefined {
	const trimmed = input.trim();
	if (!trimmed) return undefined;

	const providers = getOAuthProviders();
	const exact = providers.find(provider => provider.id === trimmed);
	if (exact) return exact.id;

	const normalized = trimmed.toLowerCase();
	const normalizedExact = providers.find(provider => provider.id === normalized);
	if (normalizedExact) return normalizedExact.id;

	const alias = OAUTH_PROVIDER_ALIASES[normalized];
	if (alias && providers.some(provider => provider.id === alias)) return alias;

	const suffixMatches = providers.filter(provider => {
		const id = provider.id;
		return id.endsWith(`-${normalized}`) || id.startsWith(`${normalized}-`);
	});
	if (suffixMatches.length === 1) return suffixMatches[0].id;

	return undefined;
}
