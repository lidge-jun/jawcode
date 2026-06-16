# Jawcode Agent Contract

Jawcode (`jwc`) is this repository's coding-agent implementation, forked from [`gajae-code`](https://github.com/Yeachan-Heo/gajae-code). The internal `@gajae-code/*` package namespace originates from that upstream repo. Treat this file as the repo-local operating contract for contributors and automated agents working in this tree.

## Public workflow surface

JWC bundles default skill definitions in two categories: four **workflow skills** (`jaw-interview`, `plan`, `goal`, `team`) and two **tool-help skills** (`browse`, `search`). Workflow skills define the public workflow surface; tool-help skills are `hide: true` utility references loadable via `/skill:<name>` but excluded from the idle system prompt. Do not add workflow definitions without an explicit product decision and gate update. JWC also bundles five callable task role agents for delegation; these are not workflow skills and are not committed repo-visible `.jwc` defaults.


| Public workflow | Purpose | Bundled source file |
| --- | --- | --- |
| `jaw-interview` | Socratic requirements interview; writes approved specs under `.jwc/specs/`. | `packages/coding-agent/src/defaults/jwc/skills/jaw-interview/SKILL.md` |
|`plan` / `jwc orchestrate`|Native IPABCD/PABCD planning, audit, build, check, and done gate.|`packages/coding-agent/src/defaults/jwc/skills/plan/SKILL.md`|
|`goal` / `jwc goal`|Durable execution goal ledger and evidence checkpoints.|`packages/coding-agent/src/defaults/jwc/skills/goal/SKILL.md`|
| `team` | Tmux-backed parallel execution using `.jwc/state/team/`. | `packages/coding-agent/src/defaults/jwc/skills/team/SKILL.md` |
| `browse` | Tool-help: detailed browser tool usage, tab helpers, selectors, attached apps. `hide: true`. | `packages/coding-agent/src/defaults/jwc/skills/browse/SKILL.md` |
| `search` | Tool-help: search strategy, tool routing, query normalization, citation rules. `hide: true`. | `packages/coding-agent/src/defaults/jwc/skills/search/SKILL.md` |

| Role agent | Purpose | Bundled source file |
| --- | --- | --- |
| `executor` | Default general-purpose implementation/research subagent; normal execution-model fork lane. | `packages/coding-agent/src/prompts/agents/executor.md` |
| `executor_ext` | External/fresh/model-configurable executor lane for user-requested external implementation or research; reuses executor behavior. | `packages/coding-agent/src/prompts/agents/executor.md` via `packages/coding-agent/src/task/agents.ts` |
| `architect` | Read-only architecture and code-review lane, PABCD-lifecycle-centered but directly callable on request. | `packages/coding-agent/src/prompts/agents/architect.md` |
| `planner` | Read-only sequencing and handoff planning lane, PABCD-lifecycle-centered but directly callable on request. | `packages/coding-agent/src/prompts/agents/planner.md` |
| `critic` | Read-only plan critique and actionability review, PABCD-lifecycle-centered but directly callable on request. | `packages/coding-agent/src/prompts/agents/critic.md` |

Rules:
- Bundled default workflow skills load from `packages/coding-agent/src/defaults/jwc/skills`.
- Bundled role agents load from `packages/coding-agent/src/prompts/agents`.
- `executor_ext` is a callable task role and model target, not a workflow skill. It reuses executor behavior but selects the external/fresh executor lane; prefer explicit `provider/modelId[:effort]` selectors when documenting or invoking its model.
- `architect`, `planner`, and `critic` remain read-only for product files, but may use their restricted `bash` tool only for sanctioned workflow CLI persistence (`jwc orchestrate ...`, `jwc planphase --write ...`) and JWC workflow state read/write/contract commands (`jwc state ...`); the bash tool blocks env overrides, direct handoffs, state clears, artifact file-path ingestion, and all other command shapes for those role agents.
- Do not commit repo-visible `.jwc` default definitions; runtime user/project `.jwc` discovery remains supported for local overrides and installed configs.
- Runtime state, plans, specs, and workflow ledgers belong under `.jwc/`.
- Preserve upstream attribution in source comments/docs where appropriate, but public commands, paths, and examples must use `jwc` and `.jwc`.
- Keep source-bundled workflow skills and role agents in sync with tests/gates; do not rely on committed `.jwc` copies.

## Workflow routing

Use the smallest workflow that satisfies the request:

1. Direct implementation for clear, low-risk edits.
2. `jaw-interview` when intent, scope, or acceptance criteria are ambiguous.
3. `plan` / `jwc orchestrate p` when requirements are clear enough to plan but architecture, sequencing, or verification needs consensus.
4. `goal` / `jwc goal` when work should be split into durable goals with an auditable ledger.
5. `team` when approved work benefits from parallel workers.

