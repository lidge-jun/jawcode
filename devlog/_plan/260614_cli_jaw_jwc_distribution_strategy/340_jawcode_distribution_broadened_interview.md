# 340 — Jawcode npm distribution broadened interview + external audit

Date: 2026-06-15
Status: P-stage revised draft; supersedes the narrow-only reading of `330_jawcode_cli_jaw_bootstrap_plan.md`.

## User correction

The packaging question is broader than `cli-jaw` home bootstrap:

1. A user with no `cli-jaw` installed must be able to install only `jawcode` and run `jwc`.
2. That install path must create the cli-jaw-compatible home contract (`CLI_JAW_HOME` or `~/.cli-jaw`) and download skills from GitHub.
3. The current/default settings that matter for a fresh user must be seeded, without copying private maintainer state.
4. Skill sync must exclude unnecessary `node_modules` and other build/cache directories.
5. The plan must also cover GJC-added runtime dependencies and the fact that upstream GJC assumed Bun while npm users expect a normal install experience.
6. Planning should use external/fresh subagents in parallel and record the result here before execution approval.

## Existing source-of-truth docs

- `000_moc_distribution_strategy.md`: target package is `jawcode`, user command is `jwc`, standalone install is `npm install -g jawcode`, and standalone JWC must provision Bun.
- `040_packaging_matrix.md`: preferred P0 is bundled standalone package `jawcode`; do not require unpublished workspace packages at runtime.
- `080_bun_distribution_contract.md`: users must not install Bun manually; launcher resolves `JWC_BUN_PATH`, package-local Bun, then system Bun.
- `130_packaging_slice.md`: requires package dry-run, temp install smoke, `jwc --version`, `jwc --help`, safe postinstall, runtime resolver smoke, SDK import, and no unresolved workspace-only dependency.
- `180_validation_matrix.md`: already tracks install smoke, managed Bun safety, SDK import, and cli-jaw no-global-`jwc` proof, but does not yet include first-run cli-jaw-home bootstrap or native dependency probes.
- `240_publish_readiness_plan.md`: records trimmed 8-file package target and CI/release guard goals; now needs revision for bootstrap artifacts and deeper smokes.
- `330_jawcode_cli_jaw_bootstrap_plan.md`: remains valid as the first-run cli-jaw-home bootstrap slice, but not as the whole distribution plan.

## Observed current package state

`packages/jwc/package.json` currently declares:

- `name: "jawcode"`, version `0.1.0`.
- bin `jwc -> bin/jwc.js`.
- exports `.` and `./sdk` import `./dist-node/sdk.js`, types point at source TS.
- files: `bin`, `dist`, `dist-node`, `scripts/resolve-bun-runtime.cjs`, `scripts/verify-runtime.cjs`, `src/index.ts`, `src/sdk.ts`.
- postinstall: `node scripts/verify-runtime.cjs --postinstall` only.
- runtime deps: `@gajae-code/natives`, `markit-ai`, `better-sqlite3`, `json5`, `strip-ansi`, `@silvia-odwyer/photon-node`, `bun`.

Dry-run evidence from `npm pack --dry-run --json` in `packages/jwc`:

- entry count: 8.
- packed size: 9,388,786 bytes.
- unpacked size: 48,195,816 bytes.
- included files: `bin/jwc.js`, `dist/jwc.bundle.js`, `dist-node/sdk.js`, `package.json`, `scripts/resolve-bun-runtime.cjs`, `scripts/verify-runtime.cjs`, `src/index.ts`, `src/sdk.ts`.

Current gap: `packages/jwc/defaults/cli-jaw/` and `packages/jwc/scripts/bootstrap-cli-jaw-home.cjs` do not exist, so a packed `jawcode` install does not create `~/.cli-jaw`, seed settings, or download skills.

## External subagent audit receipts

Seven external/fresh executor lanes were dispatched read-only:

- `3-ManifestDepsAudit`: package/runtime dependency closure.
- `4-BunRuntimeAudit`: managed Bun npm runtime path.
- `5-SkillsSettingsAudit`: fold plan 330 into broader packaging.
- `6-MacSettingsAudit`: current Mac `~/.cli-jaw` schema and non-secret defaults.
- `7-PackedInstallAudit`: packed install smoke coverage.
- `8-GjcNativeDepsAudit`: native/transitive dependency matrix.
- `9-ReleaseGateAudit`: release validation gate coverage.

