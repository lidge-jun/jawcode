import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { Settings } from "@gajae-code/coding-agent/config/settings";
import { DEFAULT_JWC_DEFINITION_NAMES } from "@gajae-code/coding-agent/defaults/jwc-defaults";
import type { Skill } from "@gajae-code/coding-agent/sdk";
import { createAgentSession } from "@gajae-code/coding-agent/sdk";
import { SessionManager } from "@gajae-code/coding-agent/session/session-manager";
import { buildSystemPrompt } from "@gajae-code/coding-agent/system-prompt";
import { cleanupTempHome } from "./helpers/temp-home-cleanup";

function createIsolatedSkillsSettings(): Settings {
	return Settings.isolated({
		"skills.enabled": true,
		"skills.enableCodexUser": false,
		"skills.enableClaudeUser": false,
		"skills.enableClaudeProject": false,
		"skills.enablePiUser": false,
		"skills.enablePiProject": true,
	});
}

function writeCliJawSkill(cliJawHome: string, name: string): void {
	const skillDir = path.join(cliJawHome, "skills", name);
	fs.mkdirSync(skillDir, { recursive: true });
	fs.writeFileSync(
		path.join(skillDir, "SKILL.md"),
		`---
name: ${name}
description: ${name} global skill.
---

# ${name}
`,
	);
}

