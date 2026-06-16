/**
 * Mock-provider streaming loop under Node (100.10).
 *
 * Boots a local OpenAI-compatible SSE endpoint, injects it as the session
 * model (provider "openai" + dummy env key so auth resolution passes), runs
 * one prompt turn through the real agent loop, and asserts assistant deltas
 * plus a terminal event. No real provider, no tools.
 *
 * Usage: node scripts/smoke-node-streaming.mjs   (cwd: packages/jwc)
 */
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { createServer } from "node:http";
import { tmpdir } from "node:os";
import path from "node:path";

process.env.OPENAI_API_KEY = "sk-mock-not-a-real-key";
process.env.GJC_BRAND_NAME = "jwc";

// ── mock OpenAI chat-completions SSE server ────────────────────────────────
const server = createServer((req, res) => {
	if (!req.url?.includes("/chat/completions")) {
		res.writeHead(404).end();
		return;
	}
	req.resume();
	req.on("end", () => {
		res.writeHead(200, {
			"Content-Type": "text/event-stream",
			"Cache-Control": "no-cache",
			Connection: "keep-alive",
		});
		const chunk = (delta, finish = null) =>
			`data: ${JSON.stringify({
				id: "chatcmpl-mock",
				object: "chat.completion.chunk",
				model: "mock-model",
				choices: [{ index: 0, delta, finish_reason: finish }],
			})}\n\n`;
		res.write(chunk({ role: "assistant", content: "Hello" }));
		res.write(chunk({ content: " from mock" }));
		res.write(chunk({}, "stop"));
		res.write("data: [DONE]\n\n");
		res.end();
	});
});
await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
const port = server.address().port;

const workDir = mkdtempSync(path.join(tmpdir(), "jwc-stream-cwd-"));
const agentDir = mkdtempSync(path.join(tmpdir(), "jwc-stream-agent-"));

const sdk = await import("../dist-node/sdk.js");
const result = await sdk.createAgentSession({
	cwd: workDir,
	agentDir,
	model: {
		id: "mock-model",
		name: "Mock Model",
		api: "openai-completions",
		provider: "openai",
		baseUrl: `http://127.0.0.1:${port}/v1`,
		reasoning: false,
		input: ["text"],
		cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
		contextWindow: 128000,
		maxTokens: 4096,
	},
});

const session = result.session;
const eventTypes = [];
let deltaText = "";
const unsubscribe = session.subscribe(event => {
	eventTypes.push(event.type);
	const text = event?.assistantMessageEvent?.delta ?? event?.delta ?? "";
	if (typeof text === "string") deltaText += text;
});

try {
	await session.prompt("hello");
	unsubscribe();

	const joined = eventTypes.join(",");
	console.log(`[smoke 100.10] events: ${[...new Set(eventTypes)].join(", ")}`);
	assert.ok(eventTypes.length > 0, "no events emitted");
	assert.ok(/message_update|message_delta/.test(joined), "no assistant delta event");
	assert.ok(/message_end|agent_end|turn_end/.test(joined), "no terminal event");

	const messages = session.state?.messages ?? [];
	const assistant = JSON.stringify(messages);
	assert.ok(assistant.includes("Hello from mock"), "assistant text missing from session state");
	console.log("[smoke 100.10] assistant text round-trip OK ('Hello from mock')");
} finally {
	await result.dispose?.();
	server.close();
	rmSync(workDir, { recursive: true, force: true });
	rmSync(agentDir, { recursive: true, force: true });
}
console.log("[smoke 100.10] mock streaming turn complete");
process.exit(0);
