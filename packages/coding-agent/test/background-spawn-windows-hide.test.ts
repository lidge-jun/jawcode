/**
 * A silent background spawn must not flash a console window on Windows.
 *
 * When a child is launched with stdout AND stderr discarded, nothing is meant
 * to be visible — but Windows still attaches a console window to a
 * console-subsystem process unless `windowsHide` is set. The harness owner
 * daemon did exactly that: fully detached, all stdio ignored, and a black
 * window popping up for a process the user never asked to see.
 *
 * This scans for the pattern instead of listing known sites, because the
 * failure mode is *forgetting the flag on a new spawn*, which an enumerated
 * test cannot catch.
 */
import { describe, expect, it } from "bun:test";
import * as fs from "node:fs";
import * as path from "node:path";
import { Glob } from "bun";

const SRC_ROOT = path.join(import.meta.dir, "..", "src");

/**
 * Spawn sites that are POSIX-only in practice, where `windowsHide` would be
 * inert. tmux does not run on Windows, and these are all tmux invocations.
 */
const POSIX_ONLY_COMMANDS = ["tmux_command", "tmuxCommand"];

interface SilentSpawn {
	file: string;
	line: number;
}

/** Find silent background spawns that do not set `windowsHide`. */
async function findUnhiddenSilentSpawns(): Promise<SilentSpawn[]> {
	const found: SilentSpawn[] = [];
	const glob = new Glob("**/*.ts");
	for await (const relative of glob.scan(SRC_ROOT)) {
		const file = path.join(SRC_ROOT, relative);
		const source = fs.readFileSync(file, "utf-8");
		const pattern = /Bun\.spawn(?:Sync)?\(/g;
		for (let match = pattern.exec(source); match !== null; match = pattern.exec(source)) {
			const window = source.slice(match.index, match.index + 900);
			const close = window.indexOf("});");
			const block = close > 0 ? window.slice(0, close) : window;

			const silent = block.includes('stdout: "ignore"') && block.includes('stderr: "ignore"');
			if (!silent) continue;
			if (block.includes("windowsHide")) continue;
			if (POSIX_ONLY_COMMANDS.some(command => block.includes(command))) continue;

			found.push({ file: relative, line: source.slice(0, match.index).split("\n").length });
		}
	}
	return found;
}

describe("background spawns hide their console window", () => {
	it("sets windowsHide wherever stdout and stderr are both discarded", async () => {
		const offenders = await findUnhiddenSilentSpawns();
		expect(offenders.map(entry => `${entry.file}:${entry.line}`)).toEqual([]);
	});

	it("covers the harness owner daemon specifically", async () => {
		// The residual that started this: a fully detached, unref'd daemon.
		const source = fs.readFileSync(path.join(SRC_ROOT, "commands", "harness.ts"), "utf-8");
		const spawnAt = source.indexOf("const child = Bun.spawn(cmd, {");
		expect(spawnAt).toBeGreaterThan(-1);

		const block = source.slice(spawnAt, source.indexOf("});", spawnAt));
		expect(block).toContain("windowsHide: true");
	});
});
