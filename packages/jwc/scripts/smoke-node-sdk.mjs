/**
 * Node SDK smoke (100.08 import + 100.09 session creation).
 *
 * Usage: node scripts/smoke-node-sdk.mjs   (cwd: packages/jwc)
 * Requires a prior `bun run build:node`. No provider credentials, no LLM
 * calls — creation and dispose only.
 */
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

// ── 100.08: import smoke ────────────────────────────────────────────────────
const sdk = await import("../dist-node/sdk.js");
const exportNames = Object.keys(sdk);
assert.ok(exportNames.length > 0, "no exports");
assert.ok(typeof sdk.createAgentSession === "function", "missing createAgentSession");
console.log(`[smoke 100.08] import OK — ${exportNames.length} exports, createAgentSession present`);

// ── 100.09: session creation smoke ─────────────────────────────────────────
const workDir = mkdtempSync(path.join(tmpdir(), "jwc-smoke-cwd-"));
const agentDir = mkdtempSync(path.join(tmpdir(), "jwc-smoke-agent-"));
process.env.GJC_BRAND_NAME = "jwc";

let smokeSucceeded = false;
try {
	const result = await sdk.createAgentSession({ cwd: workDir, agentDir });
	const session = result.session ?? result;
	const keys = Object.keys(session ?? {});
	console.log(`[smoke 100.09] createAgentSession OK — keys: ${keys.slice(0, 12).join(", ")}${keys.length > 12 ? ", …" : ""}`);
	const target = session.session ?? session;
	const surface = ["prompt", "interrupt", "dispose"].map(
		name => `${name}:${typeof target[name] === "function" ? "fn" : typeof session[name] === "function" ? "fn" : "—"}`,
	);
	console.log(`[smoke 100.09] surface — ${surface.join(" · ")}`);
	await (session.dispose?.() ?? target.dispose?.());
	await result.mcpManager?.disconnectAll?.();
	console.log("[smoke 100.09] dispose OK");
	smokeSucceeded = true;
} finally {
	rmSync(workDir, { recursive: true, force: true });
	rmSync(agentDir, { recursive: true, force: true });
}

if (smokeSucceeded) {
	process.exit(0);
}
