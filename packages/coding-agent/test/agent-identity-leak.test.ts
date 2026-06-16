import { afterEach, beforeEach, describe, expect, it, vi } from "bun:test";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { resetSettingsForTest, Settings, settings } from "@jawcode-dev/coding-agent/config/settings";
import { renderIdentityBlock } from "@jawcode-dev/coding-agent/system-prompt";
import { resolveAgentDisplayName } from "../src/jwc-runtime/agent-identity";
import { cleanupTempHome } from "./helpers/temp-home-cleanup";

const repoRoot = path.resolve(import.meta.dir, "..");
const systemPromptPath = path.join(repoRoot, "src", "prompts", "system", "system-prompt.md");

describe("agent identity leak zero (085.6)", () => {
	let tempDir = "";
	let tempHomeDir = "";
	let originalHome: string | undefined;

	beforeEach(async () => {
		tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "jwc-identity-leak-"));
		tempHomeDir = fs.mkdtempSync(path.join(os.tmpdir(), "jwc-identity-leak-home-"));
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

	it("system prompt source carries the Jaw identity, not GJC prose", async () => {
		const template = await Bun.file(systemPromptPath).text();
		expect(template).toContain("You are Jaw, the coding agent running on the jwc runtime (Jawcode).");
		expect(template).toContain("<jawcode-system-prompt>");
		expect(template).not.toContain("You are GJC");
		expect(template).not.toContain("Gajae Code");
		// Prose-level GJC must be gone; functional identifiers (.jwc paths,
		// defaults/gjc dir) are the preservation boundary and may remain.
		const prose = template
			.split("\n")
			.filter(line => !line.includes(".jwc") && !line.includes("defaults/gjc"))
			.join("\n");
		expect(prose).not.toMatch(/\bGJC\b/);
	});

	it("falls back to Jaw when settings are not initialized", () => {
		resetSettingsForTest();
		expect(resolveAgentDisplayName()).toBe("Jaw");
	});

	it("prefers identity.name and renders the override line", () => {
		settings.set("identity.name", "별이");
		expect(resolveAgentDisplayName()).toBe("별이");
		const block = renderIdentityBlock();
		expect(block).toContain("- Name: 별이");
		expect(block).toContain("overrides the default agent name");
	});

	it("renders no override line when only vibe is set", () => {
		settings.set("identity.vibe", "friendly; concise");
		expect(resolveAgentDisplayName()).toBe("Jaw");
		const block = renderIdentityBlock();
		expect(block).toContain("## Vibe");
		expect(block).not.toContain("overrides the default agent name");
	});
});
