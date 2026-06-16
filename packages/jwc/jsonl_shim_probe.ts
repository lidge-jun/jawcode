import { bunJSONL } from "./src/shims/bun-jsonl";

const cases = [
	'{"a":1}\n{broken}\n{"c":3}\n',
	'{"a":1}\n{broken}\n',
	'{"a":1}\n\n{"c":3}\n',
	'{"a":1}\n{"b":2}',
	'{broken}\n{"a":1}\n',
	'   \n{"a":1}\n',
	'{"a":1}\n{broken}',
];
for (const c of cases) {
	const r = bunJSONL.parseChunk(c);
	console.log(
		JSON.stringify(c),
		"=>",
		JSON.stringify({ values: r.values, read: r.read, done: r.done, err: r.error ? String(r.error) : undefined }),
	);
}
