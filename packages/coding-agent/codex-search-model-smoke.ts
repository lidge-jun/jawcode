/**
 * Empirical A/B: OAI codex web search quality — gpt-5.5 vs gpt-5.3-codex-spark.
 * Runs the SAME hard query through searchCodex() with PI_CODEX_WEB_SEARCH_MODEL
 * forced to each model, then compares answer length, source count, latency.
 * Run: bun packages/coding-agent/codex-search-model-smoke.ts
 */
import { discoverAuthStorage } from "./src/sdk.ts";
import { searchCodex } from "./src/web/search/providers/codex.ts";

const agentDir = `${process.env.HOME}/.jwc/agent`;
const authStorage = await discoverAuthStorage(agentDir);

// A genuinely hard, multi-hop research query (not a single-fact lookup).
const QUERY =
	"Compare the context window and pricing of OpenAI gpt-5.5 vs Anthropic Claude Opus 4.8 as of 2026, and cite which is cheaper per output token.";

const MODELS = ["gpt-5.5", "gpt-5.3-codex-spark"] as const;

for (const model of MODELS) {
	process.env.PI_CODEX_WEB_SEARCH_MODEL = model;
	const t0 = Date.now();
	try {
		const res = await searchCodex({ authStorage, query: QUERY });
		const ms = Date.now() - t0;
		const answer = res.answer ?? "";
		console.log(`\n══════ ${model} ══════`);
		console.log(`served model: ${res.model}`);
		console.log(`latency: ${(ms / 1000).toFixed(1)}s`);
		console.log(`answer chars: ${answer.length}`);
		console.log(`sources: ${res.sources.length}`);
		console.log(`tokens: in ${res.usage?.inputTokens ?? "?"} / out ${res.usage?.outputTokens ?? "?"}`);
		console.log(`--- answer (first 700 chars) ---\n${answer.slice(0, 700)}`);
		console.log(
			`--- sources ---\n${res.sources
				.slice(0, 6)
				.map(s => `  • ${s.title ?? s.url}`)
				.join("\n")}`,
		);
	} catch (err) {
		console.log(`\n══════ ${model} ══════`);
		console.log(`FAILED: ${err instanceof Error ? err.message : String(err)}`);
	}
}
console.log("\nSMOKE_DONE");
