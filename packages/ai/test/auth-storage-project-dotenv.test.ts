import { afterEach, describe, expect, test } from "bun:test";
import * as fs from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";
import { AuthStorage, SqliteAuthCredentialStore } from "../src/auth-storage";
import { getEnvApiKey } from "../src/stream";
import { withEnv } from "./helpers";

describe("AuthStorage project dotenv exclusion", () => {
	let tempDir = "";
	let originalCwd = "";

	afterEach(async () => {
		if (originalCwd) {
			process.chdir(originalCwd);
			originalCwd = "";
		}
		if (tempDir) {
			await fs.rm(tempDir, { recursive: true, force: true });
			tempDir = "";
		}
	});

	test("does not load provider credentials from project .env into env fallback or storage", async () => {
		await withEnv({ ANTHROPIC_API_KEY: undefined, ANTHROPIC_OAUTH_TOKEN: undefined }, async () => {
			tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "jwc-auth-dotenv-exclusion-"));
			originalCwd = process.cwd();
			process.chdir(tempDir);
			await Bun.write(path.join(tempDir, ".env"), "ANTHROPIC_API_KEY=project-dotenv-secret\n");

			const store = await SqliteAuthCredentialStore.open(path.join(tempDir, "agent.db"));
			const authStorage = new AuthStorage(store);
			try {
				expect(getEnvApiKey("anthropic")).toBeUndefined();
				expect(await authStorage.getApiKey("anthropic", "dotenv-session")).toBeUndefined();
				expect(authStorage.describeCredentialSource("anthropic", "dotenv-session")).toBeUndefined();
				expect(store.listAuthCredentials("anthropic")).toHaveLength(0);
			} finally {
				authStorage.close();
				store.close();
			}
		});
	});
});
