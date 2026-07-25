import { describe, expect, test } from "bun:test";
import * as fs from "node:fs";
import * as path from "node:path";

const codingAgentRoot = path.resolve(import.meta.dir, "../src");

describe("auth completion model refresh wiring", () => {
	test("interactive login refreshes the authenticated provider online", () => {
		const source = fs.readFileSync(path.join(codingAgentRoot, "modes/controllers/selector-controller.ts"), "utf8");
		const loginCompletion = source.slice(
			source.indexOf("async #handleOAuthLogin"),
			source.indexOf("async #handleOAuthLogout"),
		);

		expect(loginCompletion).toContain('await this.ctx.session.modelRegistry.refreshProvider(providerId, "online")');
		expect(loginCompletion).not.toContain("modelRegistry.refresh()");
	});
});
