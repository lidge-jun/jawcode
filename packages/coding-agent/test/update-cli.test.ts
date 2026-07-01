import { afterEach, describe, expect, it } from "bun:test";
import * as fs from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";
import {
	buildReleaseBinaryUrlForTest,
	formatBinaryDownloadFailureMessageForTest,
	formatManualUpdateInstructionsForTest,
	isNpmManagedWindowsShimForTest,
	replaceBinaryForUpdate,
	resolveUpdateMethodForTest,
	runPackageManagerUpdateForTest,
} from "../src/cli/update-cli";

const tempDirs: string[] = [];
const repoRoot = path.resolve(import.meta.dir, "../../..");

async function makeTempDir(): Promise<string> {
	const dir = await fs.mkdtemp(path.join(os.tmpdir(), "jwc-update-test-"));
	tempDirs.push(dir);
	return dir;
}

afterEach(async () => {
	await Promise.all(tempDirs.splice(0).map(dir => fs.rm(dir, { recursive: true, force: true })));
});
describe("update-cli install target detection", () => {
	it("uses bun update when prioritized jwc is inside bun global bin", () => {
		const method = resolveUpdateMethodForTest("/Users/test/.bun/bin/jwc", "/Users/test/.bun/bin");

		expect(method).toBe("bun");
	});

	it("uses binary update when prioritized jwc is outside bun global bin", () => {
		const method = resolveUpdateMethodForTest("/Users/test/.local/bin/jwc", "/Users/test/.bun/bin");

		expect(method).toBe("binary");
	});

	it("uses binary update when bun global bin cannot be resolved", () => {
		const method = resolveUpdateMethodForTest("/Users/test/.local/bin/jwc", undefined);

		expect(method).toBe("binary");
	});

	it("detects Windows npm-managed cmd shims for jawcode", async () => {
		const dir = await makeTempDir();
		const shimPath = path.join(dir, "jwc.cmd");
		await Bun.write(
			shimPath,
			`@ECHO off\r\n"%dp0%\\node.exe" "%dp0%\\node_modules\\jawcode\\dist\\bin\\cli-jaw.js" %*\r\n`,
		);

		expect(await isNpmManagedWindowsShimForTest(shimPath, "win32")).toBe(true);
		expect(await isNpmManagedWindowsShimForTest(shimPath, "linux")).toBe(false);
	});

	it("detects Windows npm-managed powershell shims for jawcode", async () => {
		const dir = await makeTempDir();
		const shimPath = path.join(dir, "jwc.ps1");
		await Bun.write(
			shimPath,
			`#!/usr/bin/env pwsh\n& "$basedir/node" "$basedir/node_modules/jawcode/dist/bin/cli-jaw.js" $args\n`,
		);

		expect(await isNpmManagedWindowsShimForTest(shimPath, "win32")).toBe(true);
	});

	it("rejects unrelated Windows shims", async () => {
		const dir = await makeTempDir();
		const shimPath = path.join(dir, "jwc.cmd");
		await Bun.write(shimPath, `"node" "%dp0%\\node_modules\\other-package\\bin.js" %*\r\n`);

		expect(await isNpmManagedWindowsShimForTest(shimPath, "win32")).toBe(false);
	});
});

describe("update-cli binary release assets", () => {
	it("downloads fallback binaries from the current owner release repository", () => {
		expect(buildReleaseBinaryUrlForTest("0.2.3", "linux", "x64")).toBe(
			"https://github.com/lidge-jun/jawcode/releases/download/v0.2.3/jwc-linux-x64",
		);
	});

	it("uses the existing Windows .exe release asset name", () => {
		expect(buildReleaseBinaryUrlForTest("0.2.3", "win32", "x64")).toBe(
			"https://github.com/lidge-jun/jawcode/releases/download/v0.2.3/jwc-windows-x64.exe",
		);
	});

	it("reports actionable Unix manual update commands for unsupported fallback paths", () => {
		const instructions = formatManualUpdateInstructionsForTest("linux");

		expect(instructions).toContain("bun install -g jawcode@latest");
		expect(instructions).toContain("npm, pnpm, or another package manager");
		expect(instructions).toContain(
			"curl -fsSL https://raw.githubusercontent.com/lidge-jun/jawcode/main/scripts/install.sh | sh -s -- --binary",
		);
	});

	it("reports actionable Windows manual update commands for unsupported fallback paths", () => {
		const instructions = formatManualUpdateInstructionsForTest("win32");

		expect(instructions).toContain("bun install -g jawcode@latest");
		expect(instructions).toContain("npm, pnpm, or another package manager");
		expect(instructions).toContain(
			"irm https://raw.githubusercontent.com/lidge-jun/jawcode/main/scripts/install.ps1 | iex",
		);
	});

	it("keeps manual reinstall guidance aligned with bundled installer repositories", async () => {
		const instructions = formatManualUpdateInstructionsForTest("linux");
		const shellInstaller = await Bun.file(path.join(repoRoot, "scripts/install.sh")).text();
		const windowsInstaller = await Bun.file(path.join(repoRoot, "scripts/install.ps1")).text();

		expect(instructions).toContain("raw.githubusercontent.com/lidge-jun/jawcode/main/scripts/install.sh");
		expect(shellInstaller).toContain('REPO="lidge-jun/jawcode"');
		expect(windowsInstaller).toContain('$Repo = "lidge-jun/jawcode"');
		expect(formatManualUpdateInstructionsForTest("win32")).toContain(
			"raw.githubusercontent.com/lidge-jun/jawcode/main/scripts/install.ps1",
		);
	});

	it("includes actionable guidance when a release asset download fails", () => {
		const message = formatBinaryDownloadFailureMessageForTest(
			"jwc-linux-x64",
			"https://github.com/lidge-jun/jawcode/releases/download/v0.2.3/jwc-linux-x64",
			"Not Found",
			"linux",
		);

		expect(message).toContain("Download failed for jwc-linux-x64");
		expect(message).toContain("lidge-jun/jawcode/releases/download/v0.2.3/jwc-linux-x64");
		expect(message).toContain("bun install -g jawcode@latest");
	});

	it("includes actionable guidance when the platform has no release asset", () => {
		expect(() => buildReleaseBinaryUrlForTest("0.2.3", "freebsd", "x64")).toThrow("bun install -g jawcode@latest");
	});
});

