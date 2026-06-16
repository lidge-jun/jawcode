# 330 — jawcode install bootstraps cli-jaw-compatible home

## Status

P-stage plan draft. No product source mutation in this stage.

## User requirements captured

Target user has **no cli-jaw installation** and installs only `jawcode` / runs `jwc`.

Required outcome:

1. `jawcode` install/initialization creates the cli-jaw-compatible data home. Interpret the user’s `./cli-jaw` wording as the existing cli-jaw data-home contract, defaulting to `~/.cli-jaw` and respecting `CLI_JAW_HOME` when set. It is **not** a source checkout of the `cli-jaw` repository.
2. Skills are downloaded from GitHub during bootstrap. Primary source is `https://github.com/lidge-jun/cli-jaw-skills.git`, matching cli-jaw’s current `copyDefaultSkills()` behavior.
3. The current cli-jaw default settings are seeded for users who do not already have `settings.json`. Existing user settings are never overwritten by postinstall.
4. Skill sync must exclude unnecessary `node_modules` directories and other build/cache trash, including when skills are downloaded from GitHub.

## Current evidence

- `packages/jwc/package.json` currently has only runtime/SDK artifacts in `files` and runs only `node scripts/verify-runtime.cjs --postinstall`.
- `packages/jwc/scripts/verify-runtime.cjs` only checks/skips Bun runtime resolution; it does not create `~/.cli-jaw`, `settings.json`, `skills`, or `skills_ref`.
- cli-jaw’s data home contract is `CLI_JAW_HOME` or `~/.cli-jaw` in `../cli-jaw/src/core/config.ts`.
- cli-jaw’s current skill bootstrap downloads `https://github.com/lidge-jun/cli-jaw-skills.git` and auto-activates `pdf`, `browser`, `memory`, `screen-capture`, `docx`, `xlsx`, `pptx`, `hwp`, `github`, `telegram-send`, `video`, `pdf-vision`, `diagram`, `desktop-control`, plus registry entries with `category: "orchestration"`.
- cli-jaw’s `skills-utils.ts` excludes `node_modules` in tree hashing, but its actual `copyDirRecursive()` does not skip `node_modules`; the jawcode bootstrap must not copy that bug.

## Work classification

C4 release/install surface. The change mutates npm postinstall behavior, creates user-home state, performs network fetches from GitHub, and changes publish package contents. Use full PABCD and release validation before execution.

## Non-goals

- Do not install the `cli-jaw` npm package.
- Do not clone the full `cli-jaw` source repository.
- Do not change `../cli-jaw` in this cycle; jawcode will implement a small compatible bootstrap using cli-jaw’s public home/settings/skills contract.
- Do not overwrite existing `~/.cli-jaw/settings.json`, active skills, user tokens, MCP config, uploads, DB, or any other user data.
- Do not make offline/CI npm installs fail solely because GitHub or `git` is unavailable; bootstrap warnings are allowed, package install remains successful.
- Do not import live Codex user skills from `~/.codex/skills` in the jawcode-only bootstrap. That cli-jaw convenience path remains cli-jaw-owned; jawcode only needs the GitHub skill catalog plus bundled settings seed.

## Implementation plan

### 330.1 — Add packaged cli-jaw settings seed

**NEW** `packages/jwc/defaults/cli-jaw/settings.json`

Purpose: deterministic settings seed for users without cli-jaw. This bundled file is the MVP source of truth; no remote settings URL is used in the first implementation. Future remote settings sync must be a separate plan because it changes trust/update semantics.

Content outline:

