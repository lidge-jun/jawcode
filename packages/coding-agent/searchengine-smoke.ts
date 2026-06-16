import { discoverAuthStorage } from "./src/sdk";
import { BUILTIN_SLASH_COMMANDS_INTERNAL } from "./src/slash-commands/builtin-registry";

const cmd = BUILTIN_SLASH_COMMANDS_INTERNAL.find(c => c.name === "searchengine");
if (!cmd?.handle) {
	console.error("FAIL: no searchengine handler");
	process.exit(1);
}

const authStorage = await discoverAuthStorage();
const outputs: string[] = [];
const settingsLog: Array<{ key: string; value: unknown }> = [];
let webSearch = "auto";

const runtime: any = {
	session: { model: { provider: "anthropic" }, modelRegistry: { authStorage } },
	sessionManager: {},
	settings: {
		get: (k: string) => (k === "providers.webSearch" ? webSearch : undefined),
		set: (k: string, v: any) => {
			if (k === "providers.webSearch") webSearch = v;
			settingsLog.push({ key: k, value: v });
		},
	},
	cwd: process.cwd(),
	output: (t: string) => {
		outputs.push(t);
	},
	refreshCommands: () => {},
	reloadPlugins: async () => {},
	notifyConfigChanged: () => {},
};

// 1. status — real local credentials
await cmd.handle({ name: "searchengine", args: "status", text: "/searchengine status" }, runtime);
console.log("=== /searchengine status (real authStorage) ===");
console.log(outputs.join("\n"));

// 2. switch to chatgpt
outputs.length = 0;
await cmd.handle({ name: "searchengine", args: "chatgpt", text: "/searchengine chatgpt" }, runtime);
console.log("\n=== /searchengine chatgpt ===");
console.log(outputs.join("\n"));
console.log("persisted:", JSON.stringify(settingsLog));

// 3. invalid
outputs.length = 0;
await cmd.handle({ name: "searchengine", args: "altavista", text: "/searchengine altavista" }, runtime);
console.log("\n=== /searchengine altavista (invalid) ===");
console.log(outputs.join("\n"));
console.log("\nSMOKE_OK");
