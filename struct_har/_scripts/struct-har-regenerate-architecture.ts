/**
 * Refresh struct_har architecture markdown to point at structure SoT.
 * Run: bun struct_har/_scripts/struct-har-regenerate-architecture.ts
 */
import * as fs from "node:fs";
import * as path from "node:path";
import { resolveForkHead, resolveGjcHead } from "./resolve-heads.ts";

const ROOT = path.resolve(import.meta.dir, "../..");
const STRUCT = path.join(ROOT, "struct_har");
const STRUCTURE = path.join(ROOT, "structure");

const MAP: Record<string, string> = {
	architecture: "10_architecture.md",
	conventions: "11_conventions.md",
	prompt_flow: "20_prompt_flow.md",
	extensibility: "21_extensibility.md",
	session_storage: "22_session_storage.md",
	packages: "10_architecture.md",
	workflows: "21_extensibility.md",
};

const FORK_HEAD = resolveForkHead();
const GJC_HEAD = resolveGjcHead();

for (const side of ["gjc_origin", "jwc_patched"] as const) {
	const archDir = path.join(STRUCT, side, "architecture");
	fs.mkdirSync(archDir, { recursive: true });
	for (const [harName, structName] of Object.entries(MAP)) {
		const structPath = path.join(STRUCTURE, structName);
		const excerpt = fs.existsSync(structPath)
			? fs.readFileSync(structPath, "utf8").split("\n").slice(0, 12).join("\n")
			: "(structure file missing)";
		const content = `# architecture / ${harName} (${side})

> **스냅샷 (2026-06-26)**: patched SoT는 [\`structure/${structName}\`](../../../structure/${structName}).
> fork \`${FORK_HEAD}\` · gjc clone \`${GJC_HEAD}\`.

## structure/ 발췌 (첫 12줄)

\`\`\`markdown
${excerpt}
\`\`\`

## 대조 메모

| side | 역할 |
|---|---|
| gjc_origin | upstream 클론 시점의 structure 동형 요약 (과거 har_struct) |
| jwc_patched | **structure/** 가 항상 최신 정본 — 본 파일은 인덱스·리베이스 전 훑기용 |

## 부록

- 전수 갱신: \`bun struct_har/_scripts/struct-har-regenerate-architecture.ts\`
`;
		fs.writeFileSync(path.join(archDir, `${harName}.md`), `${content}\n`, "utf8");
	}
}

console.log("struct_har: architecture/*.md refreshed (both sides)");
