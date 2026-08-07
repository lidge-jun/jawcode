/**
 * `JWC_PY` is the spelling JWC's own docs tell operators to use.
 *
 * The eval backend selector reads `$env.PI_PY` / `$flag("PI_PY")`
 * (`packages/coding-agent/src/tools/index.ts`). Before the env alias layer
 * covered `PI_*`, setting the documented `JWC_PY` did nothing at all, so an
 * operator who disabled the Python backend per the docs still got it.
 *
 * This asserts the selector's own expression in a child process, because the
 * mirror runs once at module load.
 */
import { describe, expect, it } from "bun:test";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";

/**
 * Evaluate the eval-selector env expression under `env` in a fresh process.
 *
 * The probe script is written INSIDE the repo, not into a temp directory:
 * from an unrelated cwd Bun resolves `@jawcode-dev/utils` out of the install
 * cache — a published build — and the probe would silently measure the wrong
 * module instead of this worktree's source.
 */
function readSelectorEnv(env: Record<string, string>): { python: boolean; raw: string | null } {
	const dir = fs.mkdtempSync(path.join(import.meta.dir, ".tmp-eval-env-"));
	try {
		const scriptPath = path.join(dir, "probe.ts");
		fs.writeFileSync(
			scriptPath,
			[
				`import { $env, $flag } from "@jawcode-dev/utils";`,
				// Mirrors getEvalBackendsFromEnv() in src/tools/index.ts.
				`const raw = $env.PI_PY;`,
				`console.log(JSON.stringify({ python: raw === undefined ? true : $flag("PI_PY"), raw: raw ?? null }));`,
			].join("\n"),
		);
		const result = Bun.spawnSync({
			cmd: [process.execPath, scriptPath],
			cwd: path.join(import.meta.dir, ".."),
			env: { HOME: os.homedir(), PATH: Bun.env.PATH ?? "", ...env },
			stdout: "pipe",
			stderr: "pipe",
		});
		const stdout = new TextDecoder().decode(result.stdout);
		if (result.exitCode !== 0) {
			throw new Error(`${stdout}\n${new TextDecoder().decode(result.stderr)}`);
		}
		return JSON.parse(stdout.trim()) as { python: boolean; raw: string | null };
	} finally {
		fs.rmSync(dir, { force: true, recursive: true });
	}
}

describe("documented JWC_PY reaches the eval backend selector", () => {
	it("disables the python backend when the documented spelling says so", () => {
		expect(readSelectorEnv({ JWC_PY: "0" })).toEqual({ python: false, raw: "0" });
	});

	it("enables it for a truthy documented value", () => {
		expect(readSelectorEnv({ JWC_PY: "1" }).python).toBe(true);
	});

	it("leaves the selector unset when neither spelling is present", () => {
		expect(readSelectorEnv({}).raw).toBeNull();
	});
});
