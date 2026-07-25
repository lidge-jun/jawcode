import { describe, expect, it } from "bun:test";
import { resolveTokenizerFamily, type TokenizerFamily } from "../src/utils/tokenizer-routing";

describe("resolveTokenizerFamily — DeepInfra model-id routing", () => {
	const cases: Array<[string, TokenizerFamily]> = [
		["deepseek-ai/DeepSeek-V3.2", "deepseek"],
		["deepseek-ai/DeepSeek-R1-0528", "deepseek"],
		["google/gemma-4-31B-it", "gemma"],
		["meta-llama/Llama-3.3-70B-Instruct-Turbo", "llama3"],
		["zai-org/GLM-5", "glm"],
		["MiniMaxAI/MiniMax-M2.5", "glm"],
		["Qwen/Qwen3.5-35B-A3B", "o200k_base"],
		["moonshotai/Kimi-K2.6", "o200k_base"],
		["openai/gpt-oss-120b", "o200k_base"],
		["XiaomiMiMo/MiMo-V2.5", "o200k_base"],
	];

	for (const [id, expected] of cases) {
		it(`routes ${id} -> ${expected}`, () => {
			expect(resolveTokenizerFamily({ provider: "deepinfra", id })).toBe(expected);
		});
	}
});
