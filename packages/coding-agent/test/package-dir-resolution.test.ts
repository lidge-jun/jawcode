/**
 * `getPackageDir` resolves where optional docs, examples and CHANGELOG live.
 *
 * Two things were wrong. The documented override name was ignored, and the
 * directory walk is meaningless inside a compiled binary — `import.meta.dir`
 * points into the embedded `$bunfs` filesystem, where there is no
 * `package.json`, so the walk ran to the filesystem root and fell through to
 * the user's cwd as though that were the package directory.
 *
 * Child processes are used because `$env` mirroring happens once at module
 * load, so the override cannot be toggled in-process.
 */
import { describe, expect, it } from "bun:test";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";

const CONFIG_SOURCE = path.join(import.meta.dir, "..", "src", "config.ts");

/** Resolve `getPackageDir()` in a fresh process with `env` applied. */
function resolveIn(env: Record<string, string>): string {
	const dir = fs.mkdtempSync(path.join(import.meta.dir, ".tmp-pkgdir-"));
	try {
		const script = path.join(dir, "probe.ts");
		fs.writeFileSync(
			script,
			[`import { getPackageDir } from "@jawcode-dev/coding-agent/config";`, `console.log(getPackageDir());`].join(
				"\n",
			),
		);
		const result = Bun.spawnSync({
			cmd: [process.execPath, script],
			cwd: path.join(import.meta.dir, ".."),
			env: { HOME: os.homedir(), PATH: Bun.env.PATH ?? "", ...env },
			stdout: "pipe",
			stderr: "pipe",
		});
		const stdout = new TextDecoder().decode(result.stdout).trim();
		if (result.exitCode !== 0) throw new Error(`${stdout}\n${new TextDecoder().decode(result.stderr)}`);
		return stdout;
	} finally {
		fs.rmSync(dir, { force: true, recursive: true });
	}
}

describe("package dir resolution", () => {
	it("honors the documented JWC_PACKAGE_DIR override", () => {
		// This is the name docs/environment-variables.md tells operators to use.
		expect(resolveIn({ JWC_PACKAGE_DIR: "/tmp/jwc-package-override" })).toBe("/tmp/jwc-package-override");
	});

	it("still honors the legacy spellings", () => {
		expect(resolveIn({ GJC_PACKAGE_DIR: "/tmp/gjc-override" })).toBe("/tmp/gjc-override");
		expect(resolveIn({ PI_PACKAGE_DIR: "/tmp/pi-override" })).toBe("/tmp/pi-override");
	});

	it("prefers the canonical name over a legacy one", () => {
		const resolved = resolveIn({ JWC_PACKAGE_DIR: "/tmp/canonical", PI_PACKAGE_DIR: "/tmp/legacy" });
		expect(resolved).toBe("/tmp/canonical");
	});

	it("skips the package.json walk inside a compiled binary", () => {
		// `PI_COMPILED` is the build-injected marker `isCompiledBinary()` reads.
		// Run from a directory that is NOT inside any package, so the two paths
		// give different answers: the walk would climb out of the temp dir and
		// find some ancestor package.json, while the compiled path must return
		// the project dir (the cwd) instead.
		const outside = fs.mkdtempSync(path.join(os.tmpdir(), "jwc-pkgdir-outside-"));
		try {
			const script = path.join(outside, "probe.ts");
			const entry = path.join(import.meta.dir, "..", "src", "config.ts");
			fs.writeFileSync(
				script,
				[`import { getPackageDir } from ${JSON.stringify(entry)};`, `console.log(getPackageDir());`].join("\n"),
			);
			const run = (env: Record<string, string>): string => {
				const result = Bun.spawnSync({
					cmd: [process.execPath, script],
					cwd: outside,
					env: { HOME: os.homedir(), PATH: Bun.env.PATH ?? "", ...env },
					stdout: "pipe",
					stderr: "pipe",
				});
				return new TextDecoder().decode(result.stdout).trim();
			};

			// Uncompiled: the walk finds the repo package that owns config.ts.
			expect(run({})).toContain("coding-agent");
			// Compiled: no walk, so it lands on the project dir instead.
			expect(run({ PI_COMPILED: "true" })).not.toContain("coding-agent");
		} finally {
			fs.rmSync(outside, { force: true, recursive: true });
		}
	});

	it("resolves a real package directory in a normal run", () => {
		// The non-compiled path must keep working.
		expect(resolveIn({})).toContain("coding-agent");
	});

	it("reads the override through $env rather than raw process.env", async () => {
		// The JWC_ mirror runs inside the env module; a raw process.env lookup
		// bypasses it, which is exactly how the documented name got ignored.
		const source = await Bun.file(CONFIG_SOURCE).text();
		const resolver = source.slice(source.indexOf("export function getPackageDir()"));
		const body = resolver.slice(0, resolver.indexOf("\n}"));

		expect(body).toContain("$env.JWC_PACKAGE_DIR");
		expect(body).not.toContain("process.env.");
	});
});
