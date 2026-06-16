import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { applyCliJawDevVocabularyMap, isCliJawSkillPath } from "../../src/jwc-runtime/cli-jaw-vocab";
import { buildAuditLensSkillPointer, buildStageSkillPointer } from "../../src/jwc-runtime/stage-skill-map";

const ORIGINAL_BRAND = process.env.GJC_BRAND_NAME;

function setJawBrand(on: boolean) {
	if (on) process.env.GJC_BRAND_NAME = "jwc";
	else delete process.env.GJC_BRAND_NAME;
}

afterEach(() => {
	if (ORIGINAL_BRAND === undefined) delete process.env.GJC_BRAND_NAME;
	else process.env.GJC_BRAND_NAME = ORIGINAL_BRAND;
});

describe("applyCliJawDevVocabularyMap (056 contract)", () => {
	it("maps orchestrate stages to lowercase jwc commands", () => {
		expect(applyCliJawDevVocabularyMap("run `cli-jaw orchestrate I` first")).toContain("jwc orchestrate i");
		expect(applyCliJawDevVocabularyMap("then cli-jaw orchestrate P")).toContain("jwc orchestrate p");
	});

	it("maps orchestrate reset to the native reset verb (99.07 U1)", () => {
		expect(applyCliJawDevVocabularyMap("cli-jaw orchestrate reset")).toBe("jwc orchestrate reset");
	});

	it("degrades server-only surfaces with an explicit note, never silently", () => {
		const out = applyCliJawDevVocabularyMap("Use cli-jaw bgtask add --preset web-ai --session $SID for waits");
		expect(out).toContain("[jwc: unavailable —");
		expect(out).not.toContain("cli-jaw bgtask");

		const dispatch = applyCliJawDevVocabularyMap('cli-jaw dispatch --agent "Backend" --task "audit"');
		expect(dispatch).toContain("[jwc: unavailable —");
		expect(dispatch).toContain("task subagent");
	});

	it("preserves ~/.cli-jaw path literals", () => {
		const text = "skills live under ~/.cli-jaw/skills/dev/SKILL.md";
		expect(applyCliJawDevVocabularyMap(text)).toBe(text);
	});

	it("maps commands inside fenced code but applies role vocabulary to prose only", () => {
		const body = ["The Boss decides.", "```bash", "cli-jaw orchestrate I  # Boss runs this", "```"].join("\n");
		const out = applyCliJawDevVocabularyMap(body);
		expect(out).toContain("The main session decides.");
		expect(out).toContain("jwc orchestrate i");
		expect(out).toContain("# Boss runs this");
	});

	it("maps goal/memory/chat verbs to the jwc surface", () => {
		expect(applyCliJawDevVocabularyMap("save with cli-jaw memory search foo")).toContain("jwc memory search foo");
		expect(applyCliJawDevVocabularyMap("then cli-jaw goal update")).toContain("jwc goal update");
	});

	it("identifies cli-jaw skill paths", () => {
		expect(isCliJawSkillPath(`${os.homedir()}/.cli-jaw/skills/dev/SKILL.md`)).toBe(true);
		expect(isCliJawSkillPath("/repo/packages/coding-agent/src/defaults/jwc/skills/team/SKILL.md")).toBe(false);
	});
});

describe("stage skill pointers (057 P10)", () => {
	let root: string;

	beforeEach(() => {
		root = mkdtempSync(path.join(os.tmpdir(), "stage-skill-"));
		for (const name of ["dev", "dev-architecture", "dev-testing"]) {
			mkdirSync(path.join(root, name), { recursive: true });
			writeFileSync(path.join(root, name, "SKILL.md"), `---\nname: ${name}\n---\nbody`);
		}
	});

	afterEach(() => {
		rmSync(root, { recursive: true, force: true });
	});

	it("points stage p at existing dev skills under the jaw brand", () => {
		setJawBrand(true);
		const pointer = buildStageSkillPointer("p", root);
		expect(pointer).toContain("/skill:dev");
		expect(pointer).toContain("/skill:dev-architecture");
	});

	it("skips absent skills and returns null when none exist", () => {
		setJawBrand(true);
		// stage a wants dev-code-reviewer, which is not installed in this root
		expect(buildStageSkillPointer("a", root)).toBeNull();
		expect(buildStageSkillPointer("c", root)).toContain("/skill:dev-testing");
	});

	it("continues to point stage prompts at available dev skills outside the jaw brand", () => {
		setJawBrand(false);
		expect(buildStageSkillPointer("p", root)).toContain("/skill:dev");
	});

	it("points audit lenses at their dev skills", () => {
		setJawBrand(true);
		expect(buildAuditLensSkillPointer("architect", root)).toContain("/skill:dev-architecture");
		expect(buildAuditLensSkillPointer("planner", root)).toContain("/skill:dev");
	});
});
