/**
 * The documented `JWC_*` spelling must actually reach the runtime.
 *
 * JWC's own reference (`environment-variables.md`, `python-repl.md`) advertises
 * `JWC_PY`, `JWC_PYTHON_SKIP_CHECK`, `JWC_FORCE_IMAGE_PROTOCOL` and friends,
 * but many read sites consume the older `PI_*` names directly
 * (`$env.PI_PY`, `$flag("PI_PYTHON_SKIP_CHECK")`). The load-time mirror only
 * covered `GJC_*`, so an operator who followed the docs set a variable nothing
 * read — a silent no-op rather than an error.
 *
 * These run in a child process because the mirror executes once at module load.
 */
import { describe, expect, it } from "bun:test";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";

/** Run `script` in a fresh Bun process with `env`, returning its stdout. */
function runWithEnv(script: string, env: Record<string, string>): string {
	const dir = fs.mkdtempSync(path.join(os.tmpdir(), "jwc-env-alias-"));
	try {
		const scriptPath = path.join(dir, "probe.ts");
		const envModule = pathToImport(path.join(import.meta.dir, "..", "src", "env.ts"));
		fs.writeFileSync(scriptPath, script.replace("__ENV_MODULE__", envModule));
		const result = Bun.spawnSync({
			cmd: [process.execPath, scriptPath],
			env: { HOME: os.homedir(), PATH: Bun.env.PATH ?? "", ...env },
			stdout: "pipe",
			stderr: "pipe",
		});
		const stdout = new TextDecoder().decode(result.stdout);
		if (result.exitCode !== 0) {
			throw new Error(`${stdout}\n${new TextDecoder().decode(result.stderr)}`);
		}
		return stdout.trim();
	} finally {
		fs.rmSync(dir, { force: true, recursive: true });
	}
}

function pathToImport(filePath: string): string {
	return filePath.replaceAll("\\", "/");
}

const PROBE = `
import { $env, $flag, $resolveEnv } from "__ENV_MODULE__";
console.log(JSON.stringify({
	piPy: $env.PI_PY ?? null,
	gjcPy: $env.GJC_PY ?? null,
	skipCheck: $flag("PI_PYTHON_SKIP_CHECK"),
	imageProtocol: $env.PI_FORCE_IMAGE_PROTOCOL ?? null,
	compiled: $env.PI_COMPILED ?? null,
	resolvedViaPi: $resolveEnv("PI_PY") ?? null,
}));
`;

function probe(env: Record<string, string>): Record<string, unknown> {
	return JSON.parse(runWithEnv(PROBE, env)) as Record<string, unknown>;
}

describe("JWC_* to legacy env mirroring", () => {
	it("makes a documented JWC_PY reach the PI_PY read site", () => {
		const out = probe({ JWC_PY: "py" });
		expect(out.piPy).toBe("py");
		// The pre-existing GJC_ mirror must keep working too.
		expect(out.gjcPy).toBe("py");
	});

	it("makes JWC_PYTHON_SKIP_CHECK reach its $flag read site", () => {
		expect(probe({ JWC_PYTHON_SKIP_CHECK: "1" }).skipCheck).toBe(true);
	});

	it("covers non-python variables too, since the break was systemic", () => {
		expect(probe({ JWC_FORCE_IMAGE_PROTOCOL: "sixel" }).imageProtocol).toBe("sixel");
	});

	it("never fabricates the build-injected compiled-binary marker", () => {
		// PI_COMPILED makes isCompiledBinary() true and selects compiled
		// worker-spawn paths; a stray JWC_COMPILED must not forge it.
		expect(probe({ JWC_COMPILED: "true" }).compiled).toBeNull();
	});

	it("does not overwrite an explicitly provided legacy value", () => {
		const out = probe({ JWC_PY: "py", PI_PY: "0" });
		expect(out.piPy).toBe("0");
	});

	it("resolves a PI_* key through the canonical name", () => {
		expect(probe({ JWC_PY: "py" }).resolvedViaPi).toBe("py");
	});

	it("honors JWC_ISOLATE_LEGACY_ENV, which exists for dual-install machines", () => {
		const out = probe({ JWC_PY: "py", JWC_ISOLATE_LEGACY_ENV: "1" });
		expect(out.piPy).toBeNull();
		expect(out.gjcPy).toBeNull();
	});
});
