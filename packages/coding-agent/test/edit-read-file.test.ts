import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import * as fs from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";
import { Snowflake } from "@jawcode-dev/utils";
import { readEditFileText, serializeEditFileText } from "../src/edit/read-file";

const UTF8_BOM = "\uFEFF";

describe("edit read file helpers", () => {
	let tempDir = "";

	beforeEach(async () => {
		tempDir = path.join(os.tmpdir(), "jwc-edit-read-file", Snowflake.next());
		await fs.mkdir(tempDir, { recursive: true });
	});

	afterEach(async () => {
		await fs.rm(tempDir, { recursive: true, force: true });
	});

	it("preserves UTF-8 BOM when Bun text decoding strips it", async () => {
		const filePath = path.join(tempDir, "bom.txt");
		await Bun.write(filePath, new Uint8Array([0xef, 0xbb, 0xbf, ...new TextEncoder().encode("hello\n")]));

		const text = await readEditFileText(filePath, "bom.txt");

		expect(text.startsWith(UTF8_BOM)).toBe(true);
		expect(text).toBe(`${UTF8_BOM}hello\n`);
	});

	it("serializes normal file content without dropping a leading BOM marker", async () => {
		const filePath = path.join(tempDir, "bom.txt");
		const serialized = await serializeEditFileText(filePath, "bom.txt", `${UTF8_BOM}updated\n`);

		expect(serialized).toBe(`${UTF8_BOM}updated\n`);
	});

	it("leaves non-BOM files unchanged", async () => {
		const filePath = path.join(tempDir, "plain.txt");
		await Bun.write(filePath, "plain\n");

		const text = await readEditFileText(filePath, "plain.txt");

		expect(text).toBe("plain\n");
	});
});
