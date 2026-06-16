import { BunGlob } from "./src/shims/bun-glob";

const tests: Array<[string, string]> = [
	["a/**", "a/b/c"],
	["a/**", "a"],
	["a/**", "a/b"],
	["**", "a/b/c"],
	["**", "a"],
	["src/**/*.ts", "src/a.ts"],
	["src/**/*.ts", "src/a/b.ts"],
	["{a,b}/**", "a/x/y"],
	["*.ts", "a.ts"],
	["*.ts", "dir/a.ts"],
	["[!ab]c", "/c"], // negated class crossing?
	["foo*bar", "fooXbar"],
	["foo**bar", "fooXYbar"], // ** not at boundary
	["foo**bar", "foo/X/bar"], // does ** cross slash mid-segment?
	["a{b,c}d", "abd"],
	["[a-c]x", "bx"],
	["a.b", "a.b"],
	["a.b", "axb"],
];
for (const [pat, cand] of tests) {
	let native: boolean | string;
	try {
		native = new Bun.Glob(pat).match(cand);
	} catch {
		native = "ERR";
	}
	let shim: boolean | string;
	try {
		shim = new BunGlob(pat).match(cand);
	} catch {
		shim = "ERR";
	}
	const mark = native === shim ? "ok " : "DIFF";
	console.log(`${mark} pat=${JSON.stringify(pat)} cand=${JSON.stringify(cand)} native=${native} shim=${shim}`);
}