describe("createAgentSession skills option", () => {
	let tempDir: string;
	let skillsDir: string;
	let tempHomeDir = "";
	let originalHome: string | undefined;
	let originalCliJawHome: string | undefined;

	beforeEach(() => {
		tempDir = path.join(os.tmpdir(), `gjc-sdk-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
		// Create skill in .jwc/skills/ for native project-level discovery.
		skillsDir = path.join(tempDir, ".jwc", "skills", "test-skill");
		fs.mkdirSync(skillsDir, { recursive: true });
		originalHome = process.env.HOME;
		originalCliJawHome = process.env.CLI_JAW_HOME;
		tempHomeDir = fs.mkdtempSync(path.join(os.tmpdir(), "gjc-sdk-home-"));
		process.env.HOME = tempHomeDir;
		process.env.CLI_JAW_HOME = path.join(tempHomeDir, ".cli-jaw");
		const nativeUserSkillsDir = path.join(tempHomeDir, ".jwc", "agent", "skills");
		fs.mkdirSync(nativeUserSkillsDir, { recursive: true });

		// Create a test skill in the native GJC skills directory
		fs.writeFileSync(
			path.join(skillsDir, "SKILL.md"),
			`---
name: test-skill
description: A test skill for SDK tests.
---

# Test Skill

This is a test skill.
`,
		);

		const externalSkillDir = path.join(tempDir, "external-symlinked-skill");
		fs.mkdirSync(externalSkillDir, { recursive: true });
		fs.writeFileSync(
			path.join(externalSkillDir, "SKILL.md"),
			`---
name: symlinked-skill
description: Skill loaded through a symlink.
---

# Symlinked Skill

Loaded via symbolic link.
`,
		);
		fs.symlinkSync(externalSkillDir, path.join(path.dirname(skillsDir), "symlinked-skill-link"), "dir");
	});

	afterEach(() => {
		if (originalCliJawHome === undefined) delete process.env.CLI_JAW_HOME;
		else process.env.CLI_JAW_HOME = originalCliJawHome;
		cleanupTempHome(() => ({ tempDir, tempHomeDir, originalHome }))();
	});

	it("loads embedded default GJC workflow skills even when .jwc is absent and arbitrary skill discovery is disabled", async () => {
		fs.rmSync(path.join(tempDir, ".jwc"), { recursive: true, force: true });
		const { session } = await createAgentSession({
			cwd: tempDir,
			agentDir: tempDir,
			sessionManager: SessionManager.inMemory(),
			settings: Settings.isolated({ "skills.enabled": false }),
		});
		const expected = [...DEFAULT_JWC_DEFINITION_NAMES].sort();

		expect(session.skills.map(skill => skill.name).sort()).toEqual(expected);
		expect(session.skills.every(skill => skill.filePath.startsWith("embedded:jwc/skills/"))).toBe(true);
	}, 15_000);

	it("should discover skills by default and expose them on session.skills", async () => {
		const { session } = await createAgentSession({
			cwd: tempDir,
			agentDir: tempDir,
			sessionManager: SessionManager.inMemory(),
			settings: createIsolatedSkillsSettings(),
		});

		// Skills should be discovered and exposed on the session
		expect(session.skills.length).toBeGreaterThan(0);
		expect(session.skills.some((s: Skill) => s.name === "test-skill")).toBe(true);
	});

	it("should discover skills when skill directory is a symlink", async () => {
		const { session } = await createAgentSession({
			cwd: tempDir,
			agentDir: tempDir,
			sessionManager: SessionManager.inMemory(),
			settings: createIsolatedSkillsSettings(),
		});

		expect(session.skills.some((s: Skill) => s.name === "symlinked-skill")).toBe(true);
	});

	it("should still discover project skills when user skills directory is missing", async () => {
		const userAgentDir = path.join(tempHomeDir, ".jwc", "agent");
		fs.rmSync(path.join(userAgentDir, "skills"), { recursive: true, force: true });
		fs.writeFileSync(path.join(userAgentDir, "placeholder.txt"), "placeholder");

		const { session } = await createAgentSession({
			cwd: tempDir,
			agentDir: tempDir,
			sessionManager: SessionManager.inMemory(),
			settings: createIsolatedSkillsSettings(),
		});

		expect(session.skills.some((s: Skill) => s.name === "test-skill")).toBe(true);
	});
	it("keeps bundled GJC workflow skills even when options.skills is empty", async () => {
		const { session } = await createAgentSession({
			cwd: tempDir,
			agentDir: tempDir,
			sessionManager: SessionManager.inMemory(),
			skills: [],
			settings: createIsolatedSkillsSettings(),
		});

		expect(session.skills.map(skill => skill.name).sort()).toEqual([...DEFAULT_JWC_DEFINITION_NAMES].sort());
		expect(session.skillWarnings).toEqual([]);
	});

	it("merges cli-jaw global dev skills when options.skills is explicitly empty", async () => {
		const originalGjcBrand = process.env.GJC_BRAND_NAME;
		const originalJwcBrand = process.env.JWC_BRAND_NAME;
		const originalCliJawHome = process.env.CLI_JAW_HOME;
		const cliJawHome = path.join(tempHomeDir, ".cli-jaw");

		writeCliJawSkill(cliJawHome, "dev");
		writeCliJawSkill(cliJawHome, "dev-backend");
		writeCliJawSkill(cliJawHome, "memory");
		writeCliJawSkill(cliJawHome, "dev-pabcd");
		process.env.GJC_BRAND_NAME = "jwc";
		delete process.env.JWC_BRAND_NAME;
		process.env.CLI_JAW_HOME = cliJawHome;

		try {
			const { session } = await createAgentSession({
				cwd: tempDir,
				agentDir: tempDir,
				sessionManager: SessionManager.inMemory(),
				skills: [],
				settings: createIsolatedSkillsSettings(),
			});

			const skillNames = session.skills.map(skill => skill.name);
			expect(skillNames).toContain("dev");
			expect(skillNames).toContain("dev-backend");
			expect(skillNames).not.toContain("memory");
			expect(skillNames).not.toContain("dev-pabcd");
			expect(session.skills.find(skill => skill.name === "dev")?.source).toBe("cli-jaw:user");
			expect(session.skills.find(skill => skill.name === "dev")?.filePath).toBe(
				path.join(cliJawHome, "skills", "dev", "SKILL.md"),
			);
			const renderedPrompt = session.systemPrompt.join("\n");
			expect(renderedPrompt).toContain("<dev-skill-routing>");
			expect(renderedPrompt).toContain("/skill:dev");
			expect(renderedPrompt).toContain(
				`<skill name="dev" path="${path.join(cliJawHome, "skills", "dev", "SKILL.md")}">`,
			);
			for (const name of DEFAULT_JWC_DEFINITION_NAMES) {
				expect(skillNames).toContain(name);
			}
			expect(session.skillWarnings).toEqual([]);
		} finally {
			if (originalGjcBrand === undefined) delete process.env.GJC_BRAND_NAME;
			else process.env.GJC_BRAND_NAME = originalGjcBrand;
			if (originalJwcBrand === undefined) delete process.env.JWC_BRAND_NAME;
			else process.env.JWC_BRAND_NAME = originalJwcBrand;
			if (originalCliJawHome === undefined) delete process.env.CLI_JAW_HOME;
			else process.env.CLI_JAW_HOME = originalCliJawHome;
		}
	});

	it("merges cli-jaw global dev skills when system prompt is built with explicit skills", async () => {
		const originalGjcBrand = process.env.GJC_BRAND_NAME;
		const originalJwcBrand = process.env.JWC_BRAND_NAME;
		const originalCliJawHome = process.env.CLI_JAW_HOME;
		const cliJawHome = path.join(tempHomeDir, ".cli-jaw");

		writeCliJawSkill(cliJawHome, "dev");
		writeCliJawSkill(cliJawHome, "dev-backend");
		process.env.GJC_BRAND_NAME = "jwc";
		delete process.env.JWC_BRAND_NAME;
		process.env.CLI_JAW_HOME = cliJawHome;

		try {
			const { systemPrompt } = await buildSystemPrompt({
				cwd: tempDir,
				contextFiles: [],
				skills: [],
				skillsSettings: {
					enabled: true,
					enableCodexUser: false,
					enableClaudeUser: false,
					enableClaudeProject: false,
					enablePiUser: false,
					enablePiProject: false,
					customDirectories: [],
					ignoredSkills: [],
					includeSkills: [],
				},
				rules: [],
				toolNames: ["read"],
				workspaceTree: {
					rootPath: tempDir,
					rendered: "",
					truncated: false,
					totalLines: 0,
					agentsMdFiles: [],
				},
			});

			const renderedPrompt = systemPrompt.join("\n");
			expect(renderedPrompt).toContain("<dev-skill-routing>");
			expect(renderedPrompt).toContain("/skill:dev");
			expect(renderedPrompt).toContain("/skill:dev-backend");
		} finally {
			if (originalGjcBrand === undefined) delete process.env.GJC_BRAND_NAME;
			else process.env.GJC_BRAND_NAME = originalGjcBrand;
			if (originalJwcBrand === undefined) delete process.env.JWC_BRAND_NAME;
			else process.env.JWC_BRAND_NAME = originalJwcBrand;
			if (originalCliJawHome === undefined) delete process.env.CLI_JAW_HOME;
			else process.env.CLI_JAW_HOME = originalCliJawHome;
		}
	});

	it("should use provided skills plus bundled GJC workflow skills when options.skills is explicitly set", async () => {
		const customSkill: Skill = {
			name: "custom-skill",
			description: "A custom skill",
			filePath: "/fake/path/SKILL.md",
			baseDir: "/fake/path",
			source: "custom" as const,
		};

		const { session } = await createAgentSession({
			cwd: tempDir,
			agentDir: tempDir,
			sessionManager: SessionManager.inMemory(),
			skills: [customSkill],
			settings: createIsolatedSkillsSettings(),
		});

		expect(session.skills).toContainEqual(customSkill);
		for (const name of DEFAULT_JWC_DEFINITION_NAMES) {
			expect(session.skills.some(skill => skill.name === name)).toBe(true);
		}
		expect(session.skillWarnings).toEqual([]);
	});
});
