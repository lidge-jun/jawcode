import { afterEach, describe, expect, it } from "bun:test";
import * as fs from "node:fs/promises";
import * as path from "node:path";
import { validateJawInterviewRounds } from "@jawcode-dev/coding-agent/jwc-runtime/jaw-interview-round-validation";
import { runNativeStateCommand } from "@jawcode-dev/coding-agent/jwc-runtime/state-runtime";

const tempRoots: string[] = [];

async function tempDir(): Promise<string> {
	const dir = await fs.mkdtemp(path.join(process.cwd(), ".tmp-jaw-round-"));
	tempRoots.push(dir);
	return dir;
}

afterEach(async () => {
	await Promise.all(tempRoots.splice(0).map(dir => fs.rm(dir, { recursive: true, force: true })));
});

describe("validateJawInterviewRounds (10.042)", () => {
	it("passes the seed envelope { rounds: [], current_ambiguity: 1.0 }", () => {
		expect(validateJawInterviewRounds({ rounds: [], current_ambiguity: 1.0 }).valid).toBe(true);
	});

	it("passes when round metadata is absent (legacy / transcript-only)", () => {
		expect(validateJawInterviewRounds({ current_phase: "interviewing" }).valid).toBe(true);
	});

	it("passes free-form non-object round rows", () => {
		expect(validateJawInterviewRounds({ rounds: ["q1", "q2"] }).valid).toBe(true);
	});

	it("passes empty-object round rows (HUD-sync shape)", () => {
		expect(validateJawInterviewRounds({ rounds: [{}, {}] }).valid).toBe(true);
	});

	it("passes a well-formed scored round", () => {
		const state = {
			current_ambiguity: 0.4,
			rounds: [{ ambiguity: 0.4, dimensions: { goal: 3, constraint: 2, success: 1, ontology: 0 } }],
		};
		expect(validateJawInterviewRounds(state).valid).toBe(true);
	});

	it("reads round metadata from a nested state envelope", () => {
		const state = { state: { current_ambiguity: 0.5, rounds: [{ ambiguity: 0.5 }] } };
		expect(validateJawInterviewRounds(state).valid).toBe(true);
	});

	it("rejects non-numeric current_ambiguity", () => {
		const result = validateJawInterviewRounds({ current_ambiguity: "high" });
		expect(result.valid).toBe(false);
		expect(result.error).toContain("current_ambiguity");
	});

	it("rejects current_ambiguity out of [0,1]", () => {
		expect(validateJawInterviewRounds({ current_ambiguity: 1.5 }).valid).toBe(false);
		expect(validateJawInterviewRounds({ current_ambiguity: -0.1 }).valid).toBe(false);
	});

	it("rejects NaN ambiguity (cannot render a HUD chip)", () => {
		expect(validateJawInterviewRounds({ current_ambiguity: Number.NaN }).valid).toBe(false);
	});

	it("rejects rounds that is not an array", () => {
		const result = validateJawInterviewRounds({ rounds: { 0: "x" } });
		expect(result.valid).toBe(false);
		expect(result.error).toContain("must be an array");
	});

	it("rejects a round ambiguity out of [0,1]", () => {
		const result = validateJawInterviewRounds({ rounds: [{ ambiguity: 2 }] });
		expect(result.valid).toBe(false);
		expect(result.error).toContain("rounds[0].ambiguity");
	});

	it("rejects a non-integer dimension score", () => {
		const result = validateJawInterviewRounds({ rounds: [{ dimensions: { goal: 1.5 } }] });
		expect(result.valid).toBe(false);
		expect(result.error).toContain("dimensions.goal");
	});

	it("rejects a dimension score out of [0,3]", () => {
		expect(validateJawInterviewRounds({ rounds: [{ dimensions: { success: 4 } }] }).valid).toBe(false);
		expect(validateJawInterviewRounds({ rounds: [{ dimensions: { ontology: -1 } }] }).valid).toBe(false);
	});

	it("rejects dimensions that is not an object", () => {
		const result = validateJawInterviewRounds({ rounds: [{ dimensions: 3 }] });
		expect(result.valid).toBe(false);
		expect(result.error).toContain("dimensions must be an object");
	});

	it("tolerates non-object top-level state", () => {
		expect(validateJawInterviewRounds(null).valid).toBe(true);
		expect(validateJawInterviewRounds("x").valid).toBe(true);
	});
});

describe("jwc state write — jaw-interview round guard (10.042)", () => {
	it("rejects a malformed round write (fail-closed before persist)", async () => {
		const root = await tempDir();
		const result = await runNativeStateCommand(
			[
				"write",
				"--mode",
				"jaw-interview",
				"--input",
				JSON.stringify({ state: { rounds: [{ ambiguity: 9 }] } }),
				"--json",
			],
			root,
		);
		expect(result.status).not.toBe(0);
		expect(`${result.stdout}${result.stderr}`).toContain("ambiguity");
		// Nothing should have been persisted.
		const stateFile = path.join(root, ".jwc", "state", "jaw-interview-state.json");
		await expect(fs.readFile(stateFile, "utf-8")).rejects.toBeDefined();
	});

	it("accepts a well-formed round write", async () => {
		const root = await tempDir();
		const result = await runNativeStateCommand(
			[
				"write",
				"--mode",
				"jaw-interview",
				"--input",
				JSON.stringify({
					state: {
						current_ambiguity: 0.4,
						rounds: [{ ambiguity: 0.4, dimensions: { goal: 3, constraint: 2, success: 1, ontology: 0 } }],
					},
				}),
				"--json",
			],
			root,
		);
		expect(result.status).toBe(0);
	});

	it("does not block plan-mode writes that carry an out-of-range ambiguity-like field", async () => {
		const root = await tempDir();
		const result = await runNativeStateCommand(
			["write", "--mode", "plan", "--input", JSON.stringify({ state: { current_ambiguity: 9 } }), "--json"],
			root,
		);
		// plan mode is unaffected by the jaw-interview-only guard.
		expect(result.status).toBe(0);
	});
});
