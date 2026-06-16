# 50 — P-stage Plan: GitHub Deploy Prep via Ultragoal

> Source spec: `.jwc/specs/jaw-interview-github-deploy-prep.md`
> Status: P-stage draft for critic review. No product-source mutation in this stage.
> Execution mode after approval: Ultragoal, aggregate goal with story checkpoints.

## 0. Decision Record

### Principles
- One worktree only.
- Preserve unrelated/user work.
- Commit existing dirty state by functional bundle before CI repair work.
- Do not push.
- Release tag automation remains deferred to tasks 078-079.
- Treat postinstall as a C4 release surface: idempotent, safe-mode aware, non-fatal where appropriate.

### Decision Drivers
- Current repo has dirty tracked/untracked changes across multiple subsystems.
- `bun install --frozen-lockfile` passes on the local checkout; CI remains dirty until `bun.lock` is committed in G001.
- `bun run check:tools` fails with 66 Biome errors.
- `bun --cwd=packages/coding-agent run check:types` fails with 5 real TypeScript errors.
- `bun --cwd=packages/coding-agent test --only-failures` fails with 38 tests.
- There is no current `scripts/*postinstall*` entry and no root `postinstall` script.

### Chosen Option
Proceed in five approved stories:
1. Stabilize dirty worktree into functional-bundle commits.
2. Restore local green gates.
3. Add PR/main CI scope including macOS/smoke/install-method coverage, with release tag automation deferred.
4. Implement postinstall/onboarding surface.
5. Publish developer docs site.

### Alternatives Rejected
- One checkpoint commit for all dirty work: rejected because it destroys traceability and makes CI repair rollback coarse.
- Direct implementation without plan stage: rejected by Ultragoal skill because this is a release/CI/install surface.
- Release tag automation in this pass: deferred by interview decision to 078-079.

## 1. Acceptance Criteria

- [ ] Dirty worktree split into focused `[agent]` commits by functional bundle before CI repair work proceeds.
- [ ] `bun install --frozen-lockfile` passes.
- [ ] `bun run ci:check:full` passes, covering `check:tools`, `check:node20-baseline`, `check:schemas`, and `check:jwc-ui`.
- [ ] `bun --cwd=packages/coding-agent run check:types` passes as the focused package-level typecheck.
- [ ] Focused failing coding-agent tests pass for touched/failing clusters.
- [ ] PR/main CI scope is documented and release tag automation is explicitly deferred to 078-079.
- [ ] postinstall implements automatic tmux/cua-driver/defaults/templates behavior with CI/safe-mode skips.
- [ ] skill deps are opt-in only.
- [ ] GitHub/star prompt, telemetry, or GitHub API mutation is absent from postinstall (plan-level promotion of spec constraints/non-goals).
- [ ] GitHub Pages/VitePress docs expose install, CI, API, and workflow docs.

## 2. Story Plan

### G001 — Stabilize existing dirty worktree into functional-bundle commits

**Goal:** Convert current dirty worktree into reviewable, conflict-safe commits before further CI repair.

**Read/inspect only first:**
- `git status --short`
- `git diff --stat`
- targeted diffs for each changed/untracked file

**Expected functional bundles:**
- Search engine / web search changes:
  - `packages/coding-agent/src/web/search/index.ts`
  - `packages/coding-agent/src/web/search/providers/base.ts`
  - `packages/coding-agent/src/web/search/providers/anthropic.ts`
  - `packages/coding-agent/src/web/search/providers/codex.ts`
  - `packages/coding-agent/src/web/search/providers/gemini.ts`
  - `packages/coding-agent/src/web/search/providers/xai.ts`
  - `packages/coding-agent/test/slash-commands/searchengine-slash.test.ts`
  - untracked search smoke/bench files only if they are intentional product/dev artifacts
- Selector/status/TUI changes:
  - `packages/coding-agent/src/modes/controllers/selector-controller.ts`
  - `packages/coding-agent/src/modes/interactive-mode.ts`
  - `packages/coding-agent/src/modes/types.ts`
  - `packages/tui/src/index.ts`
- Skill discovery/default/config changes:
  - `packages/coding-agent/src/slash-commands/builtin-registry.ts`
  - `schemas/config.schema.json`
  - `packages/coding-agent/src/internal-urls/docs-index.generated.ts`
- Memory/test fixture changes:
  - `packages/coding-agent/test/memories/memory-fts.test.ts`
