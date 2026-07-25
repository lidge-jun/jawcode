import { afterEach, describe, expect, it } from "bun:test";
import * as fs from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";

import { extractEmbeddedAddonFile, shouldReuseCachedExtraction } from "../native/loader-state.js";

const tempDirs: string[] = [];

afterEach(async () => {
	await Promise.all(tempDirs.splice(0).map(tempDir => fs.rm(tempDir, { force: true, recursive: true })));
});

describe("shouldReuseCachedExtraction", () => {
	it("reuses a cached extraction with the embedded payload byte size", () => {
		expect(shouldReuseCachedExtraction({ targetStat: { size: 12 }, embeddedPayloadByteSize: 12 })).toBe(true);
	});

	it("does not reuse a cached extraction with a mismatched byte size", () => {
		expect(shouldReuseCachedExtraction({ targetStat: { size: 11 }, embeddedPayloadByteSize: 12 })).toBe(false);
	});

	it("does not reuse an un-stattable target", () => {
		expect(shouldReuseCachedExtraction({ targetStat: null, embeddedPayloadByteSize: 12 })).toBe(false);
	});
});

describe("extractEmbeddedAddonFile", () => {
	it("does not rewrite a matching-size cached extraction", async () => {
		const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "jwc-embedded-addon-"));
		tempDirs.push(tempDir);
		const embeddedPath = path.join(tempDir, "embedded.node");
		const targetPath = path.join(tempDir, "cache", "addon.node");
		await fs.mkdir(path.dirname(targetPath));
		await fs.writeFile(embeddedPath, "new payload");
		await fs.writeFile(targetPath, "old payload");

		extractEmbeddedAddonFile({ targetPath, embeddedPath, embeddedPayloadByteSize: 11 });

		expect(await fs.readFile(targetPath, "utf8")).toBe("old payload");
	});

	it("rewrites a missing or mismatched cached extraction", async () => {
		const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "jwc-embedded-addon-"));
		tempDirs.push(tempDir);
		const embeddedPath = path.join(tempDir, "embedded.node");
		const targetPath = path.join(tempDir, "cache", "addon.node");
		await fs.writeFile(embeddedPath, "replacement payload");

		extractEmbeddedAddonFile({ targetPath, embeddedPath, embeddedPayloadByteSize: 19 });
		expect(await fs.readFile(targetPath, "utf8")).toBe("replacement payload");

		await fs.writeFile(targetPath, "stale");
		extractEmbeddedAddonFile({ targetPath, embeddedPath, embeddedPayloadByteSize: 19 });
		expect(await fs.readFile(targetPath, "utf8")).toBe("replacement payload");
	});
});
