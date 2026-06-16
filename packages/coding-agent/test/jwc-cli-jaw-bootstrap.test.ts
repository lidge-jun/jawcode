import { afterEach, describe, expect, it } from "bun:test";
import { spawnSync } from "node:child_process";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";

const repoRoot = path.resolve(import.meta.dir, "../../..");
const bootstrapScript = path.join(repoRoot, "packages", "jwc", "scripts", "bootstrap-cli-jaw-home.cjs");

const tempRoots: string[] = [];

interface BootstrapJson {
	ok?: boolean;
	skills?: {
		status?: string;
	};
}

afterEach(() => {
	for (const root of tempRoots.splice(0)) fs.rmSync(root, { recursive: true, force: true });
});

function tempRoot(label: string): string {
	const dir = fs.mkdtempSync(path.join(os.tmpdir(), `jwc-${label}-`));
	tempRoots.push(dir);
	return dir;
}

function writeSkill(baseDir: string, name: string, category = "orchestration"): void {
	const dir = path.join(baseDir, name);
	fs.mkdirSync(path.join(dir, "node_modules", "left-pad"), { recursive: true });
	fs.writeFileSync(path.join(dir, "SKILL.md"), `---\nname: ${name}\ndescription: ${name} skill\n---\n\n# ${name}\n`);
	fs.writeFileSync(path.join(dir, "node_modules", "left-pad", "index.js"), "module.exports = 1;\n");
	const registryPath = path.join(baseDir, "registry.json");
	const registry = fs.existsSync(registryPath) ? JSON.parse(fs.readFileSync(registryPath, "utf8")) : { skills: {} };
	registry.skills[name] = { version: "1.0.0", category };
	fs.writeFileSync(registryPath, `${JSON.stringify(registry, null, "\t")}\n`);
}

function runBootstrap(args: string[], env: NodeJS.ProcessEnv): { json: BootstrapJson; status: number; output: string } {
	const result = spawnSync(process.execPath, [bootstrapScript, ...args, "--json"], {
		cwd: repoRoot,
		env: {
			...process.env,
			CI: "",
			JWC_SAFE: "",
			JWC_SKIP_CLI_JAW_BOOTSTRAP: "",
			...env,
		},
		encoding: "utf8",
	});
	const output = `${result.stdout ?? ""}${result.stderr ?? ""}`;
	let json: BootstrapJson = {};
	try {
		json = JSON.parse(result.stdout || "{}") as BootstrapJson;
	} catch {
		// Keep the empty object; assertions below include full output.
	}
	return { json, status: result.status ?? 1, output };
}

