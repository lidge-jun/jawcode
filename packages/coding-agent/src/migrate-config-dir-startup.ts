/**
 * Side-effect startup module: runs the one-time `.gjc` → `.jwc` migration
 * (061.1 M4) before any other import can touch the config tree — the shared
 * logger in @jawcode-dev/utils creates `~/<config-dir>/logs` at import time,
 * which would make the rename bail on "target exists". Import this FIRST in
 * cli.ts and keep it free of workspace imports.
 */
import { migrateConfigDirOnce, remapLegacySessionFileEnv } from "./migrate-config-dir";

// Mirrors getConfigDirName() in @jawcode-dev/utils/dirs.ts — duplicated here
// because importing utils would initialize the logger before we migrate.
const targetDirName = process.env.JWC_CONFIG_DIR ?? process.env.GJC_CONFIG_DIR ?? process.env.PI_CONFIG_DIR ?? ".jwc";

migrateConfigDirOnce({ cwd: process.cwd(), targetDirName });
remapLegacySessionFileEnv({ targetDirName });
