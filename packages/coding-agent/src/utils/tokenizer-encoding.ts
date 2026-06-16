import { resolveTokenizerFamily, type TokenizerFamily } from "@gajae-code/ai/utils/tokenizer-routing";
import { Encoding } from "@gajae-code/natives";
import { triggerBackgroundDownload } from "./tokenizer-download";

const FAMILY_TO_ENCODING: Record<TokenizerFamily, Encoding> = {
	o200k_base: Encoding.O200kBase,
	cl100k_base: Encoding.Cl100kBase,
	claude: Encoding.Claude,
	claude_v2: Encoding.ClaudeV2,
	gemma: Encoding.Gemma,
	llama3: Encoding.Llama3,
	deepseek: Encoding.DeepSeek,
	mistral: Encoding.Mistral,
	glm: Encoding.Glm,
	cohere: Encoding.Cohere,
};

const LAZY_FAMILIES = new Set<TokenizerFamily>(["gemma", "llama3", "deepseek", "mistral", "glm", "cohere"]);

export function tokenizerFamilyToEncoding(family: TokenizerFamily): Encoding {
	if (LAZY_FAMILIES.has(family)) {
		triggerBackgroundDownload(family);
	}
	return FAMILY_TO_ENCODING[family];
}

export function resolveModelEncoding(model: { provider: string; id: string }): Encoding {
	return tokenizerFamilyToEncoding(resolveTokenizerFamily(model));
}