```json
{
  "port": "",
  "cli": "codex",
  "fallbackOrder": [],
  "showReasoning": false,
  "permissions": "auto",
  "workingDir": "__CLI_JAW_HOME__",
  "perCli": {
    "agy": { "model": "Gemini 3.5 Flash (Medium)", "effort": "" },
    "pi": { "provider": "progrok", "model": "grok-composer-2.5-fast", "effort": "medium" },
    "ai-e": { "provider": "claude", "model": "claude-opus-4-8", "effort": "medium" },
    "claude": { "model": "claude-opus-4-8", "effort": "medium" },
    "claude-e": { "model": "claude-opus-4-8", "effort": "medium" },
    "codex": { "model": "gpt-5.5", "effort": "medium" },
    "codex-app": { "model": "gpt-5.5", "effort": "medium" },
    "cursor": { "model": "composer-2.5", "effort": "medium" },
    "gemini": { "model": "gemini-3-flash-preview", "effort": "" },
    "grok": { "model": "grok-build", "effort": "" },
    "jwc": { "model": "claude-fable-5", "effort": "high" },
    "kiro-code": { "model": "auto", "effort": "" },
    "opencode": { "model": "opencode-go/kimi-k2.6", "effort": "" },
    "copilot": { "model": "claude-sonnet-4.6", "effort": "high" }
  },
  "pi": {
    "defaultProfileId": "progrok",
    "profiles": [{
      "id": "progrok",
      "label": "Progrok",
      "mode": "basic",
      "endpoint": "http://127.0.0.1:18645/v1",
      "apiKind": "openai-completions",
      "apiKey": "dummy",
      "model": "grok-composer-2.5-fast",
      "reasoning": true,
      "supportsDeveloperRole": true,
      "supportsReasoningEffort": true
    }],
    "discoveredModels": { "progrok": ["grok-composer-2.5-fast", "grok-4.3"] }
  },
  "heartbeat": { "enabled": false, "every": "30m", "activeHours": { "start": "08:00", "end": "22:00" }, "target": "all" },
  "channel": "telegram",
  "telegram": { "enabled": false, "token": "", "allowedChatIds": [], "forwardAll": true, "mentionOnly": true },
  "discord": { "enabled": false, "token": "", "guildId": "", "channelIds": [], "forwardAll": true, "allowBots": false, "mentionOnly": false },
  "messaging": { "latestSeen": { "telegram": null, "discord": null }, "lastActive": { "telegram": null, "discord": null } },
  "memory": { "enabled": true, "flushEvery": 10, "cli": "", "model": "", "retentionDays": 30, "flushLanguage": "en", "autoReflectAfterFlush": false, "flushMessageWindow": 0 },
  "trace": { "retentionDays": 7, "maxRows": 50000 },
  "code": { "maxConcurrentSessions": 4, "idleReapMs": 30000 },
  "tui": { "pasteCollapseLines": 2, "pasteCollapseChars": 160, "keymapPreset": "default", "diffStyle": "summary", "themeSeed": "jaw-default" },
  "employees": [],
  "projectDirs": null,
  "locale": "ko",
  "avatar": { "agent": { "imagePath": "", "updatedAt": null }, "user": { "imagePath": "", "updatedAt": null } },
  "stt": { "engine": "auto", "geminiApiKey": "", "geminiModel": "gemini-2.5-flash-lite", "promptPath": "prompts/stt-system.md", "whisperModel": "mlx-community/whisper-large-v3-turbo", "openaiBaseUrl": "", "openaiApiKey": "", "openaiModel": "", "vertexConfig": "" },
  "jawCeo": { "openaiApiKey": "" },
  "network": { "bindHost": "127.0.0.1", "lanBypass": false, "remoteAccess": { "mode": "off", "trustProxies": false, "trustForwardedFor": false, "publicOriginHint": "", "requireAuth": true } }
}
```

Implementation note: replace `__CLI_JAW_HOME__` with the resolved target directory before writing. Keep token values empty or dummy exactly like cli-jaw defaults; do not copy secrets from the maintainer machine.
Source note: `claude-opus-4-8` is the current cli-jaw default from `../cli-jaw/src/cli/claude-models.ts:getDefaultClaudeModel()`. If cli-jaw changes that default before implementation, update this seed and the bootstrap test in the same patch.

### 330.2 — Add Node-only bootstrap script

**NEW** `packages/jwc/scripts/bootstrap-cli-jaw-home.cjs`

Required behavior:

- Runs under plain Node during npm lifecycle; no Bun APIs and no TypeScript.
- Resolves target home:
  1. `CLI_JAW_HOME` if set;
  2. otherwise `path.join(os.homedir(), ".cli-jaw")`.