describe("update-cli binary replacement", () => {
	it("restores the previous binary when the replacement fails verification", async () => {
		const dir = await makeTempDir();
		const targetPath = path.join(dir, "jwc");
		const tempPath = `${targetPath}.new`;
		const backupPath = `${targetPath}.bak`;
		await Bun.write(targetPath, "old binary");
		await Bun.write(tempPath, "broken binary");

		await expect(
			replaceBinaryForUpdate({
				targetPath,
				tempPath,
				backupPath,
				expectedVersion: "15.1.8",
				verifyInstalledVersion: async () => ({ ok: false, path: targetPath }),
			}),
		).rejects.toThrow("restored previous jwc binary");

		expect(await Bun.file(targetPath).text()).toBe("old binary");
		expect(await Bun.file(tempPath).exists()).toBe(false);
		expect(await Bun.file(backupPath).exists()).toBe(false);
	});

	it("keeps the replacement only after it reports the expected version", async () => {
		const dir = await makeTempDir();
		const targetPath = path.join(dir, "jwc");
		const tempPath = `${targetPath}.new`;
		const backupPath = `${targetPath}.bak`;
		await Bun.write(targetPath, "old binary");
		await Bun.write(tempPath, "new binary");

		await replaceBinaryForUpdate({
			targetPath,
			tempPath,
			backupPath,
			expectedVersion: "15.1.8",
			verifyInstalledVersion: async () => ({ ok: true, actual: "15.1.8", path: targetPath }),
		});

		expect(await Bun.file(targetPath).text()).toBe("new binary");
		expect(await Bun.file(tempPath).exists()).toBe(false);
		expect(await Bun.file(backupPath).exists()).toBe(false);
	});

	it("keeps verified replacements when backup cleanup fails", async () => {
		const dir = await makeTempDir();
		const targetPath = path.join(dir, "jwc");
		const tempPath = `${targetPath}.new`;
		const backupPath = `${targetPath}.bak`;
		await Bun.write(targetPath, "old binary");
		await Bun.write(tempPath, "new binary");

		const result = await replaceBinaryForUpdate({
			targetPath,
			tempPath,
			backupPath,
			expectedVersion: "15.1.8",
			verifyInstalledVersion: async () => ({ ok: true, actual: "15.1.8", path: targetPath }),
			removeBackupPath: async () => {
				throw new Error("permission denied");
			},
		});

		expect(result.ok).toBe(true);
		expect(result.cleanupWarning).toContain("backup_cleanup_failed");
		expect(await Bun.file(targetPath).text()).toBe("new binary");
		expect(await Bun.file(backupPath).text()).toBe("old binary");
	});
});

describe("update-cli package manager verification", () => {
	it("accepts nonzero package-manager installs when the installed version verifies", async () => {
		const result = await runPackageManagerUpdateForTest({
			manager: "npm",
			expectedVersion: "15.1.8",
			runInstall: async () => ({ exitCode: 1 }),
			verifyInstalledVersion: async () => ({ ok: true, actual: "15.1.8", path: "/usr/local/bin/jwc" }),
		});

		expect(result.ok).toBe(true);
		expect(result.actual).toBe("15.1.8");
	});

	it("rejects nonzero package-manager installs when the installed version does not verify", async () => {
		await expect(
			runPackageManagerUpdateForTest({
				manager: "bun",
				expectedVersion: "15.1.8",
				runInstall: async () => ({ exitCode: 1 }),
				verifyInstalledVersion: async () => ({ ok: false, actual: "15.1.7", path: "/usr/local/bin/jwc" }),
			}),
		).rejects.toThrow("bun install failed with exit code 1");
	});
});