### Consolidated findings

#### HIGH / P1

1. **Bootstrap not implemented.** `jawcode` postinstall only verifies Bun; it does not create a cli-jaw-compatible home or download skills.
2. **Packed smoke does not prove no system Bun.** `smoke-packed-sdk.mjs` can pass via a developer machine's system Bun instead of package-local `bun`.
3. **Packed smoke does not prove skill/settings bootstrap.** It checks `jwc --version` and shallow `jawcode/sdk` import only.
4. **Release gates diverge.** `validate:jwc-release`, CI workflows, and release publishing do not share one canonical packed-install/postinstall/pack guard.
5. **Registry-faithful install is unproven.** Current packed smoke co-installs a freshly packed local `@gajae-code/natives`; that proves same-batch local compatibility, not `npm install jawcode` against registry deps.
6. **Native dependency footprint is large.** `@gajae-code/natives` is a direct runtime dep and dominates install size; Bun and dual CLI/SDK bundles add more weight.
7. **Node SDK native path is separate from Bun CLI path.** `jwc --version` does not prove `better-sqlite3`, `@silvia-odwyer/photon-node`, or SDK/native dependency loading.
8. **Maintainer home must not be copied.** The current Mac `~/.cli-jaw` contains DBs, traces, profiles, uploads, and at least one set secret. Seed from code defaults, not the live home.

#### MEDIUM / P2

1. `330` is valid as a slice, but `240` pack count/allowlist must be updated because bootstrap adds publish artifacts.
2. Static settings seed can drift from cli-jaw `createDefaultSettings()`.
3. Current Mac setting `cli=codex` differs from the earlier `330` seed plan `cli=claude`.
4. Current Mac setting includes `tui.theme=dark`; earlier seed did not.
5. Current Mac `mcp.json` has real server entries; bootstrap should still write only `{ "servers": {} }` when missing.
6. `mupdf` is externalized but only transitive via `markit-ai`; this is acceptable only if packed install proves it.
7. Types still point to source TS, not generated distributable `.d.ts`.
8. `bun` package postinstall can still fail the entire npm install independently of `jawcode`'s non-fatal postinstall.

#### LOW / P3

1. `jawcode` name/bin/package identity matches the documented contract.
2. `@gajae-code/coding-agent` is correctly build-time only if bundle freshness is enforced.
3. `heartbeat.json` default `{ jobs: [] }` aligns with the observed local file.

## Revised plan draft

### Slice A — Freeze first-install user-home contract

Files:

- `packages/jwc/defaults/cli-jaw/settings.json` (new)
- `packages/jwc/scripts/bootstrap-cli-jaw-home.cjs` (new)
- `packages/jwc/package.json` (modify)

Plan:

1. Resolve `CLI_JAW_HOME` or default to `~/.cli-jaw`.
2. Create only contract directories/files needed for fresh operation: home, `skills`, `skills_ref`, `uploads`, empty `prompts`, `heartbeat.json`, `mcp.json`, and missing-only `settings.json`.
3. Never copy the maintainer's live home. Never overwrite existing `settings.json`, `mcp.json`, active skills, DBs, uploads, browser profiles, logs, or tokens.
4. Use a deterministic seed derived from cli-jaw defaults plus explicit product decisions from this interview, not from private local state.
5. Provide `bootstrap:cli-jaw` script and wire postinstall as non-fatal.

### Slice B — GitHub skills bootstrap with hygiene

Files:

- `packages/jwc/scripts/bootstrap-cli-jaw-home.cjs` (new)
- `packages/coding-agent/test/jwc-cli-jaw-bootstrap.test.ts` (new)
- `packages/jwc/scripts/smoke-packed-sdk.mjs` (modify)

Plan:

