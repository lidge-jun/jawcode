import { afterEach, describe, expect, it, spyOn } from "bun:test";
import * as fs from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";
import type { AgentTool } from "@jawcode-dev/agent-core";
import {
	assertJawInterviewMutationRawPathsAllowed,
	getJawInterviewMutationDecision,
	JAW_INTERVIEW_MUTATION_BLOCK_MESSAGE,
} from "@jawcode-dev/coding-agent/skill-state/jaw-interview-mutation-guard";
import { ToolError } from "@jawcode-dev/coding-agent/tools/tool-errors";

const tempRoots: string[] = [];

function encodePathSegment(value: string): string {
	return encodeURIComponent(value).replaceAll(".", "%2E");
}

async function makeTempRoot(): Promise<string> {
	const root = await fs.mkdtemp(path.join(os.tmpdir(), "gjc-jaw-interview-guard-"));
	tempRoots.push(root);
	return root;
}

async function writeActiveJawInterview(
	cwd: string,
	sessionId = "session-a",
	phase = "interviewing",
	modeStatePatch: Record<string, unknown> = {},
): Promise<void> {
	const now = new Date().toISOString();
	const sessionDir = path.join(cwd, ".jwc", "state", "sessions", encodePathSegment(sessionId));
	await fs.mkdir(sessionDir, { recursive: true });
	const activeState = {
		version: 1,
		active: true,
		skill: "jaw-interview",
		phase,
		updated_at: now,
		active_skills: [
			{
				skill: "jaw-interview",
				phase,
				active: true,
				updated_at: now,
				session_id: sessionId,
			},
		],
	};
	await Bun.write(path.join(sessionDir, "skill-active-state.json"), `${JSON.stringify(activeState, null, 2)}\n`);
	await Bun.write(
		path.join(sessionDir, "jaw-interview-state.json"),
		`${JSON.stringify({ active: true, current_phase: phase, session_id: sessionId, ...modeStatePatch }, null, 2)}\n`,
	);
}