- Lockfile/generated:
  - `bun.lock`
- Devlog/probe artifacts:
  - `devlog/_plan/260612_jawcode_fork/**`
  - `devlog/_plan/260612_searchengine/**`
  - `packages/jwc/glob_probe*.ts`
  - `packages/jwc/jsonl_shim_probe.ts`

**Commit rule:** stage only one bundle at a time. If a file's ownership is unclear, do not stage it until inspected.

**Verification:** for pure checkpoint bundles, `git diff --cached --check` plus relevant focused command if available. No push.

### G002 — Restore local green gates

**Goal:** Make local green criteria pass.
**Mandatory first step:** rerun `bun --cwd=packages/coding-agent test --only-failures` and reconcile the target list before touching test fixtures; current blocker docs and the latest run may diverge.

**MODIFY candidates:**
- `packages/utils/src/ptree.ts`
  - Before: uses `Response.bytes`, which TypeScript reports missing.
  - After: use supported response body API (`arrayBuffer()` plus `Buffer`/`Uint8Array` as appropriate), preserving runtime behavior.
- `packages/coding-agent/src/tools/image-gen.ts`
  - Before: uses `Response.bytes`, TypeScript reports missing.
  - After: same supported response body API pattern as `ptree.ts`.
- `packages/coding-agent/test/agent-session-auto-compaction-queue.test.ts`
  - Before: test emits unsupported `message_start` / `message_end` stream event types and references missing `continueSpy`.
  - After: align fixtures with current event union and define/replace spy with the current continuation hook.
- `packages/cu-mcp-server/package.json`
  - Before: documented blocker/finding shows zod 3 / TypeScript 5 drift from the workspace catalog.
  - After: either migrate intentionally to zod 4 + TypeScript 6 with tests, or isolate with an explicit workspace override and rationale.
- Biome-flagged files from `bun run check:tools` output:
  - Apply safe organize/import/format fixes where they do not alter product behavior.
  - Honor `jawcode/AGENTS.md` TUI visual protection. Do not apply automatic Biome fixes to protected visual surfaces such as `packages/coding-agent/src/modes/components/welcome.ts`, `packages/tui/src/tui.ts`, or adjacent curated TUI rendering code unless rendered output is verified unchanged.
  - If a Biome error conflicts with protected visual output, prefer a narrow `biome-ignore` with an explanation referencing `AGENTS.md §TUI visual design`, and mention the suppression in the commit message.
- Failing test clusters shown by `bun --cwd=packages/coding-agent test --only-failures`:
  - `skills.test.ts` and `default-jwc-definitions.test.ts`: isolate test home/skill discovery so host `~/.cli-jaw/skills` does not leak into tests.
  - `brand-visual-identity.test.ts`: align expectations with current brand behavior only after confirming visual rules.
  - `interactive-mode-editor-component.test.ts`, `redesigned-shell.test.ts`, `hook-editor.test.ts`, settings selector tests: update fixtures or product behavior according to canonical TUI rules, never simplifying protected visuals.
  - `jwc-runtime/*`: fix state path/session handling instead of weakening assertions.
  - `tools/web-search-codex.test.ts`: align default model expectation with actual provider constant or update constant intentionally.

**Verification:**
- `bun install --frozen-lockfile`
- `bun run ci:check:full`
- `bun --cwd=packages/coding-agent run check:types`
- `bun --cwd=packages/coding-agent test --only-failures`

### G003 — PR/main CI scope and darwin smoke coverage

**Goal:** Make PR/main CI reflect the deploy-prep local gates while keeping release tag automation deferred.

**MODIFY:** `.github/workflows/ci.yml`
- Before: existing Linux/self-hosted check/test/install/release jobs; release tag jobs present.
- After:
  - keep release tag automation existing but explicitly outside this pass unless already green;
  - add or adjust a macos-14 arm64 PR/main smoke job if not already covered;
  - darwin PR/main smoke must be limited to native-independent `--version` and `--help` until a darwin prebuilt addon provisioning path exists; keep native `--smoke-test` release/tag-gated or explicitly provision a matching darwin addon before enabling it;
  - include `bun install --frozen-lockfile`;
  - preserve pinned action SHAs convention.

**MODIFY:** `.github/workflows/dev-ci.yml`
- Before: dev branch affected validation and state gates.
- After: mirror only the minimum darwin smoke/affected coverage needed for dev branch, without duplicating release tag jobs.

