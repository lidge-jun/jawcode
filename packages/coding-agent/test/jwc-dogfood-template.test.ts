import { describe, expect, it } from "bun:test";
import * as path from "node:path";

const repoRoot = path.resolve(import.meta.dir, "..", "..", "..");
const expectedWorkflowSkills = ["goal", "jaw-interview", "plan", "team"];

describe("JWC dogfood skill template", () => {
	it("documents local override installation without changing the default workflow surface", async () => {
		const template = await Bun.file(path.join(repoRoot, "docs", "jwc-dogfood-skill-template.md")).text();
		const defaultSkillsDir = path.join(repoRoot, "packages", "coding-agent", "src", "defaults", "jwc", "skills");
		const defaultSkillEntries = await Array.fromAsync(new Bun.Glob("*/SKILL.md").scan(defaultSkillsDir));
		const defaultSkillNames = defaultSkillEntries
			.map(entry => entry.split("/")[0])
			.filter(name => !["browse", "search"].includes(name))
			.sort();

		expect(defaultSkillNames).toEqual(expectedWorkflowSkills);
		expect(template).toContain("~/.jwc/skills/jwc-dogfood/SKILL.md");
		expect(template).toContain("<project>/.jwc/skills/jwc-dogfood/SKILL.md");
		expect(template).toContain("The live issue has no comment approving a fifth bundled default workflow skill");
		expect(template).toContain("Use when running or reviewing work through jwc sessions");
		expect(template).toContain("jwc --tmux --worktree <path>");
		expect(template).toContain("jawcode-93-dogfood-skill");
		expect(template).toContain("Verify the prompt was accepted");
		expect(template).toContain("create or link the Jawcode issue");
	});
});
