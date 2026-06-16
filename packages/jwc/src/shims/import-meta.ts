/**
 * Bun `import.meta.dir` / `import.meta.path` replacements for the Node bundle
 * (100.07). esbuild `define` rewrites those expressions to these injected
 * identifiers. Post-bundle every module shares one import.meta, so "this
 * module's dir" degrades to "the bundle's dir" — acceptable for the three
 * call sites (plugin loader paths), which are runtime-plugin features beyond
 * the M2 import/streaming gate.
 */
import path from "node:path";
import { fileURLToPath } from "node:url";

export const JWC_IMPORT_META_PATH = fileURLToPath(import.meta.url);
export const JWC_IMPORT_META_DIR = path.dirname(JWC_IMPORT_META_PATH);