1. Default source: `https://github.com/lidge-jun/cli-jaw-skills.git`.
2. Test/source override: `JWC_CLI_JAW_SKILLS_SOURCE_DIR=/abs/path`.
3. Optional repo override: `JWC_CLI_JAW_SKILLS_REPO=<git-url>`.
4. Safe skips: `CI=true`, `JWC_SAFE=1`, `JWC_SKIP_CLI_JAW_BOOTSTRAP=1`.
5. Force refresh: `JWC_FORCE_CLI_JAW_SKILLS=1` or `JAW_FORCE_CLONE=1`.
6. Clone failures remain non-fatal during postinstall and produce remediation output.
7. Copy/merge excludes `.git`, `node_modules`, `__pycache__`, `.venv`, `venv`, `dist`, `build`, `.next`, `.turbo`, `.DS_Store`, and `*.pyc`.
8. Auto-activate base skills plus registry `category: orchestration` skills, matching cli-jaw behavior while omitting local-only active skills.

### Slice C — Managed Bun npm install proof

Files:

- `packages/jwc/scripts/smoke-packed-sdk.mjs` (modify)
- `packages/jwc/scripts/resolve-bun-runtime.cjs` (possibly modify only if smoke exposes a bug)
- `packages/jwc/scripts/verify-runtime.cjs` (modify only for clearer JSON/mode reporting)

Plan:

1. Harden packed smoke so it scrubs PATH and proves `jwc` runs through `package:bun`, not system Bun.
2. Add `jwc --help` in addition to `jwc --version`.
3. Add `CI=true` / `JWC_SAFE=1` postinstall skip-path assertions.
4. Assert launcher/runtime reporting is observable enough to prove source selection.
5. Document that package-local Bun is the CLI runtime dependency, while `jawcode/sdk` is Node-compatible.

### Slice D — GJC/native dependency and registry-faithful proof

Files:

- `packages/jwc/scripts/smoke-packed-sdk.mjs` (modify)
- `scripts/jwc-release-validation.ts` (modify)
- possibly a focused manifest-contract test under `packages/coding-agent/test/` or `scripts/`

Plan:

1. Keep local same-batch tarball smoke for `@gajae-code/natives` when validating unpublished local changes.
2. Add a registry-faithful install mode that installs only `jawcode` tarball and lets npm resolve declared dependencies.
3. Add manifest/pack contract checks: no workspace/file specs in runtime deps, file allowlist, pack size ceiling, file-count ceiling.
4. Add native probes on macOS arm64 where practical:
   - `@gajae-code/natives` loads.
   - `better-sqlite3` in-memory DB works on Node SDK path.
   - `markit-ai` / transitive `mupdf` is reachable through a minimal conversion fixture or explicit dependency probe.
   - `@silvia-odwyer/photon-node` WASM can load if image paths are included in the SDK surface.
5. Measure full install footprint and decide whether native/platform splitting is a follow-up or release blocker.
6. Do not make `jawcode` responsible for cli-jaw session lifecycle. `jawcode` gates prove package install, `jwc` CLI launch, `jawcode/sdk` import/loadability, and first-install home bootstrap. Full managed session flows remain cli-jaw integration gates.

### Slice E — Release validation unification

Files:

- `scripts/jwc-release-validation.ts` (modify)
- release/CI scripts as applicable
- `devlog/_plan/260614_cli_jaw_jwc_distribution_strategy/180_validation_matrix.md` (modify)
- `devlog/_plan/260614_cli_jaw_jwc_distribution_strategy/240_publish_readiness_plan.md` (modify)

Plan:

1. Make `bun run validate:jwc-release` the canonical local release gate for `jawcode` packaging.
2. Include bundle, Node SDK build, packed install smoke, cli-jaw home bootstrap test, pack allowlist/size/count, postinstall mode matrix, and relevant MCP/default-surface guards.
3. Reconcile `180_validation_matrix.md` with actual mac MCP/CUA policy.
4. Update `240_publish_readiness_plan.md` from 8 files to the new expected allowlist including bootstrap script/settings seed.
5. Keep actual npm publish out of scope until all gates pass and the user explicitly approves publishing.

### Slice F — Type/export cleanup follow-up

Files:

- `packages/jwc/package.json`
- build/type generation scripts if needed

Plan:

1. Do not block first runtime release on full `.d.ts` generation unless TypeScript consumer quality is a release requirement.
2. Track generated `dist-node/sdk.d.ts` as a follow-up if this release is intended for third-party TS SDK consumers.

## Proposed execution order after approval

1. Resolve interview decisions below.
2. Update the pending P plan to this broadened package-readiness scope.
3. Run `jwc orchestrate a` for independent planner/architect audit.
4. If A passes, implement in B-stage:
   - first user-home bootstrap and tests;
   - then packed smoke/runtime proof hardening;
   - then release validation unification/docs.
