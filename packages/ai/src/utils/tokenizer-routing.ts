export type TokenizerFamily =
	| "o200k_base"
	| "cl100k_base"
	| "claude"
	| "claude_v2"
	| "gemma"
	| "llama3"
	| "deepseek"
	| "mistral"
	| "glm"
	| "cohere";

const CLAUDE_V2_MARKERS = [
	"claude-opus-4-7",
	"claude-opus-4-8",
	"claude-fable",
	"claude-mythos",
	"anthropic.claude-opus-4-7",
	"anthropic.claude-opus-4-8",
	"anthropic.claude-fable",
	"anthropic.claude-mythos",
];

function isClaudeV2(modelId: string): boolean {
	const lower = modelId.toLowerCase();
	return CLAUDE_V2_MARKERS.some(m => lower.includes(m));
}

const PROVIDER_TO_FAMILY: Record<string, TokenizerFamily> = {
	anthropic: "claude",

	openai: "o200k_base",
	"openai-codex": "o200k_base",
	"azure-openai": "o200k_base",
	xai: "o200k_base",
	cursor: "o200k_base",
	"github-copilot": "o200k_base",

	google: "gemma",
	"google-gemini-cli": "gemma",
	"google-antigravity": "gemma",

	groq: "llama3",
	fireworks: "llama3",
	together: "llama3",
	cerebras: "llama3",

	deepseek: "deepseek",
	mistral: "mistral",
	minimax: "glm",
	"minimax-code": "glm",
	"minimax-code-cn": "glm",
	cohere: "cohere",

	"qwen-portal": "o200k_base",
	"alibaba-coding-plan": "o200k_base",
};

export function resolveTokenizerFamily(model: { provider: string; id: string }): TokenizerFamily {
	if (model.provider === "amazon-bedrock") {
		if (model.id.startsWith("cohere.")) return "cohere";
		if (model.id.startsWith("deepseek.")) return "deepseek";
		if (model.id.startsWith("meta.") || model.id.includes("llama")) return "llama3";
		if (model.id.startsWith("mistral.")) return "mistral";
		if (model.id.startsWith("anthropic.") || model.id.includes("claude")) {
			return isClaudeV2(model.id) ? "claude_v2" : "claude";
		}
		return "o200k_base";
	}

	if (model.provider === "google-vertex") {
		if (model.id.includes("gemini") || model.id.includes("gemma")) return "gemma";
		if (model.id.includes("claude")) {
			return isClaudeV2(model.id) ? "claude_v2" : "claude";
		}
		return "gemma";
	}

	const base = PROVIDER_TO_FAMILY[model.provider];
	if (base === "claude") {
		return isClaudeV2(model.id) ? "claude_v2" : "claude";
	}

	return base ?? "o200k_base";
}
