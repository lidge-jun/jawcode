import { BunGlob } from "./src/shims/bun-glob";

const tests: Array<[string, string]> = [
	// [pattern, candidate]
	["*sonnet*", "anthropic/claude-3-5-sonnet"],
	["*sonnet*", "claude-3-5-sonnet"],
	["claude-*", "claude-3-5-sonnet"],
	["**/*", "a/b/c.md"],
	["**/*", "c.md"],
	["**/*.md", "a/b/c.md"],
	["**/*.md", "c.md"],
	["packages/*/package.json", "packages/jwc/package.json"],
	["packages/*/package.json", "packages/jwc/nested/package.json"],
	["packages/**/package.json", "packages/jwc/nested/package.json"],
	["**/.git", ".git"],
	["**/.git", "a/.git"],
	["**/.git/**", "a/.git/config"],
	["**/node_modules/**", "node_modules/foo"],
	["**/node_modules/**", "a/node_modules/foo"],
	["src/{a,b}.ts", "src/a.ts"],
	["a?c", "abc"],
	["a?c", "a/c"],
	["[ab]c", "ac"],
	["[!ab]c", "cc"],
];

for (const [pat, cand] of tests) {
	let native: boolean | string;
	try {
		native = new Bun.Glob(pat).match(cand);
	} catch (e) {
		native = `ERR:${String(e)}`;
	}
	let shim: boolean | string;
	try {
		shim = new BunGlob(pat).match(cand);
	} catch (e) {
		shim = `ERR:${String(e)}`;
	}
	const mark = native === shim ? "ok " : "DIFF";
	console.log(`${mark} pat=${JSON.stringify(pat)} cand=${JSON.stringify(cand)} native=${native} shim=${shim}`);
}