5. C-stage runs mechanical gates and adversarial review.

## Verification targets for the eventual B/C stages

Minimum focused gates:

- `bun test packages/coding-agent/test/jwc-cli-jaw-bootstrap.test.ts`
- `bun --cwd=packages/jwc run bundle`
- `bun --cwd=packages/jwc run build:node`
- `node packages/jwc/scripts/smoke-packed-sdk.mjs`
- `bun run validate:jwc-release`
- `npm pack --dry-run --json` from `packages/jwc`

Additional gates if native dependency smoke is implemented:

- packed install with PATH scrubbed to prove `package:bun`.
- packed install with `CLI_JAW_HOME` temp dir and local skills fixture.
- macOS arm64 native load probes for `@gajae-code/natives`, `better-sqlite3`, and selected document/image conversion externals.

## Interview decisions still needed

1. Fresh default CLI: use current Mac `codex`, cli-jaw upstream default, or earlier plan's `claude`?
2. Fresh default model values: seed exactly from cli-jaw upstream defaults, or intentionally copy the maintainer's non-secret current model preferences?
3. Fresh port/theme: should new installs seed `port=3457` and `tui.theme=dark`, or leave port auto/empty and rely on upstream default theme?
4. Install footprint: is the large native/runtime footprint acceptable for this release, or is platform/native splitting a blocker before publishing?
5. Skills network timing: keep GitHub skills clone in non-fatal postinstall as requested, or move clone to first `jwc` run / explicit `jwc bootstrap` command with postinstall only seeding files?

## Interview round 1 answers

User answers on 2026-06-15:

1. Fresh default CLI: `codex`.
2. Settings source: user asked what this means. Interpretation: do not copy the maintainer's live `~/.cli-jaw`; create a deterministic first-install template from cli-jaw upstream defaults plus explicit product overrides from this interview.
3. Port/theme: user asked what `seed` means. Definition recorded: seed = the initial `~/.cli-jaw/settings.json` values written only when the file is missing. Pending default interpretation: keep upstream/auto port/theme unless the user explicitly wants current Mac `port=3457` or `tui.theme=dark`.
4. Install footprint: accept for P0, but gate it with size/native/runtime checks.
5. Skills network timing: non-fatal postinstall clone.

## Interview round 2 correction

User correction on 2026-06-15: `jawcode` is not a session-managed runtime.

Boundary clarification:

- `jawcode` npm package owns installability, the `jwc` bin, package-local Bun provisioning for standalone CLI, `jawcode/sdk` import/loadability, and first-install cli-jaw-compatible home bootstrap.
- `jawcode` does **not** own cli-jaw session lifecycle, channel routing, manager UI sessions, or runtime-session orchestration.
- Therefore release gates must not claim that `jawcode` proves a full managed session. Any `createAgentSession` check is only an SDK export/load smoke unless explicitly moved to a cli-jaw integration gate.
- The existing `180_validation_matrix.md` split remains correct: `runtime session`, channels, fallback, and no-global embedded path are cli-jaw-owned rows.

## Interview round 3 correction

User correction on 2026-06-15: bootstrap should behave like cli-jaw bootstrap, not as a `./cli-jaw` source checkout or session manager.

Concrete boundary:

- `jawcode` install must run a **cli-jaw-compatible bootstrap routine** implemented inside `packages/jwc`, modeled on cli-jaw's `copyDefaultSkills()` behavior.
- The target is the cli-jaw home contract: `CLI_JAW_HOME` when set, otherwise `~/.cli-jaw`.
- Required directories/files are `skills/`, `skills_ref/`, missing-only `settings.json`, missing-only `heartbeat.json`, and missing-only `mcp.json`.
- Skills source priority should mirror cli-jaw's intent for package users: GitHub `lidge-jun/cli-jaw-skills` first, local fixture/source override for tests, then offline/non-fatal remediation. `jawcode` should not rely on a bundled `./cli-jaw` checkout.
- Auto-activation should mirror cli-jaw: base active set plus registry entries with `category = "orchestration"`.
- The implementation must fix the hygiene gap while matching behavior: copy/merge must skip `node_modules` and other cache/build directories.
- `./cli-jaw` source checkout creation is explicitly out of scope.

