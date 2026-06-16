import * as os from "node:os";
import * as path from "node:path";

function expandHome(value: string, homeDir: string): string {
	if (value === "~") return homeDir;
	if (value.startsWith("~/") || value.startsWith("~\\")) return path.join(homeDir, value.slice(2));
	return value;
}

export function resolveCliJawHome(env: NodeJS.ProcessEnv = process.env, homeDir: string = os.homedir()): string {
	const configured = env.CLI_JAW_HOME?.trim();
	const raw = configured && configured.length > 0 ? configured : path.join(homeDir, ".cli-jaw");
	return path.resolve(expandHome(raw, homeDir));
}