describe("jawcode cli-jaw home bootstrap", () => {
	it("creates a cli-jaw-compatible non-secret baseline from a skills fixture", () => {
		const root = tempRoot("bootstrap");
		const home = path.join(root, "cli-jaw-home");
		const fixture = path.join(root, "skills-fixture");
		writeSkill(fixture, "github", "orchestration");

		const result = runBootstrap(["--postinstall"], {
			CLI_JAW_HOME: home,
			JWC_CLI_JAW_SKILLS_SOURCE_DIR: fixture,
		});

		expect(result.status, result.output).toBe(0);
		expect(result.json.ok).toBe(true);
		const settings = JSON.parse(fs.readFileSync(path.join(home, "settings.json"), "utf8"));
		expect(settings.cli).toBe("codex");
		expect(settings.workingDir).toBe(home);
		expect(settings.jawCeo.openaiApiKey).toBe("");
		expect(settings.stt.openaiApiKey).toBe("");
		expect(settings.pi.profiles[0].apiKey).toBe("dummy");
		expect(JSON.parse(fs.readFileSync(path.join(home, "heartbeat.json"), "utf8"))).toEqual({ jobs: [] });
		expect(JSON.parse(fs.readFileSync(path.join(home, "mcp.json"), "utf8"))).toEqual({ servers: {} });
		expect(fs.existsSync(path.join(home, "skills_ref", "registry.json"))).toBe(true);
		expect(fs.existsSync(path.join(home, "skills", "github", "SKILL.md"))).toBe(true);
		expect(fs.existsSync(path.join(home, "skills_ref", "github", "node_modules"))).toBe(false);
		expect(fs.existsSync(path.join(home, "skills", "github", "node_modules"))).toBe(false);
	});

	it("preserves existing settings byte-for-byte", () => {
		const root = tempRoot("preserve");
		const home = path.join(root, "cli-jaw-home");
		const fixture = path.join(root, "skills-fixture");
		fs.mkdirSync(home, { recursive: true });
		const existing = '{"cli":"existing","token":"keep"}\n';
		fs.writeFileSync(path.join(home, "settings.json"), existing);
		writeSkill(fixture, "github");

		const result = runBootstrap(["--postinstall"], {
			CLI_JAW_HOME: home,
			JWC_CLI_JAW_SKILLS_SOURCE_DIR: fixture,
		});

		expect(result.status, result.output).toBe(0);
		expect(fs.readFileSync(path.join(home, "settings.json"), "utf8")).toBe(existing);
	});

	it("safe mode seeds files but skips network and skill activation", () => {
		const root = tempRoot("safe");
		const home = path.join(root, "cli-jaw-home");

		const result = runBootstrap(["--postinstall"], {
			CLI_JAW_HOME: home,
			JWC_SAFE: "1",
		});

		expect(result.status, result.output).toBe(0);
		expect(fs.existsSync(path.join(home, "settings.json"))).toBe(true);
		expect(fs.existsSync(path.join(home, "heartbeat.json"))).toBe(true);
		expect(fs.existsSync(path.join(home, "mcp.json"))).toBe(true);
		expect(result.json.skills?.status).toBe("safe-skipped");
		expect(fs.existsSync(path.join(home, "skills", "github"))).toBe(false);
	});

	it("does not leave an empty active skills root when skills fetch fails during postinstall", () => {
		const root = tempRoot("fetch-fail");
		const home = path.join(root, "cli-jaw-home");

		const result = runBootstrap(["--postinstall"], {
			CLI_JAW_HOME: home,
			JWC_CLI_JAW_SKILLS_REPO: path.join(root, "missing-skills-repo"),
		});

		expect(result.status, result.output).toBe(0);
		expect(fs.existsSync(path.join(home, "settings.json"))).toBe(true);
		expect(result.json.skills?.status).toBe("failed-nonfatal");
		expect(fs.existsSync(path.join(home, "skills"))).toBe(false);
		expect(fs.existsSync(path.join(home, "skills_ref"))).toBe(false);
	});

	it("safe mode activates already downloaded skills without network", () => {
		const root = tempRoot("safe-existing-ref");
		const home = path.join(root, "cli-jaw-home");
		writeSkill(path.join(home, "skills_ref"), "github", "orchestration");

		const result = runBootstrap(["--postinstall"], {
			CLI_JAW_HOME: home,
			JWC_SAFE: "1",
		});

		expect(result.status, result.output).toBe(0);
		expect(result.json.skills?.status).toBe("safe-skipped");
		expect(fs.existsSync(path.join(home, "skills", "github", "SKILL.md"))).toBe(true);
	});

	it("skip mode creates only the home directory during postinstall", () => {
		const root = tempRoot("skip");
		const home = path.join(root, "cli-jaw-home");

		const result = runBootstrap(["--postinstall"], {
			CLI_JAW_HOME: home,
			JWC_SKIP_CLI_JAW_BOOTSTRAP: "1",
		});

		expect(result.status, result.output).toBe(0);
		expect(fs.existsSync(home)).toBe(true);
		expect(fs.existsSync(path.join(home, "settings.json"))).toBe(false);
		expect(result.json.skills?.status).toBe("skipped");
	});
});
