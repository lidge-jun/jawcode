import { discoverAuthStorage } from "./src/sdk";
import { BUILTIN_SLASH_COMMANDS_INTERNAL } from "./src/slash-commands/builtin-registry";
import { getSearchProvider } from "./src/web/search/provider";

const authStorage = await discoverAuthStorage();
// 1. Is xai search registered + gateable?
const xai = await getSearchProvider("xai");
console.log("xai provider id:", xai.id, "label:", (xai as any).label);
console.log("xai isAvailable (real auth):", await xai.isAvailable(authStorage));
console.log("xai hasOAuth:", authStorage.hasOAuth("xai"), "hasAuth:", authStorage.hasAuth("xai"));

// 2. /searchengine status shows xai in the right bucket
const cmd = BUILTIN_SLASH_COMMANDS_INTERNAL.find(c => c.name === "searchengine");
const outputs: string[] = [];
const runtime: any = {
	session: { model: { provider: "xai" }, modelRegistry: { authStorage } },
	sessionManager: {},
	settings: { get: () => "auto", set: () => {} },
	cwd: process.cwd(),
	output: (t: string) => outputs.push(t),
	refreshCommands: () => {},
	reloadPlugins: async () => {},
	notifyConfigChanged: () => {},
};
await cmd!.handle!({ name: "searchengine", args: "status", text: "/searchengine status" }, runtime);
console.log("\n=== /searchengine status (active model=xai) ===");
console.log(outputs.join("\n"));

// 3. grok alias resolves
outputs.length = 0;
let persisted: any;
runtime.settings.set = (k: string, v: any) => {
	persisted = { k, v };
};
await cmd!.handle!({ name: "searchengine", args: "grok", text: "/searchengine grok" }, runtime);
console.log("\n=== /searchengine grok ===");
console.log(outputs.join("\n"), "| persisted:", JSON.stringify(persisted));
console.log("\nXAI_SMOKE_OK");
