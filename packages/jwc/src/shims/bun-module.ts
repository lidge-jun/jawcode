/**
 * `import { … } from "bun"` module alias for the Node bundle (100.07).
 * Named-import census (260613): $ ×13 · YAML ×12 · TOML ×1 · JSONC ×1 ·
 * Glob ×1 (+type-only imports, erased at build). YAML/TOML are bundled pure
 * -JS deps; JSONC rides json5 (comments + trailing commas covered).
 */
import JSON5 from "json5";
import { parse as parseToml } from "smol-toml";
import * as yaml from "yaml";
import { BunGlob } from "./bun-glob";
import { buildNodeBunShim } from "./bun-object";
import { $ } from "./bun-shell";

export { $ };
export const YAML = {
	parse: (text: string): unknown => yaml.parse(text),
	stringify: (value: unknown): string => yaml.stringify(value),
};
export const TOML = {
	parse: (text: string): unknown => parseToml(text),
};
export const JSONC = {
	parse: (text: string): unknown => JSON5.parse(text),
};
export const Glob = BunGlob;

// Defensive default: anything that does `import Bun from "bun"` or pulls a
// less common member gets the same object as globalThis.Bun.
const shim = ((globalThis as { Bun?: unknown }).Bun ?? buildNodeBunShim()) as Record<string, unknown>;
export const env = process.env;
export const argv = process.argv;
export const file = shim.file;
export const write = shim.write;
export const spawn = shim.spawn;
export const spawnSync = shim.spawnSync;
export const sleep = shim.sleep;
export const sleepSync = shim.sleepSync;
export const serve = shim.serve;
export const hash = shim.hash;
export const stripANSI = shim.stripANSI;
export const which = shim.which;
export const randomUUIDv7 = shim.randomUUIDv7;
export const nanoseconds = shim.nanoseconds;
export default shim;