async function writeRootJawInterview(
	cwd: string,
	modeState: unknown = { active: true, current_phase: "interviewing" },
): Promise<void> {
	const now = new Date().toISOString();
	const stateDir = path.join(cwd, ".jwc", "state");
	await fs.mkdir(stateDir, { recursive: true });
	await Bun.write(
		path.join(stateDir, "skill-active-state.json"),
		`${JSON.stringify(
			{
				version: 1,
				active: true,
				skill: "jaw-interview",
				phase: "interviewing",
				updated_at: now,
				active_skills: [{ skill: "jaw-interview", phase: "interviewing", active: true, updated_at: now }],
			},
			null,
			2,
		)}\n`,
	);
	if (typeof modeState === "string") {
		await Bun.write(path.join(stateDir, "jaw-interview-state.json"), modeState);
	} else if (modeState !== null) {
		await Bun.write(path.join(stateDir, "jaw-interview-state.json"), `${JSON.stringify(modeState, null, 2)}\n`);
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

afterEach(async () => {
	await Promise.all(tempRoots.splice(0).map(root => fs.rm(root, { recursive: true, force: true })));
});

describe("jaw-interview mutation guard", () => {
	it("blocks product write/edit/ast_edit targets while jaw-interview is active", async () => {
		const cwd = await makeTempRoot();
		await writeActiveJawInterview(cwd);

		for (const [name, args, extra = {}] of [
			["write", { path: "packages/coding-agent/src/foo.ts", content: "x" }],
			["edit", { path: "src/foo.ts", edits: [{ old_text: "a", new_text: "b" }] }],
			[
				"edit",
				{ input: "*** Begin Patch\n*** Update File: src/foo.ts\n@@\n-a\n+b\n*** End Patch\n" },
				{ mode: "apply_patch", customWireName: "apply_patch" },
			],
			["ast_edit", { paths: ["packages/**"], ops: [{ pat: "foo", out: "bar" }] }],
		] as const) {
			const decision = await getJawInterviewMutationDecision({
				cwd,
				sessionId: "session-a",
				tool: tool(name, extra),
				args,
			});
			expect(decision.blocked).toBe(true);
			expect(decision.reason).toBe("phase-boundary");
			expect(decision.message).toBe(JAW_INTERVIEW_MUTATION_BLOCK_MESSAGE);
			expect(decision.message).toContain("handoff/spec before code edits");
		}
	});

	it("allows markdown artifacts but blocks non-markdown .jwc targets while jaw-interview is active", async () => {
		const cwd = await makeTempRoot();
		await writeActiveJawInterview(cwd);

		for (const rawPath of [".jwc/specs/jaw-interview-x.md", ".jwc/plans/plan.md", "packages/coding-agent/SKILL.md"]) {
			const decision = await getJawInterviewMutationDecision({
				cwd,
				sessionId: "session-a",
				tool: tool("write"),
				args: { path: rawPath, content: "x" },
			});
			expect(decision.blocked).toBe(false);
			expect(decision.targets).toEqual([rawPath]);
		}

		for (const rawPath of [".jwc/specs/jaw-interview-x.json", ".jwc/plans/plan.json"]) {
			const decision = await getJawInterviewMutationDecision({
				cwd,
				sessionId: "session-a",
				tool: tool("write"),
				args: { path: rawPath, content: "x" },
			});
			expect(decision.blocked).toBe(true);
			expect(decision.reason).toBe("jwc-target");
			expect(decision.message).toContain("runtime-owned");
		}

		const blockedCases: Array<[string, AgentTool, unknown]> = [
			["write active", tool("write"), { path: ".jwc/state/skill-active-state.json", content: "{}" }],
			[
				"write session active",
				tool("write"),
				{ path: ".jwc/state/sessions/session-a/skill-active-state.json", content: "{}" },
			],
			...(["jaw-interview", "ralplan", "goal", "team"] as const).map(
				skill =>
					[
						`write ${skill}`,
						tool("write"),
						{ path: `.jwc/state/sessions/session-a/${skill}-state.json`, content: "{}" },
					] as [string, AgentTool, unknown],
			),
			[
				"apply_patch state",
				tool("edit", { mode: "apply_patch", customWireName: "apply_patch" }),
				{
					input: "*** Begin Patch\n*** Update File: .jwc/state/team-state.json\n@@\n-a\n+b\n*** End Patch\n",
				},
			],
			[
				"vim state",
				tool("edit", { mode: "vim" }),
				{ file: "src/foo.ts", steps: [{ kbd: [":edit .jwc/state/sessions/session-a/ralplan-state.json<CR>"] }] },
			],
			[
				"ast_edit state",
				tool("ast_edit"),
				{ paths: [".jwc/state/**/team-state.json"], ops: [{ pat: "foo", out: "bar" }] },
			],
		];

		for (const [, targetTool, args] of blockedCases) {
			const decision = await getJawInterviewMutationDecision({
				cwd,
				sessionId: "session-a",
				tool: targetTool,
				args,
			});
			expect(decision.blocked).toBe(true);
			if (decision.reason === "workflow-state-target" || decision.reason === "jwc-target") {
				expect(decision.message).toContain("runtime-owned");
			} else {
				expect(decision.message).toBe(JAW_INTERVIEW_MUTATION_BLOCK_MESSAGE);
			}
		}
	});

	it("allows markdown/mockup creation/update targets and blocks non-document targets during active jaw-interview", async () => {
		const cwd = await makeTempRoot();
		await writeActiveJawInterview(cwd);

		for (const rawPath of [
			"../outside.md",
			path.join(os.tmpdir(), "outside-gjc-plan.md"),
			".jwc/specs-evil/plan.md",
			"packages/coding-agent/src/defaults/jwc/skills/jaw-interview/SKILL.md",
			"mockups/login-flow.html",
		]) {
			const decision = await getJawInterviewMutationDecision({
				cwd,
				sessionId: "session-a",
				tool: tool("write"),
				args: { path: rawPath, content: "x" },
			});
			expect(decision.blocked).toBe(false);
			expect(decision.targets).toEqual([rawPath]);
		}

		const addMarkdownPatch = await getJawInterviewMutationDecision({
			cwd,
			sessionId: "session-a",
			tool: tool("edit", { mode: "apply_patch", customWireName: "apply_patch" }),
			args: {
				input: "*** Begin Patch\n*** Add File: notes/new-interview-note.md\n+Decision: track the open question.\n*** End Patch\n",
			},
		});
		expect(addMarkdownPatch.blocked).toBe(false);
		expect(addMarkdownPatch.targets).toEqual(["notes/new-interview-note.md"]);

		const addHtmlMockupPatch = await getJawInterviewMutationDecision({
			cwd,
			sessionId: "session-a",
			tool: tool("edit", { mode: "apply_patch", customWireName: "apply_patch" }),
			args: {
				input: "*** Begin Patch\n*** Add File: mockups/new-interview-mockup.html\n+<main>Mockup for the open UX question.</main>\n*** End Patch\n",
			},
		});
		expect(addHtmlMockupPatch.blocked).toBe(false);
		expect(addHtmlMockupPatch.targets).toEqual(["mockups/new-interview-mockup.html"]);

		const hashlineMarkdownEdit = await getJawInterviewMutationDecision({
			cwd,
			sessionId: "session-a",
			tool: tool("edit"),
			args: {
				input: "*** Begin Patch\n§devlog/_plan/260614_cli_jaw_jwc_distribution_strategy/301_manager_ui_code_jaw_design_interview.md\n»1aa\nNew interview note\n*** End Patch\n",
			},
		});
		expect(hashlineMarkdownEdit.blocked).toBe(false);
		expect(hashlineMarkdownEdit.targets).toEqual([
			"devlog/_plan/260614_cli_jaw_jwc_distribution_strategy/301_manager_ui_code_jaw_design_interview.md",
		]);

		const hashlineHtmlEdit = await getJawInterviewMutationDecision({
			cwd,
			sessionId: "session-a",
			tool: tool("edit"),
			args: {
				input: "*** Begin Patch\n§mockups/current-flow.html\n»1aa\n<section>Updated mockup</section>\n*** End Patch\n",
			},
		});
		expect(hashlineHtmlEdit.blocked).toBe(false);
		expect(hashlineHtmlEdit.targets).toEqual(["mockups/current-flow.html"]);

		for (const rawPath of [
			"agent://123",
			"product/archive.zip:product.ts",
			"data.sqlite:rows:1",
			".jwc/stateful/data.json",
			"src/index.html",
			".jwc/specs/mockup.html",
			".jwc/mockups/mockup.html",
		]) {
			const decision = await getJawInterviewMutationDecision({
				cwd,
				sessionId: "session-a",
				tool: tool("write"),
				args: { path: rawPath, content: "x" },
			});
			expect(decision.blocked).toBe(true);
			if (rawPath.startsWith(".jwc/")) {
				expect(decision.message).toContain("runtime-owned");
			} else {
				expect(decision.message).toBe(JAW_INTERVIEW_MUTATION_BLOCK_MESSAGE);
			}
		}

		const addNonMarkdownPatch = await getJawInterviewMutationDecision({
			cwd,
			sessionId: "session-a",
			tool: tool("edit", { mode: "apply_patch", customWireName: "apply_patch" }),
			args: {
				input: "*** Begin Patch\n*** Add File: src/new-product-file.ts\n+export const x = 1;\n*** End Patch\n",
			},
		});
		expect(addNonMarkdownPatch.blocked).toBe(true);
		expect(addNonMarkdownPatch.message).toBe(JAW_INTERVIEW_MUTATION_BLOCK_MESSAGE);

		const hashlineProductEdit = await getJawInterviewMutationDecision({
			cwd,
			sessionId: "session-a",
			tool: tool("edit"),
			args: {
				input: "*** Begin Patch\n§src/new-product-file.ts\n»1aa\nexport const x = 1;\n*** End Patch\n",
			},
		});
		expect(hashlineProductEdit.blocked).toBe(true);
		expect(hashlineProductEdit.message).toBe(JAW_INTERVIEW_MUTATION_BLOCK_MESSAGE);

		const mixed = await getJawInterviewMutationDecision({
			cwd,
			sessionId: "session-a",
			tool: tool("ast_edit"),
			args: { paths: [".jwc/state/jaw-interview-state.json", "packages/**"], ops: [{ pat: "foo", out: "bar" }] },
		});
		expect(mixed.blocked).toBe(true);
	});

	it("allows read-only bash during active jaw-interview when no mutation target is extracted", async () => {
		const cwd = await makeTempRoot();
		await writeActiveJawInterview(cwd);

		for (const command of [
			"git status --short",
			"rg jaw-interview packages/coding-agent/src",
			"cat packages/coding-agent/package.json",
			"sed -n '1,80p' packages/coding-agent/src/skill-state/jaw-interview-mutation-guard.ts",
			"bun test packages/coding-agent/test/jaw-interview-mutation-guard.test.ts",
		]) {
			const decision = await getJawInterviewMutationDecision({
				cwd,
				sessionId: "session-a",
				tool: tool("bash"),
				args: { command },
			});
			expect(decision.blocked).toBe(false);
			expect(decision.targets).toEqual([]);
		}
	});

	it("blocks mutating bash that targets non-markdown .jwc paths and allows markdown targets", async () => {
		const cwd = await makeTempRoot();
		await writeActiveJawInterview(cwd);

		for (const command of ["rm .jwc/state/jaw-interview-state.json", "mkdir -p .jwc/specs"]) {
			const decision = await getJawInterviewMutationDecision({
				cwd,
				sessionId: "session-a",
				tool: tool("bash"),
				args: { command },
			});
			expect(decision.blocked).toBe(true);
			expect(decision.message).toContain("runtime-owned");
			expect(["jwc-target", "workflow-state-target"]).toContain(decision.reason ?? "");
		}

		for (const command of [
			"cp source.md .jwc/specs/jaw-interview-x.md",
			"sed -i 's/a/b/' .jwc/plans/plan.md",
			"cat source.md > .jwc/specs/jaw-interview-x.md",
		]) {
			const decision = await getJawInterviewMutationDecision({
				cwd,
				sessionId: "session-a",
				tool: tool("bash"),
				args: { command },
			});
			expect(decision.blocked).toBe(false);
		}
	});

	it("blocks vim file-switches when any target is non-markdown", async () => {
		const cwd = await makeTempRoot();
		await writeActiveJawInterview(cwd);

		const decision = await getJawInterviewMutationDecision({
			cwd,
			sessionId: "session-a",
			tool: tool("edit", { mode: "vim" }),
			args: {
				file: "packages/coding-agent/src/product.ts",
				steps: [{ kbd: [":edit .jwc/specs/jaw-interview-x.md<CR>", "iunsafe"] }],
			},
		});

		expect(decision.blocked).toBe(true);
		expect(decision.message).toBe(JAW_INTERVIEW_MUTATION_BLOCK_MESSAGE);
	});

	it("does not let root jaw-interview state block a fresh concrete session", async () => {
		const cwd = await makeTempRoot();
		await writeRootJawInterview(cwd);

		const decision = await getJawInterviewMutationDecision({
			cwd,
			sessionId: "fresh-session",
			tool: tool("write"),
			args: { path: "src/product.ts", content: "x" },
		});

		expect(decision.blocked).toBe(false);
	});

	it("fails open for a fresh session when only root jaw-interview mode state is missing or corrupt", async () => {
		for (const rootModeState of [null, "{"] as const) {
			const cwd = await makeTempRoot();
			await writeRootJawInterview(cwd, rootModeState);

			const decision = await getJawInterviewMutationDecision({
				cwd,
				sessionId: "fresh-session",
				tool: tool("write"),
				args: { path: "src/product.ts", content: "x" },
			});

			expect(decision.blocked).toBe(false);
		}
	});

	it("does not block after jaw-interview reaches a terminal phase", async () => {
		const cwd = await makeTempRoot();
		await writeActiveJawInterview(cwd, "session-a", "complete");

		const decision = await getJawInterviewMutationDecision({
			cwd,
			sessionId: "session-a",
			tool: tool("write"),
			args: { path: "src/product.ts", content: "x" },
		});
		expect(decision.blocked).toBe(false);
	});
	it("does not block after jaw-interview reaches handoff even above threshold", async () => {
		const cwd = await makeTempRoot();
		await writeActiveJawInterview(cwd, "session-a", "handoff", {
			state: { current_ambiguity: 0.9, threshold: 0.05 },
		});

		const decision = await getJawInterviewMutationDecision({
			cwd,
			sessionId: "session-a",
			tool: tool("write"),
			args: { path: "src/product.ts", content: "x" },
		});
		expect(decision.blocked).toBe(false);
	});

	it("allows writes and logs when jaw-interview mode state is invalid", async () => {
		const cwd = await makeTempRoot();
		await writeActiveJawInterview(cwd);
		await Bun.write(
			path.join(cwd, ".jwc", "state", "sessions", "session-a", "jaw-interview-state.json"),
			JSON.stringify({ active: "yes", current_phase: "interviewing", session_id: "session-a" }),
		);
		const warn = spyOn(console, "warn").mockImplementation(() => {});
		try {
			const decision = await getJawInterviewMutationDecision({
				cwd,
				sessionId: "session-a",
				tool: tool("write"),
				args: { path: "src/product.ts", content: "x" },
			});
			expect(decision.blocked).toBe(false);
			expect(warn).toHaveBeenCalledTimes(1);
			expect(String(warn.mock.calls[0]?.[0] ?? "")).toContain("jwc skill-state: invalid mode-state at");
		} finally {
			warn.mockRestore();
		}
	});

	it("allows writes and logs when jaw-interview mode state is corrupt JSON", async () => {
		const cwd = await makeTempRoot();
		await writeActiveJawInterview(cwd);
		await Bun.write(path.join(cwd, ".jwc", "state", "sessions", "session-a", "jaw-interview-state.json"), "{");
		const warn = spyOn(console, "warn").mockImplementation(() => {});
		try {
			const decision = await getJawInterviewMutationDecision({
				cwd,
				sessionId: "session-a",
				tool: tool("write"),
				args: { path: "src/product.ts", content: "x" },
			});
			expect(decision.blocked).toBe(false);
			expect(warn).toHaveBeenCalledTimes(1);
			expect(String(warn.mock.calls[0]?.[0] ?? "")).toContain("invalid JSON");
		} finally {
			warn.mockRestore();
		}
	});

	it("guards deferred ast_edit apply targets unless force override is explicit", async () => {
		const cwd = await makeTempRoot();
		await writeActiveJawInterview(cwd);

		for (const rawPaths of [["src/product.ts"], []]) {
			await expect(
				assertJawInterviewMutationRawPathsAllowed({
					cwd,
					sessionId: "session-a",
					rawPaths,
				}),
			).rejects.toBeInstanceOf(ToolError);
		}
		await expect(
			assertJawInterviewMutationRawPathsAllowed({
				cwd,
				sessionId: "session-a",
				rawPaths: [".jwc/specs/jaw-interview-x.md", "mockups/jaw-interview-wireframe.html"],
			}),
		).resolves.toBeUndefined();
		await expect(
			assertJawInterviewMutationRawPathsAllowed({
				cwd,
				sessionId: "session-a",
				rawPaths: ["src/product.ts"],
				forceOverride: true,
			}),
		).resolves.toBeUndefined();
	});
});