## Interview round 4 correction — cli-jaw bootstrap timing

User correction on 2026-06-15: it matters whether cli-jaw creates the cli-jaw home during `npm install -g cli-jaw` or during `jaw serve`.

Observed cli-jaw facts:

- `../cli-jaw/package.json` has `postinstall: node scripts/postinstall-guard.cjs`.
- `scripts/postinstall-guard.cjs` runs compiled `dist/bin/postinstall.js` and calls `runPostinstall()`.
- `bin/postinstall.ts::runPostinstall()` is the npm postinstall bootstrap:
  - safe mode creates the home directory only;
  - normal mode creates `JAW_HOME`;
  - creates `skills/` and `uploads/`;
  - writes missing `heartbeat.json`;
  - calls `initMcpConfig(home)`;
  - calls `copyDefaultSkills()`;
  - calls `propagateSkillsToInstances()`;
  - optional CLI/MCP/skill dependency installers run afterward and are warning/non-fatal.
- `bin/commands/serve.ts` calls `loadSettings()` and then spawns the server. It is not the primary skills/home bootstrap entrypoint.
- `src/core/config.ts::loadSettings()` writes missing `settings.json`, but does not clone/activate skills and does not itself create the whole home tree.
- Important split: cli-jaw postinstall does **not** write `settings.json`; missing settings are written by `src/core/config.ts::loadSettings()` when a command such as `jaw serve` loads config, or by `jaw init`.

Plan implication:

- `jawcode` should mirror cli-jaw's **install-time postinstall bootstrap** for the shared home contract, not wait only for a `jwc`/serve runtime command.
- `jawcode` postinstall should be safe and non-fatal like cli-jaw: create the contract home/files where possible, attempt GitHub skills clone/activation, and report remediation without failing npm install.
- `jwc` first run may include a repair/check path, but it must not be the only bootstrap path if the product requirement is “like cli-jaw”.
- Because the user separately requires current/default settings to be available for a `jawcode`-only install, the final plan intentionally chooses the stricter jawcode extension: write a deterministic missing-only `settings.json` seed during postinstall.

## Revised defaults after round 1

- `settings.json` seed source: upstream cli-jaw defaults, not raw current Mac state.
- Explicit override: `cli = "codex"`.
- Secrets/tokens/DBs/uploads/traces/browser profiles/logs: never copied.
- `mcp.json`: write `{ "servers": {} }` only if missing.
- `heartbeat.json`: write `{ "jobs": [] }` only if missing.
- Skills: clone `lidge-jun/cli-jaw-skills` during non-fatal postinstall, with CI/safe skip and first-run/manual remediation path.
- Install footprint: accepted for P0; release gate must measure and report it instead of blocking implementation.
## Interview round 5 — reproducible non-secret install contract

User question on 2026-06-15: after this patch, does a user just install, and can the same environment be reproduced on another PC without secrets or personal information?

Answer recorded for the plan:

- Intended user path after the patch and release gates: `npm install -g jawcode`, then `jwc`.
- The install should reproduce a deterministic **non-secret baseline**:
  - `jawcode` package and runtime dependencies;
  - `jwc` bin;
  - package-local Bun provisioning for standalone CLI;
  - cli-jaw-compatible home target (`CLI_JAW_HOME` or `~/.cli-jaw`);
  - missing-only deterministic `settings.json` seed;
  - missing-only `heartbeat.json`;
  - missing-only `mcp.json` with empty servers;
  - GitHub `lidge-jun/cli-jaw-skills` catalog;
  - default active skills plus registry `category = "orchestration"` skills;
  - hygiene exclusions such as `node_modules`.
- The install must **not** reproduce personal state:
  - API keys, provider auth tokens, browser profiles, DBs, traces, logs, uploads, local-only skills, OS permissions, current chat/session history, or provider login sessions.
- Therefore another PC can reproduce the same usable baseline, not the same personal authenticated environment.
- If GitHub/git/network fails during postinstall, npm install must still succeed; `jwc` first run or a bootstrap/check command should expose repair/remediation.
- This is the reason the plan seeds from source-controlled defaults plus explicit decisions (`cli = "codex"`) rather than copying the maintainer's live `~/.cli-jaw`.