- Creates:
  - target home;
  - `skills/`;
  - `skills_ref/`;
  - `uploads/`;
  - `prompts/` as an empty compatibility directory only. Do not seed `prompts/stt-system.md` in MVP; cli-jaw/STT runtime behavior owns that file on first use.
  - minimal `mcp.json` if missing, exactly `{ "servers": {} }`, so no external MCP server is configured as a side effect.
- Resolves package root as `const packageRoot = path.join(__dirname, "..")`; the script lives in `scripts/`, so this works in source checkout and packed `package/scripts/`.
- Reads the packaged seed from `path.join(packageRoot, "defaults", "cli-jaw", "settings.json")`.
- Replaces `__CLI_JAW_HOME__` with the resolved target home.
- Writes the result to `<targetHome>/settings.json` only when the file is missing.
- Writes `heartbeat.json` only when missing, with `{ "jobs": [] }`.
- Downloads skills into a temp dir under target home using:
  - override local fixture: `JWC_CLI_JAW_SKILLS_SOURCE_DIR=/abs/path`;
  - override repo: `JWC_CLI_JAW_SKILLS_REPO=<git-url>`;
  - default repo: `https://github.com/lidge-jun/cli-jaw-skills.git`.
- Uses `child_process.execFileSync("git", ["clone", "--depth", "1", repo, tmp])`; no shell string.
- Merges source entries into `skills_ref/` using the ported merge helpers below.
- Auto-activates the standard set into `skills/`:
  - `pdf`, `browser`, `memory`, `screen-capture`, `docx`, `xlsx`, `pptx`, `hwp`, `github`, `telegram-send`, `video`, `pdf-vision`, `diagram`, `desktop-control`;
  - plus any `registry.json` skill whose `category` is `orchestration`.
- Excludes from every recursive copy and fingerprint:
  - directories: `.git`, `node_modules`, `__pycache__`, `.venv`, `venv`, `dist`, `build`, `.next`, `.turbo`;
  - files: `.DS_Store`, `*.pyc`.
- Does not remove or overwrite active user skills unless a source skill is explicitly newer by registry semver or tree fingerprint.
- Writes clone metadata to `.skills_clone_meta.json` as `{ "lastAttempt": <epoch-ms>, "success": <boolean> }`.
- Uses a 10 minute cooldown after failed clone attempts and an 80 second clone timeout, mirroring cli-jaw’s current constants.
- Exits `0` on postinstall even if GitHub download fails; prints remediation:
  - `git clone --depth 1 https://github.com/lidge-jun/cli-jaw-skills.git ~/.cli-jaw/skills_ref`
  - `npm --prefix "$(npm root -g)/jawcode" run bootstrap:cli-jaw` for global installs, or `node <installed-jawcode>/scripts/bootstrap-cli-jaw-home.cjs` for direct script use.

Required command flags/env:

- `--postinstall`: non-fatal warning mode.
- `--check`: validate target home has `settings.json`, `skills_ref/registry.json`, and at least one active skill.
- `--json`: machine-readable result.
- `JWC_SKIP_CLI_JAW_BOOTSTRAP=1`: in postinstall mode create the target home directory only, skip settings/heartbeat/mcp/skills/network, and report `skills.status = "skipped"` in JSON; in `--check` mode do not mutate and report `ok = false`, `status = "skipped-not-ready"` if required files are absent.
- `JWC_SAFE=1` or `CI=true`: create home/settings/heartbeat/mcp only; skip network clone and active-skill mutation, then report `skills.status = "safe-skipped"`.
- `JWC_FORCE_CLI_JAW_SKILLS=1` or `JAW_FORCE_CLONE=1`: bypass failed-clone cooldown.

A-stage superseding constraints:

