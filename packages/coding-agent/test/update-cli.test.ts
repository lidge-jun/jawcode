import { afterEach, describe, expect, it } from "bun:test";
import * as fs from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";
import {
	buildReleaseBinaryUrlForTest,
	formatBinaryDownloadFailureMessageForTest,
	formatManualUpdateInstructionsForTest,
	replaceBinaryForUpdate,
	resolveUpdateMethodForTest,
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
});
