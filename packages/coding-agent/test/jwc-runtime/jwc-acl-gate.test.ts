import { describe, expect, it } from "bun:test";
import * as fs from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";
import type { AgentTool } from "@jawcode-dev/agent-core";
import { getJawInterviewMutationDecision } from "../../src/skill-state/jaw-interview-mutation-guard";

async function withTempCwd(fn: (cwd: string) => Promise<void>): Promise<void> {
	const dir = await fs.mkdtemp(path.join(os.tmpdir(), "gjc-acl-gate-"));
	const priorSessionId = process.env.GJC_SESSION_ID;
	delete process.env.GJC_SESSION_ID;
	try {
		await fn(dir);
	} finally {
		if (priorSessionId !== undefined) process.env.GJC_SESSION_ID = priorSessionId;
		await fs.rm(dir, { recursive: true, force: true });
	}
}

function tool(name: string, extra: Record<string, unknown> = {}): AgentTool {
	return {
		name,
		label: name,
		description: name,
		parameters: {} as never,
		execute: async () => ({ content: [{ type: "text" as const, text: "ok" }] }),
		...extra,
	} as AgentTool;
}

describe("G2 gjc ACL gate", () => {
	it("blocks mutation tools targeting non-markdown .jwc paths", async () => {
		await withTempCwd(async cwd => {
			const blockedCases: Array<[AgentTool, unknown]> = [
				[tool("write"), { path: ".jwc/state/foo.json", content: "{}" }],
				[tool("ast_edit"), { paths: [".jwc/state/foo.json"], ops: [{ pat: "foo", out: "bar" }] }],
				[tool("bash"), { command: "echo x > .jwc/state/foo.json" }],
				[tool("bash"), { command: "rm -rf .jwc/specs" }],
			];

			for (const [targetTool, args] of blockedCases) {
				const decision = await getJawInterviewMutationDecision({ cwd, tool: targetTool, args });
				expect(decision.blocked).toBe(true);
				expect(decision.message).toContain("runtime-owned");
				if (decision.reason !== "unknown-target") {
					expect(["jwc-target", "workflow-state-target"]).toContain(decision.reason as string);
				}
			}
		});
	});

	it("allows sanctioned gjc bash commands and non-.jwc writes", async () => {
		await withTempCwd(async cwd => {
			const jwcCommand = await getJawInterviewMutationDecision({
				cwd,
				tool: tool("bash"),
				args: { command: "jwc state ralplan write --input '{}'" },
			});
			expect(jwcCommand.blocked).toBe(false);

			const productWrite = await getJawInterviewMutationDecision({
				cwd,
				tool: tool("write"),
				args: { path: "src/product.ts", content: "x" },
			});
			expect(productWrite.blocked).toBe(false);
		});
	});
});