- The settings seed is a deterministic jawcode extension written during postinstall when missing; this intentionally differs from cli-jaw's settings timing because the jawcode-only install requirement includes default settings readiness.
- The seed must use explicit product override `cli = "codex"`; stale `cli = "claude"` references in this document are superseded.
- Add a shared home resolver slice before claiming `CLI_JAW_HOME` support: bootstrap and coding-agent skill discovery must resolve `CLI_JAW_HOME || ~/.cli-jaw` consistently.
- The bootstrap implementation must stay minimal and Node-only; large copied cli-jaw routines require drift-check tests or fixture assertions against cli-jaw behavior.
Minimal bootstrap contract (not a wholesale cli-jaw copy):

- `resolveCliJawHome()` — shared contract with `packages/coding-agent` discovery: `CLI_JAW_HOME` when set, otherwise `~/.cli-jaw`; support `~` expansion and absolute normalization.
- `ensureBaseHome()` — create home, `skills/`, `skills_ref/`, `uploads/`, `prompts/`, and missing-only `settings.json`/`heartbeat.json`/`mcp.json` according to mode.
- `resolveSkillsSource()` — local fixture override, GitHub repo override/default, existing `skills_ref`, or non-fatal none.
- `mergeSkillsRef()` — merge source into `skills_ref` using version/fingerprint checks and the ignore set; no `node_modules`/cache/build dirs.
- `buildAutoActivateSet()` — base active set plus registry entries where `category === "orchestration"`.
- `activateSkills()` — sync only auto-active skills from `skills_ref` to `skills/` with the same ignore set.
- `emitBootstrapResult()` — stable `--json` status for tests and postinstall diagnostics.

Drift contract test required before B completion:

- Add a focused test/fixture that compares the jawcode bootstrap contract to cli-jaw behavior facts, not cli-jaw implementation internals:
  - base auto-activate IDs match the expected cli-jaw set recorded in this plan;
  - registry `category: "orchestration"` skills are auto-activated;
  - ignored directories/files include `node_modules`, `.git`, `__pycache__`, `.venv`, `venv`, `dist`, `build`, `.next`, `.turbo`, `.DS_Store`, and `*.pyc`;
  - failed clone cooldown and force envs exist (`JWC_FORCE_CLI_JAW_SKILLS`, `JAW_FORCE_CLONE`);
  - no `./cli-jaw` checkout path is used.

`tmpClone` lifecycle: remove stale `<targetHome>/.skills_clone_tmp` before clone, clone into it, merge from it, then remove it in `finally`.

`--json` result shape:

```ts
type BootstrapStatus = "written" | "exists" | "skipped-safe-mode" | "skipped-disabled" | "failed-nonfatal";
interface CliJawBootstrapResult {
  ok: boolean;
  targetHome: string;
  safeMode: boolean;
  postinstall: boolean;
  settings: { path: string; status: BootstrapStatus };
  heartbeat: { path: string; status: BootstrapStatus };
  mcp: { path: string; status: BootstrapStatus };
  skills: {
    activeDir: string;
    refDir: string;
    status: BootstrapStatus;
    source: "github" | "local-fixture" | "existing" | "none";
    downloaded: boolean;
    activeCount: number;
    refCount: number;
    ignoredDirNames: string[];
    error?: string;
  };
}
```

### 330.3 — Wire bootstrap into the published package

**MODIFY** `packages/jwc/package.json`

Before:

```json
"files": [
  "bin",
  "dist",
  "dist-node",
  "scripts/resolve-bun-runtime.cjs",
  "scripts/verify-runtime.cjs",
  "src/index.ts",
  "src/sdk.ts"
],
"scripts": {
  "bundle": "bun build src/cli-entry.ts --target=bun --outfile=dist/jwc.bundle.js --external mupdf --external markit-ai --external @gajae-code/natives",
  "build:node": "bun scripts/build-node.ts",
  "postinstall": "node scripts/verify-runtime.cjs --postinstall",
  "verify:runtime": "node scripts/verify-runtime.cjs",
  "smoke:node-sdk": "node scripts/smoke-node-sdk.mjs",
  "smoke:packed-sdk": "node scripts/smoke-packed-sdk.mjs"
}
```

After:

