import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import * as fs from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";
import { resetSettingsForTest, Settings } from "@jawcode-dev/coding-agent/config/settings";
import { InternalUrlRouter, type ProtocolHandler } from "@jawcode-dev/coding-agent/internal-urls";
import { createTools, type ToolSession } from "@jawcode-dev/coding-agent/tools";

function createTestSession(cwd: string): ToolSession {
	return {
		cwd,
		hasUI: false,
		enableLsp: false,
		getSessionFile: () => null,
		getSessionSpawns: () => "*",
		settings: Settings.isolated(),
	} as unknown as ToolSession;
}

async function getWriteTool(session: ToolSession) {
	const write = (await createTools(session)).find(tool => tool.name === "write");
	if (!write) throw new Error("Missing write tool");
	return write;
}

describe("write URI-like target dispatch", () => {
	beforeAll(async () => {
		resetSettingsForTest();
		await Settings.init({ inMemory: true });
	});

	afterAll(() => {
		InternalUrlRouter.resetForTests();
	});

	it("rejects unknown URI-like targets without creating files", async () => {
		const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "write-uri-like-"));
		try {
			const write = await getWriteTool(createTestSession(tempDir));
			for (const target of ["xdt://foo", "xd:/foo", "xd//foo"]) {
				await expect(write.execute(`write-${target}`, { path: target, content: "unexpected" })).rejects.toThrow(
					/Unknown URI-like write target/,
				);
			}
			expect(await fs.readdir(tempDir)).toEqual([]);
		} finally {
			await fs.rm(tempDir, { recursive: true, force: true });
		}
	});

	it("preserves registered internal and conflict URI routing", async () => {
		const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "write-uri-routing-"));
		const writes: string[] = [];
		const handler: ProtocolHandler = {
			scheme: "testwrite",
			immutable: false,
			resolve: async url => ({
				url: url.href,
				content: "",
				contentType: "text/plain",
				immutable: false,
			}),
			write: async (_url, content) => {
				writes.push(content);
			},
		};
		InternalUrlRouter.instance().register(handler);
		try {
			const conflictPath = path.join(tempDir, "conflict.txt");
			await Bun.write(conflictPath, ["<<<<<<< HEAD", "ours", "=======", "theirs", ">>>>>>> branch", ""].join("\n"));
			const session = createTestSession(tempDir);
			const tools = await createTools(session);
			const read = tools.find(tool => tool.name === "read");
			const write = tools.find(tool => tool.name === "write");
			if (!read || !write) throw new Error("Missing read/write tools");
			await read.execute("read-conflict", { path: "conflict.txt" });

			await write.execute("write-internal", { path: "testwrite://target", content: "routed" });
			await write.execute("write-conflict", { path: "conflict://1", content: "@ours" });

			expect(writes).toEqual(["routed"]);
			expect(await Bun.file(conflictPath).text()).toBe("ours\n");
		} finally {
			InternalUrlRouter.instance().unregister("testwrite");
			await fs.rm(tempDir, { recursive: true, force: true });
		}
	});

	it("keeps legal and explicitly escaped local paths writable", async () => {
		const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "write-local-escape-"));
		try {
			const write = await getWriteTool(createTestSession(tempDir));
			const targets = ["report:final.txt", "dir/a://b", "./foo://bar", "./xd/web_search", "C:\\reports\\final.txt"];
			for (const target of targets) {
				await write.execute(`write-${target}`, { path: target, content: target });
			}

			for (const target of targets) {
				expect(await Bun.file(path.resolve(tempDir, target)).text()).toBe(target);
			}
		} finally {
			await fs.rm(tempDir, { recursive: true, force: true });
		}
	});
});
