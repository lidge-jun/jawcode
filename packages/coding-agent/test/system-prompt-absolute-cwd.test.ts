/**
 * The provider-facing working directory must stay ABSOLUTE.
 *
 * `shortenPath` rewrites a home-relative path to `~/…`, which is display sugar
 * for a human reading a terminal. Handing it to the model makes every path the
 * model derives home-relative, and any tool that resolves those literally then
 * fails — the project directory it was told about does not exist.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "bun:test";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { resetSettingsForTest, Settings } from "@jawcode-dev/coding-agent/config/settings";
import { buildSystemPrompt } from "@jawcode-dev/coding-agent/system-prompt";
import { cleanupTempHome } from "./helpers/temp-home-cleanup";

describe("provider-facing working directory", () => {
	let tempHomeDir = "";
	let projectDir = "";
	let originalHome: string | undefined;

	beforeEach(async () => {
		tempHomeDir = fs.mkdtempSync(path.join(os.tmpdir(), "jwc-cwd-home-"));
		// The project lives UNDER the home directory: that is the only shape where
		// shortenPath would rewrite it, so it is the shape worth testing.
		projectDir = path.join(tempHomeDir, "Developer", "proj");
		fs.mkdirSync(projectDir, { recursive: true });
		originalHome = process.env.HOME;
		process.env.HOME = tempHomeDir;
		vi.spyOn(os, "homedir").mockReturnValue(tempHomeDir);
		resetSettingsForTest();
		await Settings.init({ inMemory: true, cwd: projectDir, agentDir: tempHomeDir });
	});

	afterEach(() => {
		resetSettingsForTest();
		cleanupTempHome(() => ({ tempDir: projectDir, tempHomeDir, originalHome }))();
	});

	it("gives the model the absolute path, not a ~-shortened one", async () => {
		const { systemPrompt } = await buildSystemPrompt({ cwd: projectDir });
		const prompt = systemPrompt.join("\n");

		expect(prompt).toContain(projectDir);
		// A `~/Developer/proj` in the prompt is the regression.
		expect(prompt).not.toContain(`~${path.sep}Developer`);
	});
});