```json
"files": [
  "bin",
  "dist",
  "dist-node",
  "defaults/cli-jaw/settings.json",
  "scripts/resolve-bun-runtime.cjs",
  "scripts/verify-runtime.cjs",
  "scripts/bootstrap-cli-jaw-home.cjs",
  "src/index.ts",
  "src/sdk.ts"
],
"scripts": {
  "bundle": "bun build src/cli-entry.ts --target=bun --outfile=dist/jwc.bundle.js --external mupdf --external markit-ai --external @gajae-code/natives",
  "build:node": "bun scripts/build-node.ts",
  "bootstrap:cli-jaw": "node scripts/bootstrap-cli-jaw-home.cjs",
  "postinstall": "node scripts/verify-runtime.cjs --postinstall && node scripts/bootstrap-cli-jaw-home.cjs --postinstall",
  "verify:runtime": "node scripts/verify-runtime.cjs",
  "smoke:node-sdk": "node scripts/smoke-node-sdk.mjs",
  "smoke:packed-sdk": "node scripts/smoke-packed-sdk.mjs"
}
```

### 330.4 — Extend packed install smoke

**MODIFY** `packages/jwc/scripts/smoke-packed-sdk.mjs`

Before:

```js
writeFileSync(path.join(tempRoot, "package.json"), `${JSON.stringify({ type: "module" }, null, "\t")}\n`);
run("npm", ["install", jawcodeTarballPath, nativesTarballPath, "--ignore-scripts=false"], { cwd: tempRoot });
const versionOutput = run(path.join(nodeModules, ".bin", "jwc"), ["--version"], { cwd: tempRoot });
assert.equal(versionOutput, `jwc/${packageJson.version}`);
```

After:

```js
const cliJawHome = path.join(tempRoot, "cli-jaw-home");
const skillsFixture = path.join(tempRoot, "skills-fixture");
writeBootstrapSkillsFixture(skillsFixture);
writeFileSync(path.join(tempRoot, "package.json"), `${JSON.stringify({ type: "module" }, null, "\t")}\n`);
run("npm", ["install", jawcodeTarballPath, nativesTarballPath, "--ignore-scripts=false"], {
  cwd: tempRoot,
  env: {
    ...process.env,
    CLI_JAW_HOME: cliJawHome,
    JWC_CLI_JAW_SKILLS_SOURCE_DIR: skillsFixture
  }
});
const versionOutput = run(path.join(nodeModules, ".bin", "jwc"), ["--version"], { cwd: tempRoot });
assert.equal(versionOutput, `jwc/${packageJson.version}`);
assert.ok(existsSync(path.join(cliJawHome, "settings.json")));
assert.ok(existsSync(path.join(cliJawHome, "heartbeat.json")));
assert.ok(existsSync(path.join(cliJawHome, "mcp.json")));
assert.deepEqual(JSON.parse(readFileSync(path.join(cliJawHome, "mcp.json"), "utf8")), { servers: {} });
assert.ok(existsSync(path.join(cliJawHome, "skills_ref", "registry.json")));
assert.ok(existsSync(path.join(cliJawHome, "skills", "github", "SKILL.md")));
assert.equal(existsSync(path.join(cliJawHome, "skills_ref", "github", "node_modules")), false);
assert.equal(process.env.JWC_BUN_RUNTIME_SOURCE || readRuntimeSourceFromSmoke(), "package:bun");
const helpOutput = run(path.join(nodeModules, ".bin", "jwc"), ["--help"], {
  cwd: tempRoot,
  env: scrubPathForPackageLocalBun({ ...process.env, CLI_JAW_HOME: cliJawHome })
});
assert.match(helpOutput, /jwc/i);
assertSafeModePostinstallMatrix(jawcodeTarballPath, nativesTarballPath);
assertRegistryFaithfulInstallMode(jawcodeTarballPath);
```

A-stage additions to `330.4`:

- The packed smoke must scrub `PATH`, unset `JWC_BUN_PATH`, and prove package-local Bun rather than `system:PATH`.
- `jwc --help` is required in addition to `jwc --version`.
- A postinstall mode matrix is required: normal, `CI=true`, `JWC_SAFE=1`, and `JWC_SKIP_CLI_JAW_BOOTSTRAP=1`.
- A registry-faithful install mode is required: install only the `jawcode` tarball and let npm resolve declared registry dependencies.
- The smoke must assert temp `CLI_JAW_HOME` is the same path used by bootstrap and skill discovery.