**MODIFY:** `devlog/_plan/260613_github_deploy/20_tasks_ci_postinstall.md`
- Before: tasks 040-049 list broad CI work.
- After: mark PR/main CI scope vs 078-079 release automation boundary explicitly.

**Verification:**
- YAML parse/lint through existing configured checks; if no project YAML linter is configured, run a Bun/YAML parse fallback over each modified workflow file.
- `bun run ci:check:full` after workflow edits.

### G004 — postinstall / onboarding implementation

**Goal:** Implement conservative automatic onboarding with explicit safe/CI skips.

**NEW:** `packages/jwc/scripts/postinstall-guard.cjs`
- CommonJS, zero-dep entry owned by the user-facing `jwc` package.
- Detect safe mode:
  - `JAW_SAFE=1`
  - `JWC_SAFE=1`
  - `npm_config_jaw_safe=1`
- Detect CI via `CI=true`.
- On safe mode: print a one-line skip message and exit 0.
- On CI: skip brew/curl/external installers, but still allow pure verification/template code paths that do not touch the real user home.
- On non-darwin: skip brew/cua-driver install; keep defaults/templates and first-run hints.
- Delegate complex work to `packages/jwc/scripts/postinstall.ts` only when Bun is available; otherwise print the manual `jwc setup defaults` hint and exit 0 unless Bun version is below the package engine requirement.

**NEW:** `packages/jwc/scripts/postinstall.ts`
- Responsibilities:
  - resolve user config root as `~/.jwc/agent/` using the existing config-dir helper when importable; otherwise fall back to `path.join(os.homedir(), ".jwc", "agent")`;
  - create `~/.jwc/agent/` if missing;
  - create `mcp.json` only if absent with exact template `{ "mcpServers": {} }`;
  - create `settings.json` only if absent with exact template `{ "mcp.enableProjectConfig": true }`, matching the existing settings schema key;
  - run `jwc setup defaults` or the existing defaults installer idempotently;
  - on darwin and not CI/safe: check `tmux`, attempt `brew install tmux` if missing, non-fatal on failure;
  - on darwin and not CI/safe: check `cua-driver`, attempt documented installer, non-fatal on failure and bounded to 30 seconds;
  - if `JWC_INSTALL_SKILL_DEPS=1`, install documented skill deps; otherwise print opt-in hint;
  - never perform GitHub star prompt, telemetry, or GitHub API mutation.

**MODIFY:** `packages/jwc/package.json`
- Before: no package `postinstall`; user-facing `jwc` package owns bin only.
- After: add `"postinstall": "node scripts/postinstall-guard.cjs"` under scripts and unconditionally add `"scripts"` to the published `files` array.
- Rationale: root `package.json` is private workspace plumbing and must not be the installer owner for npm users.

**DO NOT MODIFY for postinstall ownership:** root `package.json` and `packages/coding-agent/package.json`
- Add root scripts only if docs build requires them in G005.
- Add `packages/coding-agent` postinstall only if implementation proves `jwc` package cannot own the user-facing install hook; otherwise avoid duplicate side effects.

**NEW tests:** `packages/jwc/test/postinstall-guard.test.ts` or nearest existing package test location.
- Safe mode exits 0 and does not create user files.
- CI mode skips brew/curl and external installers.
- Temp HOME/XDG test creates `mcp.json` and exact `settings.json` templates without touching real user home.
- Missing tmux/cua-driver branches are non-fatal.
- `JWC_INSTALL_SKILL_DEPS` is opt-in only.

**Verification:**
- `JAW_SAFE=1 node packages/jwc/scripts/postinstall-guard.cjs`
- `CI=true node packages/jwc/scripts/postinstall-guard.cjs`
- temp HOME dry-run path for template creation.
- `bun --cwd=packages/jwc test` if tests are package-scoped.
- `bun run ci:check:full`
- focused postinstall tests.

### G005 — public documentation site

**Goal:** Make the public documentation site the completion criterion for docs/Pages.

**NEW/MODIFY candidates:**
- First inventory existing `docs/` markdown and classify each relevant page as sidebar-linked, nested raw link, or intentionally omitted before writing the VitePress config.
- `package.json`
  - Add root docs scripts only after adding VitePress:
    - `"docs:dev": "vitepress dev docs"`
    - `"docs:build": "vitepress build docs"`
    - `"docs:preview": "vitepress preview docs"`
  - Add `vitepress@1.x` as a dev dependency or workspace catalog entry compatible with the current Vite 5 catalog pin, unless the Vite catalog is deliberately upgraded with compatibility analysis.
