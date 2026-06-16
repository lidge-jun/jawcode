/**
 * Web-search model A/B bench. Runs a query battery through one provider across
 * multiple models, writing a markdown result file. Models are forced via the
 * provider's env override (PI_CODEX_WEB_SEARCH_MODEL / XAI_SEARCH_MODEL / ANTHROPIC_SEARCH_MODEL).
 *
 * Usage:
 *   bun packages/coding-agent/search-bench.ts <codex|xai|anthropic> <m1,m2,...> <outfile.md>
 */
import { writeFileSync } from "node:fs";
import { discoverAuthStorage } from "./src/sdk.ts";
import { searchAnthropic } from "./src/web/search/providers/anthropic.ts";
import { searchCodex } from "./src/web/search/providers/codex.ts";
import { XaiProvider } from "./src/web/search/providers/xai.ts";

const [provider, modelsCsv, outFile] = process.argv.slice(2);
if (!provider || !modelsCsv || !outFile) {
	console.error("usage: search-bench.ts <provider> <models-csv> <outfile>");
	process.exit(1);
}
const models = modelsCsv
	.split(",")
	.map(m => m.trim())
	.filter(Boolean);

const HARD = [
	{
		id: "price-multihop",
		q: "Compare the context window and output-token price of OpenAI gpt-5.5 vs Anthropic Claude Opus 4.8 as of 2026, and state which is cheaper per output token. Cite sources.",
	},
	{
		id: "kev-subsidy",
		q: "2026년 한국 전기차 국고보조금 기준으로 서울·부산·대구 3개 지자체의 추가 보조금 차이를 최신 공식 자료로 비교해줘.",
	},
	{
		id: "kfilm-multi",
		q: "한국 영화 중 신인감독상과 신인여우주연상을 둘 다 받았고 이후 뮤지컬로도 제작된 작품을 찾아줘. 작품명과 근거.",
	},
	{
		id: "obscure-book",
		q: "고려대학교출판문화원이 2024년 12월 27일에 출간한 540쪽 분량 MOOC 관련 도서의 제목을 찾아줘.",
	},
	{
		id: "freshness",
		q: "What is the most recent stable release version of the Bun JavaScript runtime and its release date?",
	},
];
const X_SPECIALIZED = [
	{
		id: "x-claude-buzz",
		q: "지난 일주일간 X(트위터)에서 'Claude Opus 4.8' 코딩 성능에 대한 개발자 반응을 긍정/부정으로 요약해줘.",
	},
	{
		id: "x-gpt-buzz",
		q: "What are developers on X saying this week about OpenAI gpt-5.5 for coding? Summarize sentiment.",
	},
];
const battery = provider === "xai" ? [...HARD, ...X_SPECIALIZED] : HARD;

const authStorage = await discoverAuthStorage(`${process.env.HOME}/.jwc/agent`);

function setModelEnv(model: string): void {
	delete process.env.PI_CODEX_WEB_SEARCH_MODEL;
	delete process.env.XAI_SEARCH_MODEL;
	delete process.env.ANTHROPIC_SEARCH_MODEL;
	if (provider === "codex") process.env.PI_CODEX_WEB_SEARCH_MODEL = model;
	else if (provider === "xai") process.env.XAI_SEARCH_MODEL = model;
	else if (provider === "anthropic") process.env.ANTHROPIC_SEARCH_MODEL = model;
}

async function runOne(
	query: string,
): Promise<{ ms: number; chars: number; sources: number; out: number; served: string; answer: string; err?: string }> {
	const t0 = Date.now();
	try {
		const res =
			provider === "codex"
				? await searchCodex({ authStorage, query })
				: provider === "anthropic"
					? await searchAnthropic({ authStorage, query })
					: await new XaiProvider().search({ authStorage, query });
		const ms = Date.now() - t0;
		const answer = res.answer ?? "";
		return {
			ms,
			chars: answer.length,
			sources: res.sources.length,
			out: res.usage?.outputTokens ?? 0,
			served: res.model ?? "?",
			answer,
		};
	} catch (err) {
		return {
			ms: Date.now() - t0,
			chars: 0,
			sources: 0,
			out: 0,
			served: "-",
			answer: "",
			err: err instanceof Error ? err.message : String(err),
		};
	}
}

const lines: string[] = [
	`# search-bench: ${provider} — ${models.join(" vs ")}`,
	"",
	"| query | model | latency | chars | src | out-tok | served | err |",
	"|---|---|--:|--:|--:|--:|---|---|",
];
const detail: string[] = ["", "## 답변 스니펫", ""];

for (const { id, q } of battery) {
	for (const model of models) {
		setModelEnv(model);
		const r = await runOne(q);
		lines.push(
			`| ${id} | ${model} | ${(r.ms / 1000).toFixed(1)}s | ${r.chars} | ${r.sources} | ${r.out} | ${r.served} | ${r.err ?? ""} |`,
		);
		detail.push(`### [${id}] ${model}\n${r.err ? `ERR: ${r.err}` : r.answer.slice(0, 500)}\n`);
		console.error(
			`[${provider}] ${id} / ${model}: ${(r.ms / 1000).toFixed(1)}s chars=${r.chars} src=${r.sources}${r.err ? ` ERR ${r.err}` : ""}`,
		);
	}
}

writeFileSync(outFile, [...lines, ...detail].join("\n"), "utf8");
console.error(`\nWROTE ${outFile}`);
