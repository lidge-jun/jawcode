# Evidence: repo-map native port P-plan attempt 3

Date: Tue Jul  7 00:07:22 KST 2026

## Command: pwd

```text
/Users/jun/Developer/new/700_projects/jawcode
```

## Command: git status --short

```text
 M .codexclaw/bridge.db
 M .codexclaw/subagents.json
 M packages/coding-agent/src/defaults/jwc/skills/goal/SKILL.md
 M packages/coding-agent/src/defaults/jwc/skills/plan/SKILL.md
?? .codexclaw/cache/
?? .codexclaw/evidence/
```

## Command: contract and insertion map present

```text
contract present
jawcode insertion map present
```

## Command: key insertion point grep

```text
/Users/jun/Developer/new/700_projects/jawcode/packages/coding-agent/src/cli.ts:68:const jawOnlyCommands: CommandEntry[] = [
/Users/jun/Developer/new/700_projects/jawcode/packages/coding-agent/src/cli.ts:83:const commands: CommandEntry[] = [...baseCommands, ...(isJawBrandEnv() ? jawOnlyCommands : [])];
/Users/jun/Developer/new/700_projects/jawcode/packages/coding-agent/src/tools/index.ts:327:		return cleaned.filter(name => name in BUILTIN_TOOLS);
/Users/jun/Developer/new/700_projects/jawcode/packages/coding-agent/src/tools/index.ts:333: * Public callable factory map. External callers may invoke `BUILTIN_TOOLS.read(session)` or
/Users/jun/Developer/new/700_projects/jawcode/packages/coding-agent/src/tools/index.ts:334: * `BUILTIN_TOOLS[name](session)` to construct a public coding-harness tool directly.
/Users/jun/Developer/new/700_projects/jawcode/packages/coding-agent/src/tools/index.ts:339:export const BUILTIN_TOOLS: Record<string, ToolFactory> = {
/Users/jun/Developer/new/700_projects/jawcode/packages/coding-agent/src/tools/index.ts:385:export type ToolName = keyof typeof BUILTIN_TOOLS;
/Users/jun/Developer/new/700_projects/jawcode/packages/coding-agent/src/tools/index.ts:424: * Create tools from BUILTIN_TOOLS registry.
/Users/jun/Developer/new/700_projects/jawcode/packages/coding-agent/src/tools/index.ts:505:	const allTools: Record<string, ToolFactory> = { ...BUILTIN_TOOLS, ...HIDDEN_TOOLS };
/Users/jun/Developer/new/700_projects/jawcode/packages/coding-agent/src/tools/index.ts:559:					...Object.entries(BUILTIN_TOOLS)
/Users/jun/Developer/new/700_projects/jawcode/crates/pi-ast/src/lib.rs:1:pub mod language;
/Users/jun/Developer/new/700_projects/jawcode/crates/pi-ast/src/lib.rs:2:pub mod ops;
/Users/jun/Developer/new/700_projects/jawcode/crates/pi-ast/src/lib.rs:5:pub use language::SupportLang;
/Users/jun/Developer/new/700_projects/jawcode/packages/coding-agent/src/prompts/system/system-prompt.md:231:<ast-tools>
/Users/jun/Developer/new/700_projects/jawcode/crates/pi-natives/src/ast.rs:533:pub fn ast_grep(options: AstFindOptions<'_>) -> task::Promise<AstFindResult> {
/Users/jun/Developer/new/700_projects/jawcode/crates/pi-natives/src/ast.rs:689:pub fn ast_edit(options: AstReplaceOptions<'_>) -> task::Promise<AstReplaceResult> {
```

## Command: cxc map attempt with timeout

```text
exit=142
```

## Command: cargo test -p pi-ast --lib baseline

