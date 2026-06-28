import { describe, expect, it } from "bun:test";
import * as path from "node:path";

const DOCS = ["docs/notifications-sdk.md", "docs/telegram-onboarding.md", "docs/bot-integration.md"] as const;

async function readDoc(file: string): Promise<string> {
	return await Bun.file(path.join(import.meta.dir, "..", "..", "..", file)).text();
}

describe("notification docs", () => {
	it("uses JWC commands and state paths without stale public GJC examples", async () => {
		for (const doc of DOCS) {
			const text = await readDoc(doc);
			expect(text).toContain("jwc notify");
			expect(text).toContain(".jwc/state/notifications/");
			expect(text).not.toMatch(/\bgjc notify\b/i);
			expect(text).not.toContain(".gjc/state");
		}
	});

	it("does not include raw-looking Telegram bot tokens", async () => {
		const tokenLike = /\b\d{6,}:[A-Za-z0-9_-]{20,}\b/;
		for (const doc of DOCS) {
			const text = await readDoc(doc);
			expect(text).toContain("<bot-token>");
			expect(text).not.toMatch(tokenLike);
		}
	});

	it("keeps Discord and Slack adapters documented as deferred, never supported", async () => {
		for (const doc of DOCS) {
			const text = await readDoc(doc).then(value => value.toLowerCase());
			expect(text).not.toContain("discord is supported");
			expect(text).not.toContain("slack is supported");
			expect(text).toContain("deferred");
		}
	});

	it("does not overclaim a hosted production bot", async () => {
		for (const doc of DOCS) {
			const lower = await readDoc(doc).then(value => value.toLowerCase());
			// release positioning must keep live deployment as an operator step
			expect(lower).toContain("operator");
			expect(lower).toContain("running");
		}
	});

	it("documents telegram_send as a shipped connection-gated, workspace-confined tool", async () => {
		for (const doc of ["docs/notifications-sdk.md", "docs/telegram-onboarding.md"]) {
			const lower = await readDoc(doc).then(value => value.toLowerCase());
			expect(lower).toContain("telegram_send");
			expect(lower).toContain("connection-gated");
			expect(lower).toContain("realpath-confined to the active workspace");
			expect(lower).toContain("mime and size policy");
			expect(lower).toContain("logs never include raw file contents");
			// must not regress to the old "not implemented" framing
			expect(lower).not.toContain("media/file transfer is not implemented yet");
		}
	});

	it("documents private-chat-only pairing and Threaded Mode fallback", async () => {
		const text = (await readDoc("docs/telegram-onboarding.md")).toLowerCase();
		expect(text).toContain("jwc notify verify");
		expect(text).toContain("private");
		expect(text).toContain("threaded mode");
		expect(text).toContain("supergroup");
		expect(text).toContain("rejected");
	});

	it("distinguishes JWC-native notifications from cli-jaw channel send", async () => {
		const lower = (await readDoc("docs/bot-integration.md")).toLowerCase();
		expect(lower).toContain("jwc-native notifications");
		expect(lower).toContain("cli-jaw channel send");
		expect(lower).toContain("/api/channel/send");
		// the two paths must be presented as distinct
		expect(lower).toContain("session endpoint");
	});
});
