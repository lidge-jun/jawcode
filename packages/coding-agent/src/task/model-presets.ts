export interface SubagentModelPreset {
	best?: string;
	cheap?: string;
}

export const DEFAULT_MODEL_PRESETS: Record<string, SubagentModelPreset> = {
	anthropic: { best: "claude-opus-4-8", cheap: "claude-sonnet-4-6" },
	"openai-codex": { best: "gpt-5.5", cheap: "gpt-5.4-mini" },
	xai: { cheap: "grok-composer-2.5-fast" },
	google: { best: "gemini-3.1-pro", cheap: "gemini-3.5-flash" },
	kiro: { best: "claude-opus-4.8", cheap: "deepseek-3.2" },
	copilot: { best: "gpt-5.5", cheap: "gpt-5-mini" },
	"opencode-go": { best: "mimo-v2.5-pro", cheap: "deepseek-v4-flash" },
	"alibaba-coding-plan": { best: "qwen3.6-plus", cheap: "qwen3.6-flash" },
	cerebras: { best: "qwen-3-coder-480b", cheap: "gpt-oss-120b" },
	groq: { best: "kimi-k2-instruct", cheap: "llama-4-scout-17b-16e" },
	deepseek: { best: "deepseek-v4-pro", cheap: "deepseek-v4-flash" },
	"minimax-code": { best: "minimax-m3", cheap: "MiniMax-M2.5" },
	mistral: { best: "mistral-medium-latest", cheap: "devstral-small-latest" },
};

/**
 * Resolve a model hint string to model patterns for the executor.
 *
 * Hint syntax:
 *   - undefined / "self" → undefined (inherit parent model)
 *   - "cheap:anthropic"  → preset lookup → ["claude-sonnet-4-6"]
 *   - "best:google"      → preset lookup → ["gemini-3.1-pro"]
 *   - "claude-sonnet-4-6" → direct model ID → ["claude-sonnet-4-6"]
 *
 * Returns undefined when the hint resolves to parent-inherit (self or unknown preset).
 */
export function resolveModelHint(
	hint: string | undefined,
	userPresets?: Record<string, SubagentModelPreset>,
): string[] | undefined {
	if (!hint) return undefined;
	const trimmed = hint.trim();
	if (!trimmed || trimmed === "self") return undefined;

	const match = trimmed.match(/^(best|cheap):(.+)$/);
	if (match) {
		const tier = match[1] as "best" | "cheap";
		const provider = match[2];
		const merged = userPresets ? { ...DEFAULT_MODEL_PRESETS, ...userPresets } : DEFAULT_MODEL_PRESETS;
		const preset = merged[provider];
		const model = preset?.[tier];
		if (model) return [model];
		return undefined;
	}

	return [trimmed];
}