Also add helper in the same file:

```js
function writeBootstrapSkillsFixture(root) {
  mkdirSync(path.join(root, "github", "node_modules", "left-pad"), { recursive: true });
  writeFileSync(path.join(root, "registry.json"), JSON.stringify({ skills: { github: { version: "1.0.0", category: "orchestration" } } }, null, 2));
  writeFileSync(path.join(root, "github", "SKILL.md"), "---\nname: github\n---\n# GitHub\n");
  writeFileSync(path.join(root, "github", "node_modules", "left-pad", "index.js"), "module.exports = 1;\n");
}
```

### 330.5 — Add focused bootstrap unit coverage

**NEW** `packages/coding-agent/test/jwc-cli-jaw-bootstrap.test.ts`

Test cases:

1. `bootstrap creates cli-jaw home without cli-jaw installed`
   - creates temp `CLI_JAW_HOME` and temp skills fixture;
   - runs `node packages/jwc/scripts/bootstrap-cli-jaw-home.cjs --json`;
   - asserts `settings.json`, `heartbeat.json`, `skills_ref/registry.json`, and auto-active `skills/github/SKILL.md` exist.
   - asserts `mcp.json` equals `{ "servers": {} }` and `prompts/` exists but `prompts/stt-system.md` does not.
2. `bootstrap preserves existing settings`
   - prewrites `settings.json` with sentinel field;
   - runs bootstrap;
   - asserts sentinel remains and `workingDir` was not rewritten.
3. `bootstrap excludes skill node_modules`
   - fixture includes `skill/node_modules/pkg/index.js`;
   - asserts target `skills_ref/skill/node_modules` and active `skills/skill/node_modules` do not exist.
4. `safe mode skips network but seeds settings`
   - env `CI=true`, no skills source;
   - asserts settings and heartbeat are written, JSON result reports `skills.status = "skipped-safe-mode"`.
   - asserts minimal `mcp.json` is still written in safe mode.
5. `bootstrap clone failure is non-fatal in postinstall`
   - env points `JWC_CLI_JAW_SKILLS_REPO` at an invalid local URL or missing fixture;
   - runs script with `--postinstall --json`;
   - asserts exit code `0`, `ok: true`, `skills.status = "failed-nonfatal"`, and settings/heartbeat/mcp still exist.
6. `settings seed stays aligned with current cli-jaw defaults`
   - parses `packages/jwc/defaults/cli-jaw/settings.json`;
   - asserts known values from the approved jawcode seed decision: `cli = "codex"`, `perCli.claude.model = "claude-opus-4-8"`, `perCli.jwc.model = "claude-fable-5"`, `tui.themeSeed = "jaw-default"`, `network.bindHost = "127.0.0.1"`;
   - asserts no secret-bearing fields are prefilled except the existing dummy `pi.profiles[0].apiKey = "dummy"`.
7. `optional live GitHub skills clone`
   - skipped unless `JWC_LIVE_SKILLS_CLONE=1`;
   - uses the default GitHub repo and asserts `skills_ref/registry.json` exists without checking in downloaded content.

### 330.6 — Include bootstrap in release validation

**MODIFY** `scripts/jwc-release-validation.ts`

Before:

```ts
const steps: Step[] = [
  { name: "jwc bundle", args: ["bun", "--cwd=packages/jwc", "run", "bundle"] },
  { name: "jwc node sdk bundle", args: ["bun", "--cwd=packages/jwc", "run", "build:node"] },
  { name: "packed sdk smoke", args: ["node", "packages/jwc/scripts/smoke-packed-sdk.mjs"] },
  { name: "release publish contract", args: ["bun", "test", "scripts/release-publish-order.test.ts"] },
```

After:

```ts
const steps: Step[] = [
  { name: "jwc bundle", args: ["bun", "--cwd=packages/jwc", "run", "bundle"] },
  { name: "jwc node sdk bundle", args: ["bun", "--cwd=packages/jwc", "run", "build:node"] },
  { name: "cli-jaw home bootstrap", args: ["bun", "test", "packages/coding-agent/test/jwc-cli-jaw-bootstrap.test.ts"] },
  { name: "pack manifest contract", args: ["bun", "test", "packages/coding-agent/test/jwc-package-manifest-contract.test.ts"] },
  { name: "packed sdk smoke", args: ["node", "packages/jwc/scripts/smoke-packed-sdk.mjs"] },
  { name: "postinstall mode matrix", args: ["node", "packages/jwc/scripts/smoke-packed-sdk.mjs", "--postinstall-matrix"] },
  { name: "registry-faithful install", args: ["node", "packages/jwc/scripts/smoke-packed-sdk.mjs", "--registry-faithful"] },
  { name: "native probes", args: ["node", "packages/jwc/scripts/smoke-packed-sdk.mjs", "--native-probes"] },
  { name: "release publish contract", args: ["bun", "test", "scripts/release-publish-order.test.ts"] },
```

### 330.7 — Optional command exposure after MVP

Do **not** add a new public CLI command in the first patch unless implementation needs it for remediation. If added later, prefer `jwc setup cli-jaw` or `jwc bootstrap cli-jaw`, backed by the same Node script. For MVP, npm postinstall and `npm --prefix ... run bootstrap:cli-jaw` are sufficient.

## Acceptance criteria

- Fresh `npm install -g jawcode` (or packed install smoke) with no cli-jaw package installed creates a cli-jaw-compatible home.
- `CLI_JAW_HOME` is respected in tests and install smoke.
- Missing `settings.json` is seeded with cli-jaw defaults plus explicit jawcode override `cli = "codex"`; existing settings are preserved byte-for-byte or semantically equivalent with sentinel values intact.
- Missing `heartbeat.json` and minimal `mcp.json` are created without external server side effects.
- `skills_ref/registry.json` and default active skills exist after online/bootstrap-fixture install.
- No `node_modules` directory is copied under `skills_ref/**` or `skills/**`.
- Postinstall remains non-fatal when GitHub is unreachable, `git` is unavailable, or safe mode is active.
- `npm pack --dry-run` includes the new bootstrap script and settings seed but does not include downloaded skills or any `node_modules` content from skills.

## Verification plan

Run after implementation:

```sh
bun test packages/coding-agent/test/jwc-cli-jaw-bootstrap.test.ts
bun test packages/coding-agent/test/jwc-package-manifest-contract.test.ts
bun --cwd=packages/jwc run bundle
bun --cwd=packages/jwc run build:node
node packages/jwc/scripts/smoke-packed-sdk.mjs
node packages/jwc/scripts/smoke-packed-sdk.mjs --postinstall-matrix
node packages/jwc/scripts/smoke-packed-sdk.mjs --registry-faithful
node packages/jwc/scripts/smoke-packed-sdk.mjs --native-probes
node packages/jwc/scripts/verify-runtime.cjs
bun run validate:jwc-release
npm --prefix packages/jwc pack --dry-run --json
```

For the final command, inspect JSON and confirm:

- includes `package/scripts/bootstrap-cli-jaw-home.cjs`;
- includes `package/defaults/cli-jaw/settings.json`;
- excludes `package/skills_ref/**`;
- excludes any skill `node_modules`.

## Risks and mitigations

| Risk | Mitigation |
|---|---|
| npm postinstall network behavior surprises users | Non-fatal, explicit skip env, safe mode, bundled settings fallback. |
| Settings seed drifts from cli-jaw defaults | Record source lines in this plan; add test comparing required keys/known values. Future cli-jaw changes require updating the jawcode seed. |
| GitHub clone unavailable | Warn and keep install successful; user can rerun bootstrap. Settings/home still exist. |
| Huge skill copies due to vendored dependencies | Recursive copy ignore set and explicit tests assert `node_modules` exclusion. |
| User existing cli-jaw data overwritten | Only write missing settings/heartbeat; active skill updates are version/fingerprint gated; never touch DB/uploads/tokens. |
