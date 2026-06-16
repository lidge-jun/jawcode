import { afterEach, beforeEach, describe, expect, it, vi } from "bun:test";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { resetSettingsForTest, Settings, settings } from "@jawcode-dev/coding-agent/config/settings";
import { buildSystemPrompt, renderIdentityBlock } from "@jawcode-dev/coding-agent/system-prompt";
import { cleanupTempHome } from "./helpers/temp-home-cleanup";

describe("identity block rendering", () => {
	let tempDir = "";
	let tempHomeDir = "";
	let originalHome: string | undefined;

	beforeEach(async () => {
		tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "gjc-identity-"));
		tempHomeDir = fs.mkdtempSync(path.join(os.tmpdir(), "gjc-identity-home-"));
		originalHome = process.env.HOME;
		process.env.HOME = tempHomeDir;
		vi.spyOn(os, "homedir").mockReturnValue(tempHomeDir);
		resetSettingsForTest();
		await Settings.init({ inMemory: true, cwd: tempDir, agentDir: tempHomeDir });
	});

	afterEach(() => {
		resetSettingsForTest();
		cleanupTempHome(() => ({ tempDir, tempHomeDir, originalHome }))();
	});

	it("returns null when settings singleton is not initialized (bare SDK path)", () => {
		resetSettingsForTest();
		expect(renderIdentityBlock()).toBeNull();
	});

	it("returns null when no identity field is set", () => {
		expect(renderIdentityBlock()).toBeNull();
	});

	it("renders name, emoji, vibe lines, and language when set", () => {
		settings.set("identity.name", "Jaw");
		settings.set("identity.emoji", "🦈");
		settings.set("identity.vibe", "warm and friendly; technically accurate");
		settings.set("identity.language", "Korean");

		const block = renderIdentityBlock();
		expect(block).not.toBeNull();
		expect(block).toContain("# Identity");
		expect(block).toContain("- Name: Jaw 🦈");
		expect(block).toContain("## Vibe");
		expect(block).toContain("- warm and friendly");
		expect(block).toContain("- technically accurate");
		expect(block).toContain("Respond in Korean");
	});

	it("renders only the lines for fields that are set", () => {
		settings.set("identity.language", "English");
		const block = renderIdentityBlock();
		expect(block).not.toBeNull();
		expect(block).toContain("Respond in English");
		expect(block).not.toContain("- Name:");
		expect(block).not.toContain("## Vibe");
	});

	it("keeps the system prompt byte-identical when identity is unset (diff 0 invariant)", async () => {
		const projectDir = path.join(tempDir, "project");
		fs.mkdirSync(projectDir, { recursive: true });
		const workspaceTree = {
			rootPath: projectDir,
			rendered: "",
			truncated: false,
			totalLines: 0,
			agentsMdFiles: [],
		};
		const opts = { cwd: projectDir, skills: [], contextFiles: [], workspaceTree };

		const baseline = (await buildSystemPrompt(opts)).systemPrompt.join("\n");
		expect(baseline).not.toContain("# Identity");

		settings.set("identity.name", "Jaw");
		const withIdentity = (await buildSystemPrompt(opts)).systemPrompt.join("\n");
		expect(withIdentity).toContain("# Identity");
		expect(withIdentity).toContain("- Name: Jaw");

		settings.set("identity.name", undefined);
		const restored = (await buildSystemPrompt(opts)).systemPrompt.join("\n");
		expect(restored).toBe(baseline);
	});
});
