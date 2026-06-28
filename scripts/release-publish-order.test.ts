import { describe, expect, test } from "bun:test";
import * as path from "node:path";
import { normalizeFileDependencySpec, packages as publishPackages, preBuildStepEnabled } from "./ci-release-publish";

interface PackageManifest {
	name: string;
	version: string;
	bin?: Record<string, string>;
	dependencies?: Record<string, string>;
	private?: boolean;
}

const repoRoot = path.join(import.meta.dir, "..");

async function readManifest(relativePath: string): Promise<PackageManifest> {
	return (await Bun.file(path.join(repoRoot, relativePath, "package.json")).json()) as PackageManifest;
}

describe("release publish contract", () => {
	test("release dependency normalization collapses repeated file prefixes", () => {
		expect(normalizeFileDependencySpec("file:../packages/ai")).toBe("file:../packages/ai");
		expect(normalizeFileDependencySpec("file:file:../packages/ai")).toBe("file:../packages/ai");
		expect(normalizeFileDependencySpec("file:file:file:///tmp/jawcode/packages/ai")).toBe(
			"file:///tmp/jawcode/packages/ai",
		);
		expect(normalizeFileDependencySpec("catalog:")).toBe("catalog:");
	});

	test("registry-faithful preBuild runs on real publish but is skipped in dry-run", () => {
		const registryFaithful = ["node", "scripts/smoke-packed-sdk.mjs", "--registry-faithful"] as const;
		const postinstallMatrix = ["node", "scripts/smoke-packed-sdk.mjs", "--postinstall-matrix"] as const;
		const localSmoke = ["bun", "run", "smoke:packed-sdk"] as const;

		// Real publish: registry-faithful must run (validates the published-from-registry shape).
		expect(preBuildStepEnabled(registryFaithful, { dryRun: false })).toBe(true);
		// Dry-run: registry-faithful needs already-published deps (e.g. @jawcode-dev/natives@<ver>)
		// which do not exist mid-release, so it is skipped to keep dry-runs green.
		expect(preBuildStepEnabled(registryFaithful, { dryRun: true })).toBe(false);
		// Every other preBuild step runs in both modes (they install local tarballs).
		for (const step of [postinstallMatrix, localSmoke]) {
			expect(preBuildStepEnabled(step, { dryRun: true })).toBe(true);
			expect(preBuildStepEnabled(step, { dryRun: false })).toBe(true);
		}
	});

});

describe("release bump set equals publish set", () => {
	test("every non-private packages/* manifest is published, and every published dir is non-private", async () => {
		const { Glob } = await import("bun");

		// release.ts bumps the version of EVERY non-private packages/*/package.json.
		const bumpableDirs = new Set<string>();
		const glob = new Glob("packages/*/package.json");
		for await (const rel of glob.scan(repoRoot)) {
			const manifest = (await Bun.file(path.join(repoRoot, rel)).json()) as PackageManifest;
			if (manifest.private === true) continue;
			bumpableDirs.add(path.dirname(rel));
		}

		// ci-release-publish.ts publishes exactly the dirs in its exported `packages` array.
		const publishDirs = new Set<string>(publishPackages.map((pkg) => pkg.dir));

		expect(bumpableDirs.size).toBeGreaterThan(0);
		// Any non-private package that release.ts bumps but the publisher omits would
		// ship a 0.x tag whose npm version never advances. Any published dir that is
		// private would be skipped at publish time. Both break one-release-truth.
		expect([...publishDirs].sort()).toEqual([...bumpableDirs].sort());
	});
});

describe("jawcode publish package contract", () => {
	test("jawcode package publish builds and smokes the full release contract", () => {
		const jwcPackage = publishPackages.find((pkg) => pkg.dir === "packages/jwc");
		expect(jwcPackage).toBeDefined();
		expect(jwcPackage?.kind).toBe("manifest");
		expect(jwcPackage?.preBuild).toEqual([
			["bun", "run", "bundle"],
			["bun", "run", "build:node"],
			["bun", "test", "../../packages/coding-agent/test/jwc-cli-jaw-bootstrap.test.ts"],
			["bun", "test", "../../packages/coding-agent/test/jwc-package-manifest-contract.test.ts"],
			["bun", "run", "smoke:packed-sdk"],
			["node", "scripts/smoke-packed-sdk.mjs", "--postinstall-matrix"],
			["node", "scripts/smoke-packed-sdk.mjs", "--registry-faithful"],
			["node", "scripts/smoke-packed-sdk.mjs", "--native-probes"],
		]);
	});
});
