import { describe, expect, it } from "bun:test";
import * as fs from "node:fs";
import * as path from "node:path";

const repoRoot = path.resolve(import.meta.dir, "../../..");
const packageJsonPath = path.join(repoRoot, "packages", "jwc", "package.json");

interface PackageJson {
	dependencies?: Record<string, string>;
	files?: string[];
	scripts?: Record<string, string>;
}

function readPackageJson(): PackageJson {
	return JSON.parse(fs.readFileSync(packageJsonPath, "utf8"));
}

describe("jawcode package manifest contract", () => {
	it("ships the bootstrap assets required by postinstall", () => {
		const pkg = readPackageJson();
		expect(pkg.files).toEqual([
			"bin",
			"dist",
			"dist-node",
			"defaults/cli-jaw/settings.json",
			"scripts/resolve-bun-runtime.cjs",
			"scripts/verify-runtime.cjs",
			"scripts/bootstrap-cli-jaw-home.cjs",
			"src/index.ts",
			"src/sdk.ts",
		]);
		expect(pkg.scripts?.postinstall).toBe(
			"node scripts/verify-runtime.cjs --postinstall && node scripts/bootstrap-cli-jaw-home.cjs --postinstall",
		);
		expect(pkg.scripts?.["bootstrap:cli-jaw"]).toBe("node scripts/bootstrap-cli-jaw-home.cjs");
	});

	it("does not publish workspace-only runtime dependency specs", () => {
		const pkg = readPackageJson();
		for (const [name, spec] of Object.entries(pkg.dependencies ?? {})) {
			expect(spec.startsWith("workspace:"), `${name} uses ${spec}`).toBe(false);
			expect(spec.startsWith("file:"), `${name} uses ${spec}`).toBe(false);
		}
	});
});