Do not execute implementation from `jaw-interview` or the planning stage unless the user explicitly approves execution. Planning artifacts must remain `pending approval` until that approval exists.

Subagent await timeouts are observation windows, not failure signals. Do not cancel a subagent merely because `subagent await` timed out; inspect/list, continue independent work, and cancel only when the subagent has actually failed, gone off-track, or become unrecoverably wrong.

## Repository focus

This repo contains multiple packages, but `packages/coding-agent/` is the primary product surface. Unless otherwise specified, assume work refers to that package.

When the user says "agent" or asks why the agent behaves a certain way, they mean the coding-agent CLI implementation, not the assistant currently editing the repo.

## Documentation canon and development log

Use this `AGENTS.md` as the first-stop document canon guide for the Jawcode tree. When documentation sources disagree, resolve them in this order:

1. Current user instruction and active workflow stage.
2. Nearest directory-local `AGENTS.md`.
3. This project-root `AGENTS.md`.
4. `README.jwc.md` for Jawcode-facing orientation, then `README.md` for upstream/package-facing orientation.
5. `structure/` for maintained maps and status pages.
6. `devlog/_plan/` for historical plan context.

For the current package/deploy strategy, use `devlog/_plan/260614_cli_jaw_jwc_distribution_strategy/000_moc_distribution_strategy.md` first. It records the `jawcode` npm package, `jwc` bin, `jawcode/sdk` embedding surface, managed Bun distribution contract, and cli-jaw package-dependency integration plan.

Keep durable development-log notes in this file when they affect how future agents should navigate the repository, especially canonical-doc decisions, source-of-truth changes, or workflow-surface changes. Use `devlog/_plan/` for long-form implementation plans and `structure/` for maintained reference docs; do not duplicate the same rule in all three places unless the README needs a pointer.

### Jawdev documentation model

`jawdev` is the Jawcode development-documentation discipline that keeps three document layers separate:

- `structure/`: maintained current-state source of truth for architecture, contracts, conventions, readiness, navigation, and stable rules.
- `struct_har/`: comparison + harness layer for regenerated `gjc_origin` ↔ `jwc_patched` snapshots, OMP reference facts, chase gap indexes, and `struct_har/_scripts/` regeneration tooling.
- `devlog/`: Jawdev logic record for plan folders under `devlog/_plan/`, MOC/phase numbering, concrete file-level plans, decisions, evidence, and historical implementation context. Devlog filenames must preserve lexicographic execution order by implementation phase: small plans may use `10/20/30` phase bands, large plans may use `100/200/300`, and PABCD artifacts belong inside the relevant phase sequence as plan/audit/synthesis/build/check records rather than as top-level P/A/B/C/D bands. It is not the canonical current-state map; promote stable rules back into `structure/` or this `AGENTS.md`.

### Development log

- 2026-06-12: Project README pointers now direct agents to this `AGENTS.md` for the documentation canon guide and durable agent-facing development-log notes.
- 2026-06-12: Public docs (`README*.md`, `AGENTS.md`, `CONTRIBUTING.jwc.md`, `structure/`) are jwc-first. Keep `jwc` only for preserved internal identifiers, upstream baseline paths, compatibility notes, and code-fact citations.

| Package | Description |
| --- | --- |
| `packages/ai` | Multi-provider LLM client with streaming support |
| `packages/agent` | Agent runtime with tool calling and state management |
| `packages/coding-agent` | Main JWC CLI application |
| `packages/tui` | Terminal UI library with differential rendering |
| `packages/natives` | Native text/image/grep bindings |
| `packages/stats` | Local observability dashboard (`jwc stats`) |
| `packages/utils` | Shared utilities |
| `crates/pi-natives` | Rust native helpers |

## Code quality

- No `any` unless absolutely necessary.
- Never use `ReturnType<>`; write the actual type name.
- No inline imports: no `await import()`, no `import("pkg").Type`, no dynamic type imports. Use top-level imports.
- Check `node_modules` for external API types instead of guessing.
- Prefer `export * from "./module"` in barrel files. If star exports create ambiguity, remove the redundant path.
- Use ES `#private` fields. Do not use `private`, `protected`, or `public` on fields/methods except constructor parameter properties where TypeScript requires it.
- Use `Promise.withResolvers()` instead of `new Promise((resolve, reject) => ...)`.
- Prompts live in static `.md` files imported with `with { type: "text" }`; do not build prompts inline in code.
- Never edit `packages/ai/src/models.json` directly. Change generator/descriptors/resolvers and regenerate with `bun --cwd=packages/ai run generate-models`.

