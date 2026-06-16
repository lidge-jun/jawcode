# 180 — validation matrix

| Area | Command/evidence | Owner repo |
|---|---|---|
| docs consistency | `git diff --check` and path/link grep | jawcode |
| JWC package dry run | `jawcode` package/tarball dry run | jawcode |
| JWC install smoke | temp install + `jwc --version` + `jwc --help` | jawcode |
| managed Bun safety | CI-mode/safe-mode postinstall smoke | jawcode |
| embedding import | `cd packages/jwc && bun run build:node && node scripts/smoke-node-sdk.mjs`; packed install variant must import `jawcode/sdk` | jawcode |
| first-install cli-jaw home bootstrap | `bun test packages/coding-agent/test/jwc-cli-jaw-bootstrap.test.ts`; packed smoke with temp `CLI_JAW_HOME` asserts settings/heartbeat/mcp/skills_ref/active skills | jawcode |
| package-local Bun proof | packed install smoke scrubs `PATH`, unsets `JWC_BUN_PATH`, and asserts runtime source `package:bun` plus `jwc --version` and `jwc --help` | jawcode |
| postinstall mode matrix | normal, `CI=true`, `JWC_SAFE=1`, and `JWC_SKIP_CLI_JAW_BOOTSTRAP=1` runs with expected JSON status and side effects | jawcode |
| pack allowlist/count/size | `cd packages/jwc && npm pack --dry-run --json`; allowlist includes `defaults/cli-jaw/settings.json` and `scripts/bootstrap-cli-jaw-home.cjs`, count/size within documented ceilings | jawcode |
| registry-faithful install | packed install mode installs only `jawcode` tarball and lets npm resolve declared registry dependencies; no `workspace:`/`file:` runtime deps | jawcode |
| native dependency probes | macOS arm64 probes for `@gajae-code/natives` and `better-sqlite3` are blocking; `markit-ai`/`mupdf` and `photon-node` are report-only unless cheap fixture path is implemented | jawcode |
| reproducible non-secret baseline | temp install proves deterministic seed, empty MCP, skills catalog, no secrets/personal artifacts, no skill `node_modules` | jawcode |
| no-global embedded path | cli-jaw smoke with `jwc` absent from PATH | cli-jaw |
| runtime session | minimal JWC-backed session through cli-jaw | cli-jaw |
| channel paths | Web + messaging channel smokes | cli-jaw |
| fallback | settings rollback to legacy CLI | cli-jaw |
| visible cleanup | rebrand inventory + active-public legacy-zero guard; inherited CI workflows are intentionally absent | both |
| active public gajae/gjc zero | Jawcode guard plus cli-jaw embedded `jawcode-*bundle*` guard proves no blocked `gajae`/`gjc` strings on active public surfaces | both |
| default MCP restore | `bun test packages/coding-agent/test/default-mcp-config.test.ts` verifies managed `context7` plus macOS-only `computer-use` + `cua-driver` entries, non-mac skip behavior, unmanaged-entry preservation, and check-mode status aggregation | jawcode |
| cu-mcp consolidated mode | default MCP test asserts `computer-use` uses `CU_MCP_MODE=consolidated`, `CU_NATIVE_PATH`, and the packaged `packages/cu-mcp-server/dist/index.js` entry | jawcode |
| CUA driver optional path | default MCP test asserts `cua-driver` command is PATH-based (`cua-driver mcp`); live connection remains optional/non-fatal | jawcode |
| MCP discovery/BM25 guard | `bun test packages/coding-agent/test/agent-session-mcp-discovery.test.ts packages/coding-agent/test/mcp-lifecycle-cleanup.test.ts` verifies MCP tools remain discovery/session-selected rather than always exposed | jawcode |

## Minimum proof before each phase

- 120: `jawcode/sdk` import proof.
- 130: package dry-run proof.
- 140: install/release CI proof, first-install cli-jaw-home bootstrap proof, package-local Bun proof, and canonical `validate:jwc-release`.
- 150: visible cleanup proof plus active public `gajae`/`gjc` zero proof across Jawcode and cli-jaw embedded runtime.
- 160: cli-jaw no-global-`jwc` proof.
