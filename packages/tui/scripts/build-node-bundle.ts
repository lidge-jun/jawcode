// Build a standalone, Node-runnable bundle of the TUI components.
//
// The TUI sources target Bun: they read native text helpers from
// `@jawcode-dev/natives`, touch `bun:ffi`, and pull a few helpers from
// `@jawcode-dev/utils`. This script bundles the component graph for plain Node:
//
//   - `@jawcode-dev/natives` stays external so its Node-compatible loader
//     resolves the prebuilt addon at runtime (no machine-specific paths baked
//     into the output).
//   - `bun:ffi` and `@jawcode-dev/utils` are swapped for the small shims in
//     ./node-bundle, keeping winston/handlebars/mermaid out of the artifact.
//
// The `Bun` global the sources rely on is provided at runtime by the host's
// bun-shim. Output: dist/jawcode-tui-bundle.mjs.
import { mkdir } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const pkgRoot = resolve(here, "..");
const outDir = join(pkgRoot, "dist");
const outFile = join(outDir, "jawcode-tui-bundle.mjs");

const shim = (p: string) => join(here, "node-bundle", p);

const result = await Bun.build({
	entrypoints: [shim("entry.ts")],
	target: "node",
	format: "esm",
	plugins: [
		{
			name: "node-standalone-shims",
			setup(build) {
				build.onResolve({ filter: /^@jawcode-dev\/natives$/ }, () => ({
					path: "@jawcode-dev/natives",
					external: true,
				}));
				build.onResolve({ filter: /^@jawcode-dev\/utils$/ }, () => ({
					path: shim("utils-shim.ts"),
				}));
				build.onResolve({ filter: /^bun:ffi$/ }, () => ({
					path: shim("bun-ffi-shim.ts"),
				}));
			},
		},
	],
});

if (!result.success) {
	for (const log of result.logs) console.error(String(log));
	process.exit(1);
}

await mkdir(outDir, { recursive: true });
await Bun.write(outFile, await result.outputs[0].text());
console.log(`[build-node-bundle] wrote ${outFile}`);
