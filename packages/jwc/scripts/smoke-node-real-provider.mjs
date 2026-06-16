/**
 * Real-provider streaming hello world under Node (100.11 — the 100 MOC core
 * completion gate). Uses the locally stored xai OAuth credential (live-
 * verified on /v1/chat/completions earlier in the 99.30.04 work) and the real
 * default agent dir ONLY for auth discovery; session cwd/agentDir are temp.
 *
 * Prints provider/model, delta count, and a snippet of the final text — never
 * tokens or credential payloads.
 *
 * Usage: node scripts/smoke-node-real-provider.mjs   (cwd: packages/jwc)
 */
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

process.env.GJC_BRAND_NAME = "jwc";

// This smoke reads the real ~/.jwc/agent credential DB, so it is opt-in and
// must never run unguarded in CI (audit W-5). Set JWC_SMOKE_REAL_PROVIDER=1
// to run it locally.
if (process.env.JWC_SMOKE_REAL_PROVIDER !== "1") {
	console.log("[smoke 100.11] skipped — set JWC_SMOKE_REAL_PROVIDER=1 to run (reads real credentials)");
	process.exit(0);
}

const sdk = await import("../dist-node/sdk.js");
const authStorage = await sdk.discoverAuthStorage();

const workDir = mkdtempSync(path.join(tmpdir(), "jwc-real-cwd-"));
const agentDir = mkdtempSync(path.join(tmpdir(), "jwc-real-agent-"));

// Auto-pick whichever candidate provider has an active local credential
// (xai's refresh token got revoked mid-session on 260613, so codex first).
const CANDIDATES = [
	{
		id: "gpt-5.5",
		name: "GPT-5.5",
		api: "openai-codex-responses",
		provider: "openai-codex",
		baseUrl: "https://chatgpt.com/backend-api",
		reasoning: true,
		input: ["text"],
		cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
		contextWindow: 272000,
		maxTokens: 128000,
		thinking: { mode: "effort", minLevel: "low", maxLevel: "xhigh", defaultLevel: "low" },
	},
	{
		id: "grok-4.3",
		name: "Grok 4.3",
		api: "openai-completions",
		provider: "xai",
		baseUrl: "https://api.x.ai/v1",
		reasoning: false,
		input: ["text"],
		cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
		contextWindow: 1000000,
		maxTokens: 4096,
	},
];
const available = authStorage.list?.() ?? [];
const model = CANDIDATES.find(candidate => available.includes(candidate.provider));
assert.ok(model, `no candidate provider has stored credentials (have: ${available.join(", ")})`);

const result = await sdk.createAgentSession({ cwd: workDir, agentDir, authStorage, model });
const session = result.session;

let deltaCount = 0;
const eventTypes = new Set();
session.subscribe(event => {
	eventTypes.add(event.type);
	if (event.type === "message_update") deltaCount++;
});

try {
	await session.prompt("Say hello in one short sentence.");
	const messages = session.state?.messages ?? [];
	const lastAssistant = [...messages].reverse().find(m => m.role === "assistant");
	const text = (lastAssistant?.content ?? [])
		.map(part => (typeof part === "string" ? part : (part?.text ?? "")))
		.join("")
		.trim();

	console.log(`[smoke 100.11] provider: ${model.provider} / model: ${model.id}`);
	console.log(`[smoke 100.11] deltas: ${deltaCount} · events: ${[...eventTypes].join(", ")}`);
	console.log(`[smoke 100.11] final text (snippet): ${JSON.stringify(text.slice(0, 80))}`);
	console.log(`[smoke 100.11] temp cwd/agentDir: ${workDir.startsWith(tmpdir())} / ${agentDir.startsWith(tmpdir())}`);
	assert.ok(deltaCount > 0, "no streaming deltas");
	assert.ok(text.length > 0, "empty assistant text");
	assert.ok(eventTypes.has("agent_end"), "no terminal event");
} finally {
	await result.dispose?.();
	rmSync(workDir, { recursive: true, force: true });
	rmSync(agentDir, { recursive: true, force: true });
}
console.log("[smoke 100.11] real provider streaming turn complete");
process.exit(0);
