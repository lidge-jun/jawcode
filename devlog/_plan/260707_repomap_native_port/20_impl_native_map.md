# 20_impl_native_map — jawcode repo-map native port

## Scope

Implemented the jawcode unit-20 native repo-map insertion map from the
pabcd_initiative contract:

- Native tag extraction in `/Users/jun/Developer/new/700_projects/jawcode/crates/pi-ast/src/tags.rs`.
- Vendored Aider-lineage tree-sitter `tags.scm` resources under
  `/Users/jun/Developer/new/700_projects/jawcode/crates/pi-ast/resources/tags/`.
- N-API `repoMap` surface through
  `/Users/jun/Developer/new/700_projects/jawcode/crates/pi-natives/src/ast.rs`.
- Discoverable coding-agent `map` tool and `jwc map` CLI command.
- One system-prompt affordance line in `<ast-tools>`.

## File changes

### `/Users/jun/Developer/new/700_projects/jawcode/crates/pi-ast/src/tags.rs` — native tags + ranking
- **Changes**: Added `extract_tags` and `repo_map`; parses TS/JS/Rust/TSX files with tree-sitter `Query` + `QueryCursor`, captures `@definition.*`, `@reference.*`, `@name.definition.*`, and `@name.reference.*`, ranks definer files with a small power-iteration PageRank over referencer-file -> definer-file symbol edges, and renders a token-budgeted file-grouped map.
- **Impact**: New public `pi-ast` module used by `pi-natives`.
- **Verification**: `cargo test -p pi-ast --lib`.

### `/Users/jun/Developer/new/700_projects/jawcode/crates/pi-ast/resources/tags/*.scm` — vendored queries
- **Changes**: Added `typescript.scm`, `javascript.scm`, `rust.scm`, and `tsx.scm` from the codexclaw repo-map query set.
- **Impact**: Fixture-verified TS and Rust tier; JS/TSX available through the same native path.
- **Verification**: `cargo test -p pi-ast --lib`; NOTICE updated for Aider-lineage / Apache-2.0 attribution.

### `/Users/jun/Developer/new/700_projects/jawcode/crates/pi-ast/src/lib.rs` — module export
- **Changes**: Exported `pub mod tags`.
- **Impact**: Allows `pi-natives` to call `pi_ast::tags::repo_map`.
- **Verification**: `cargo test -p pi-ast --lib`.

### `/Users/jun/Developer/new/700_projects/jawcode/crates/pi-natives/src/ast.rs` — napi binding
- **Changes**: Added `RepoMapOptions` and `#[napi] pub fn repo_map(...) -> task::Promise<String>`.
- **Impact**: Generates `repoMap` in `@jawcode-dev/natives`.
- **Verification**: `bun --cwd=packages/natives run build`.

### `/Users/jun/Developer/new/700_projects/jawcode/packages/coding-agent/src/tools/map.ts` — agent tool
- **Changes**: Added discoverable `map` tool wrapping native `repoMap` with schema `{ path, budget? }`.
- **Impact**: Agents can request a ranked structure map before deep grep.
- **Verification**: native build generated `repoMap`; TypeScript gate pending in C.

### `/Users/jun/Developer/new/700_projects/jawcode/packages/coding-agent/src/commands/map.ts` and `/Users/jun/Developer/new/700_projects/jawcode/packages/coding-agent/src/cli.ts` — CLI surface
- **Changes**: Added `jwc map <path> [--budget N]` as a jaw-only subcommand.
- **Impact**: One-shot repo-map command is exposed on the public jawcode CLI.
- **Verification**: `jwc map ...` smoke in C.

### `/Users/jun/Developer/new/700_projects/jawcode/packages/coding-agent/src/prompts/system/system-prompt.md` — affordance
- **Changes**: Added one `<ast-tools>` line telling the agent `map` exists and should run before deep grep in unfamiliar code; widened the section condition to include the map tool.
- **Impact**: Prompt-visible pointer only; no map body preload.
- **Verification**: affordance grep in C.

### `/Users/jun/Developer/new/700_projects/jawcode/NOTICE.md` and `/Users/jun/Developer/new/700_projects/jawcode/structure/40_fork-delta.md` — tracking
- **Changes**: Added query attribution and fork-delta rows for NEW/HARD-EDIT files.
- **Impact**: Maintains Jawdev attribution and rebase/cherrypick delta index.
- **Verification**: file inspection and final diff.

## Verification

- `cargo test -p pi-ast --lib` — pass: 19 passed, 0 failed.
- `bun --cwd=packages/natives run build` — pass: local darwin-arm64 napi build completed; generated 63 explicit ESM exports and fixed 10 const enums in `index.d.ts`.
- `bun packages/jwc/bin/jwc.js map crates/pi-ast --budget 500` — pass: printed ranked map headed by `/Users/jun/Developer/new/700_projects/jawcode/crates/pi-ast`.
- `rg -n "ranked structure map|deep grep|subtrees|toolRefs\\.map|includes tools \"map\"" packages/coding-agent/src/prompts/system/system-prompt.md` — pass: found the `<ast-tools>` map affordance line.
- `bunx biome check packages/coding-agent/src/commands/map.ts packages/coding-agent/src/tools/map.ts packages/coding-agent/src/tools/index.ts packages/coding-agent/src/cli.ts` — pass.
- `bun --cwd=packages/coding-agent run check:types` — pass.
- `bun run check:ts` — blocked by pre-existing formatter issues outside this unit:
  `/Users/jun/Developer/new/700_projects/jawcode/packages/coding-agent/src/commands/orchestrate.ts`,
  `/Users/jun/Developer/new/700_projects/jawcode/packages/coding-agent/src/jwc-runtime/orchestrate-runtime.ts`,
  and `/Users/jun/Developer/new/700_projects/jawcode/packages/coding-agent/src/modes/controllers/input-controller.ts`.