```text
   Compiling serde_core v1.0.228
   Compiling memchr v2.8.2
   Compiling regex-syntax v0.8.11
   Compiling streaming-iterator v0.1.9
   Compiling crossbeam-utils v0.8.21
   Compiling tree-sitter-language v0.1.7
   Compiling phf_shared v0.13.1
   Compiling syn v2.0.117
   Compiling bit-vec v0.8.0
   Compiling siphasher v1.0.3
   Compiling same-file v1.0.6
   Compiling log v0.4.32
   Compiling anyhow v1.0.102
   Compiling walkdir v2.5.0
   Compiling bit-set v0.8.0
   Compiling phf_generator v0.13.1
   Compiling tree-sitter-bash v0.25.1
   Compiling tree-sitter-swift v0.7.3
   Compiling tree-sitter-erlang v0.16.0
   Compiling tree-sitter-powershell v0.26.4
   Compiling tree-sitter-astro-next v0.1.1
   Compiling tree-sitter-tlaplus v1.5.0
   Compiling tree-sitter-make v1.1.1
   Compiling tree-sitter-r v1.2.0
   Compiling tree-sitter-diff v0.1.0
   Compiling tree-sitter-ruby v0.23.1
   Compiling tree-sitter-zig v1.1.2
   Compiling tree-sitter-cmake v0.7.1
   Compiling tree-sitter-ini v1.4.0
   Compiling tree-sitter-julia v0.23.1
   Compiling tree-sitter-c-sharp v0.23.5
   Compiling tree-sitter-elixir v0.3.5
   Compiling tree-sitter-css v0.25.0
   Compiling tree-sitter-html v0.23.2
   Compiling tree-sitter-perl-next v0.1.0
   Compiling tree-sitter-hcl v1.1.0
   Compiling tree-sitter-odin v1.3.0
   Compiling tree-sitter-graphql v0.1.0
   Compiling tree-sitter-java v0.23.5
   Compiling tree-sitter-ocaml v0.24.2
   Compiling tree-sitter-nix v0.3.0
   Compiling tree-sitter-c v0.24.2
   Compiling tree-sitter-javascript v0.25.0
   Compiling tree-sitter-md v0.5.3
   Compiling tree-sitter-xml v0.7.0
   Compiling tree-sitter-go v0.25.0
   Compiling tree-sitter-typescript v0.23.2
   Compiling tree-sitter-objc v3.0.2
   Compiling tree-sitter-rust v0.24.2
   Compiling tree-sitter-php v0.24.2
   Compiling tree-sitter-toml-ng v0.7.0
   Compiling aho-corasick v1.1.4
   Compiling bstr v1.12.1
   Compiling tree-sitter-vue-next v0.1.0
   Compiling tree-sitter-regex v0.25.0
   Compiling tree-sitter-haskell v0.23.1
   Compiling tree-sitter-json v0.24.8
   Compiling tree-sitter-lua v0.5.0
   Compiling tree-sitter-scala v0.26.0
   Compiling tree-sitter-proto v0.4.0
   Compiling tree-sitter-yaml v0.7.2
   Compiling tree-sitter-cpp v0.23.4
   Compiling tree-sitter-solidity v1.2.13
   Compiling tree-sitter-svelte-next v0.1.1
   Compiling tree-sitter-dart v0.2.0
   Compiling tree-sitter-sequel v0.3.11
   Compiling tree-sitter-python v0.25.0
   Compiling tree-sitter-verilog v1.0.3
   Compiling tree-sitter-starlark v1.3.0
   Compiling tree-sitter-kotlin-sg v0.4.1
   Compiling crossbeam-epoch v0.9.18
   Compiling crossbeam-deque v0.8.6
   Compiling regex-automata v0.4.14
   Compiling serde_json v1.0.150
   Compiling regex v1.12.4
   Compiling globset v0.4.18
   Compiling tree-sitter v0.25.10
   Compiling ignore v0.4.26
   Compiling thiserror-impl v2.0.18
   Compiling serde_derive v1.0.228
   Compiling phf_macros v0.13.1
   Compiling phf v0.13.1
   Compiling thiserror v2.0.18
   Compiling tree-sitter-just v0.2.0
   Compiling tree-sitter-clojure v0.1.0
   Compiling tree-sitter-dockerfile-updated v0.2.0
   Compiling ast-grep-core v0.39.9
   Compiling serde v1.0.228
   Compiling pi-ast v1.0.0 (/Users/jun/Developer/new/700_projects/jawcode/crates/pi-ast)
    Finished `test` profile [unoptimized + debuginfo] target(s) in 28.17s
     Running unittests src/lib.rs (target/debug/deps/pi_ast-9b321196a23db16b)

running 17 tests
test ops::tests::apply_edits_rejects_overlaps ... ok
test summary::tests::does_not_elide_short_typescript_import_run ... ok
test summary::tests::unsupported_language_is_unparsed ... ok
test summary::tests::parse_failure_falls_back_to_unparsed ... ok
test summary::tests::summarizes_typescript_import_run ... ok
test summary::tests::summarizes_typescript_interface_body ... ok
test summary::tests::min_body_lines_controls_short_body_elision ... ok
test summary::tests::summarizes_typescript_class_body ... ok
test summary::tests::summarizes_typescript_function_body ... ok
test summary::tests::summarizes_python_function_body ... ok
test summary::tests::summarizes_rust_use_run ... ok
test summary::tests::summarizes_python_import_run ... ok
test summary::tests::summarizes_rust_trait_declaration_list ... ok
test summary::tests::summarizes_c_preproc_include_run ... ok
test summary::tests::summarizes_java_class_body ... ok
test summary::tests::summarizes_rust_method_body_but_keeps_impl_boundaries ... ok
test ops::tests::compile_search_patterns_compiles_rust_patterns ... ok

test result: ok. 17 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.01s

```

## Judgement

This is P-phase evidence only. The source contract and jawcode insertion map are present; the planned insertion points were verified with rg; cxc map was attempted but is not usable in this environment; direct inspection supports the P-plan. Baseline pi-ast tests were run before implementation to establish the native crate starts from a testable state. No implementation or build-complete claim is made.

## Receipt self-check

```text
-rw-r--r--@ 1 jun  staff  8057 Jul  7 00:07 /Users/jun/Developer/new/700_projects/jawcode/.codexclaw/evidence/260707_repomap_native_port_p_plan_attempt3.md
```
