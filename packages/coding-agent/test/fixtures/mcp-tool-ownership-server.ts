import * as readline from "node:readline";

const lines = readline.createInterface({ input: process.stdin });

for await (const line of lines) {
	const request = JSON.parse(line) as { id?: string | number; method?: string };
	if (request.id === undefined) continue;
	let result: unknown;
	if (request.method === "initialize") {
		result = {
			protocolVersion: "2025-03-26",
			capabilities: { tools: {} },
			serverInfo: { name: "ownership-fixture", version: "1.0.0" },
		};
	} else if (request.method === "tools/list") {
		result = {
			tools: [{ name: "search", description: "Search fixture", inputSchema: { type: "object" } }],
		};
	} else {
		process.stdout.write(
			`${JSON.stringify({
				jsonrpc: "2.0",
				id: request.id,
				error: { code: -32601, message: `Unsupported method: ${request.method}` },
			})}\n`,
		);
		continue;
	}
	process.stdout.write(`${JSON.stringify({ jsonrpc: "2.0", id: request.id, result })}\n`);
}