- `docs/.vitepress/config.ts`
  - NEW canonical docs-site config.
  - Title: `Jawcode`.
  - Sidebar groups: Getting Started, CI & Release, API/SDK, Workflows.
  - Nav links: GitHub, Install, Workflows.
- `docs/index.md`
  - MODIFY/NEW public landing page with hero, install path, quick start, and workflow links.
- `docs/install.md`
  - NEW public install/onboarding guide including postinstall behavior, safe mode, CI behavior, and opt-in skill deps.
- `docs/ci.md`
  - NEW PR/main CI guide and explicit release automation deferral to 078-079.
- `docs/workflows.md`
  - NEW public workflow guide for jaw-interview → orchestrate P → pending approval → execution, plus ultragoal/team boundaries.
- `docs/sdk.md`
  - MODIFY existing SDK docs; plan-stage inspection confirms it owns `createAgentSession` and SDK exports, so do not create a parallel `docs/api.md`.
- `.github/workflows/deploy-docs.yml`
  - NEW GitHub Pages workflow:
    - trigger: `push` to `main` and manual dispatch;
    - setup Node 24 + Bun 1.3;
    - `bun install --frozen-lockfile`;
    - `bun run docs:build`;
    - upload Pages artifact from `docs/.vitepress/dist`;
    - deploy with GitHub Pages official actions pinned consistently with repo policy.

**MODIFY:** `README.jwc.md` and/or `README.md`
- Before: repo orientation only.
- After: link to public docs site, install guide, and workflow guide.
- Keep jwc-first public naming; internal `@gajae-code/*` remains only where it is a code fact.

**Verification:**
- `bun run docs:build`
- `bun run ci:check:full` after docs config changes.

### G006 — final integration and quality gate

**Goal:** Prove the approved story set is complete before Ultragoal checkpoint.

**Verification commands:**
- `bun install --frozen-lockfile`
- `bun run ci:check:full`
- `bun --cwd=packages/coding-agent run check:types`
- `bun --cwd=packages/coding-agent test --only-failures`
- focused postinstall tests
- docs build
- relevant CI/dev-ci lint checks

**Review lanes before completion checkpoint:**
- ai-slop-cleaner on changed files.
- Architect review: architecture/product/code all CLEAR.
- Executor QA/red-team: CLI/package/docs surfaces, including safe-mode postinstall and temp HOME install behavior.

## 3. Explicit Non-Goals

- No push.
- No npm publish.
- No GitHub Release creation.
- No release tag automation completion.
- No GitHub star prompt, telemetry, or GitHub API mutation from postinstall.
- No broad visual simplification of protected TUI surfaces.
- No direct edits to `packages/ai/src/models.json`.

## 4. Ultragoal Brief Shape

Use this brief after plan approval:

```text
Shared constraints:
- Work in `700_projects/jawcode`.
- Preserve unrelated/user work.
- Functional-bundle commits first.
- No push.
- Release tag automation is deferred to 078-079.
- postinstall automatic scope: tmux, cua-driver, jwc defaults, settings/mcp templates.
- skill deps opt-in only.
- no GitHub star prompt, telemetry, or GitHub API mutation.

@goal: Stabilize existing dirty worktree
Inspect current dirty files, split them into focused `[agent]` commits by functional bundle, and leave unrelated/unclear files unstaged until ownership is clear.

@goal: Restore local green gates
Make `bun install --frozen-lockfile`, `bun run ci:check:full`, `bun --cwd=packages/coding-agent run check:types`, and fresh focused failing coding-agent tests pass.

@goal: Update PR/main CI scope
Adjust CI/dev-CI for PR/main deploy readiness, including darwin smoke coverage where appropriate, while keeping release tag automation deferred.

@goal: Implement postinstall onboarding
Add safe/CI-aware postinstall guard and implementation for automatic tmux/cua-driver/defaults/templates and opt-in skill deps.

@goal: Publish developer docs site
Add/update VitePress/GitHub Pages docs for install, CI, API/SDK, and workflows, and link from README surfaces.

@goal: Final verification and review gate
Run final commands, ai-slop cleanup, architect review, executor QA/red-team, and checkpoint only if all lanes are clean.
```

## 5. Pending User Approval

This plan is not execution approval by itself. Stage P must stop at pending approval. When approved, continue with `jwc orchestrate a` before build execution.