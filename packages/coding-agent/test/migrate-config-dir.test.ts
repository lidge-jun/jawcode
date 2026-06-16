import { describe, expect, it } from "bun:test";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { migrateConfigDirOnce, remapLegacySessionFileEnv } from "../src/migrate-config-dir";

function tempHome(): string {
	return mkdtempSync(path.join(os.tmpdir(), "jwc-migrate-"));
}

describe("migrateConfigDirOnce (061.1 M4 — .gjc → .jwc)", () => {
	it("renames a legacy dir, preserves content, and leaves a sentinel", () => {
		const home = tempHome();
		mkdirSync(path.join(home, ".gjc", "state"), { recursive: true });
		writeFileSync(path.join(home, ".gjc", "state", "x.json"), "{}");

		const result = migrateConfigDirOnce({ cwd: home, targetDirName: ".jwc", home });
		expect(result.user).toBe("migrated");
		expect(readFileSync(path.join(home, ".jwc", "state", "x.json"), "utf8")).toBe("{}");
		expect(existsSync(path.join(home, ".gjc", ".jwc-migrated"))).toBe(true);
	});

	it("is idempotent — skips when the target already exists", () => {
		const home = tempHome();
		mkdirSync(path.join(home, ".jwc"), { recursive: true });
		mkdirSync(path.join(home, ".gjc"), { recursive: true });
		const result = migrateConfigDirOnce({ cwd: home, targetDirName: ".jwc", home });
		expect(result.user).toBe("skipped");
		expect(existsSync(path.join(home, ".gjc"))).toBe(true);
	});

	it("skips cleanly when nothing legacy exists", () => {
		const home = tempHome();
		const result = migrateConfigDirOnce({ cwd: home, targetDirName: ".jwc", home });
		expect(result.user).toBe("skipped");
		expect(result.project).toBe("skipped");
	});

	it("migrates the project dir separately from the user dir", () => {
		const home = tempHome();
		const project = tempHome();
		mkdirSync(path.join(project, ".gjc"), { recursive: true });
		writeFileSync(path.join(project, ".gjc", "settings.json"), "{}");
		const result = migrateConfigDirOnce({ cwd: project, targetDirName: ".jwc", home });
		expect(result.project).toBe("migrated");
		expect(existsSync(path.join(project, ".jwc", "settings.json"))).toBe(true);
	});
});

describe("remapLegacySessionFileEnv (061.1 §4-2 — stale absolute session paths)", () => {
	it("repoints env vars into the migrated dir when the file exists there", () => {
		const home = tempHome();
		mkdirSync(path.join(home, ".jwc", "agent", "sessions"), { recursive: true });
		writeFileSync(path.join(home, ".jwc", "agent", "sessions", "s.jsonl"), "");
		const env: Record<string, string | undefined> = {
			GJC_SESSION_FILE: path.join(home, ".gjc", "agent", "sessions", "s.jsonl"),
		};
		remapLegacySessionFileEnv({ targetDirName: ".jwc", home, env });
		expect(env.GJC_SESSION_FILE).toBe(path.join(home, ".jwc", "agent", "sessions", "s.jsonl"));
	});

	it("leaves env untouched when the migrated file is missing or path is foreign", () => {
		const home = tempHome();
		const foreign = path.join(home, "elsewhere", "s.jsonl");
		const stale = path.join(home, ".gjc", "agent", "sessions", "missing.jsonl");
		const env: Record<string, string | undefined> = { GJC_SESSION_FILE: stale, JWC_SESSION_FILE: foreign };
		remapLegacySessionFileEnv({ targetDirName: ".jwc", home, env });
		expect(env.GJC_SESSION_FILE).toBe(stale);
		expect(env.JWC_SESSION_FILE).toBe(foreign);
	});
});