## Bun and filesystem conventions

Prefer Bun APIs where they are cleaner:

| Operation | Use | Avoid |
| --- | --- | --- |
| File read/write | `Bun.file()`, `Bun.write()` | `readFileSync`, `writeFileSync` |
| Spawn simple commands | Bun Shell (`$\`cmd\``) | `child_process` |
| Sleep | `Bun.sleep(ms)` | timeout promises |
| JSON5/JSONL | `Bun.JSON5`, `Bun.JSONL` | ad-hoc parsers |
| String width/wrap | `Bun.stringWidth`, `Bun.wrapAnsi` | custom ANSI wrapping |

Use namespace imports for Node modules:

```ts
import * as fs from "node:fs/promises";
import * as path from "node:path";
import * as os from "node:os";
```

Use `node:fs/promises` for directory operations. Avoid redundant parent-directory creation before `Bun.write()`.

## Worker scripts

Spawn workers with the compile-safe hybrid pattern:

```ts
import { isCompiledBinary } from "@gajae-code/pi-utils";

const worker = isCompiledBinary()
	? new Worker("./packages/<pkg>/src/<worker>.ts", { type: "module" })
	: new Worker(new URL("./<worker>.ts", import.meta.url).href, { type: "module" });
```

Every worker entry must also be listed as an extra compile entrypoint in `packages/coding-agent/scripts/build-binary.ts`. Validate new worker paths with the relevant smoke test; `jwc --smoke-test` covers the stats sync worker.

## TUI visual design is user-curated — DO NOT revert or simplify

The TUI's visual identity (gradient welcome banner, intro sweep animation, shine effects, composer styling, scroll behavior) was hand-tuned by the user. It is a product feature, not incidental decoration. Multiple parallel agent sessions have repeatedly reverted it to a plain look; this is a hard violation.

- **NEVER** simplify, flatten, remove, or "clean up" the welcome banner or its animation in `packages/coding-agent/src/modes/components/welcome.ts` (gradient logo, INTRO_SWEEPS, shine band, multi-stop palettes). If your change accidentally touches it, restore it from git before committing.
- **NEVER** rewrite the viewport scroll model in `packages/tui/src/tui.ts` (B2-lite fill + sticky gap, `compactViewportFill()`). The canonical spec is `structure/31_scroll.md` — read it before touching any scroll/fill/gap code.
- **NEVER** change commit-time tool folding defaults (`tool.renderMode`, live-zone vs chat append) without an explicit user instruction in your own session.
- Visual changes to any file above require the user explicitly asking for that visual change **in the current session**. "It looks simpler/cleaner" is not a reason. A failing test is not a license to delete the feature — fix the test's expectation against the canonical behavior.
- If you find these files in a state that conflicts with this rule (e.g. banner already plain), do not "fix" further — report it and leave it to the user's session.

## Logging and TUI safety

Do not use `console.log`, `console.warn`, or `console.error` in `packages/coding-agent/`; it corrupts TUI rendering. Use the centralized logger from `@gajae-code/pi-utils`.

All text displayed in tool renderers must be sanitized:
- tabs to spaces via `replaceTabs()`
- truncation via `truncateToWidth()` / `ui.truncate()` and shared limits
- home paths shortened via `shortenPath()`
- previews bounded by shared preview constants

Apply sanitization to success, error, diff, and streaming render paths.

## Commands and verification

- Commit agent-owned completed changes proactively when the user has authorized execution; before committing, inspect status, stage only intended files, preserve unrelated/user work, and resolve or stop on conflicts instead of overwriting.
- Never run `tsc` or `npx tsc`; use `bun check` / `bun run check:ts`.
- For focused package changes, prefer targeted tests first, then type/lint/build checks as appropriate.
- Required rebrand/default-surface gates after workflow-definition changes:
  - `bun scripts/check-visible-definitions.ts`
  - `bun scripts/verify-g002-gates.ts`
  - `bun scripts/rebrand-inventory.ts --strict`
  - `bun test packages/coding-agent/test/default-jwc-definitions.test.ts`

## Testing rules

Test externally observable contracts: behavior, output shape, state transition, error mapping, or regression-prone parsing boundaries.

Avoid placeholder tests, tautologies, broad `not.toThrow()` assertions, duplicated coverage, long-lived global mutations, and `mock.module()`. Prefer `vi.spyOn(...)` with cleanup. Runtime compile-time guarantees belong in type checks, not placeholder runtime tests.

## Changelog and release

Package changelogs live at `packages/*/CHANGELOG.md`. Add new entries under `## [Unreleased]`; do not edit released sections.

Release flow is `bun run release` after changelogs and verification are complete.
