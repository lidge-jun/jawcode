# Evidence: repo-map native port implementation

Date: Tue Jul  7 00:20:49 KST 2026

## Command: git status --short

```text
 M .codexclaw/bridge.db
 M .codexclaw/subagents.json
 M NOTICE.md
 M crates/pi-ast/src/lib.rs
 M crates/pi-natives/src/ast.rs
 M packages/coding-agent/src/cli.ts
 M packages/coding-agent/src/defaults/jwc/skills/goal/SKILL.md
 M packages/coding-agent/src/defaults/jwc/skills/plan/SKILL.md
 M packages/coding-agent/src/prompts/system/system-prompt.md
 M packages/coding-agent/src/tools/index.ts
 M packages/natives/native/index.d.ts
 M packages/natives/native/index.js
 M structure/40_fork-delta.md
?? .codexclaw/cache/
?? .codexclaw/evidence/
?? crates/pi-ast/resources/
?? crates/pi-ast/src/tags.rs
?? devlog/_plan/260707_repomap_native_port/
?? packages/coding-agent/src/commands/map.ts
?? packages/coding-agent/src/tools/map.ts
```

## Command: cargo test -p pi-ast --lib

```text
    Finished `test` profile [unoptimized + debuginfo] target(s) in 0.27s
     Running unittests src/lib.rs (target/debug/deps/pi_ast-9b321196a23db16b)

running 19 tests
test ops::tests::apply_edits_rejects_overlaps ... ok
test summary::tests::summarizes_typescript_import_run ... ok
test summary::tests::summarizes_python_function_body ... ok
test summary::tests::does_not_elide_short_typescript_import_run ... ok
test summary::tests::summarizes_rust_use_run ... ok
test summary::tests::summarizes_typescript_interface_body ... ok
test summary::tests::min_body_lines_controls_short_body_elision ... ok
test summary::tests::summarizes_c_preproc_include_run ... ok
test summary::tests::parse_failure_falls_back_to_unparsed ... ok
test summary::tests::unsupported_language_is_unparsed ... ok
test summary::tests::summarizes_rust_trait_declaration_list ... ok
test summary::tests::summarizes_python_import_run ... ok
test summary::tests::summarizes_java_class_body ... ok
test summary::tests::summarizes_typescript_class_body ... ok
test summary::tests::summarizes_rust_method_body_but_keeps_impl_boundaries ... ok
test summary::tests::summarizes_typescript_function_body ... ok
test ops::tests::compile_search_patterns_compiles_rust_patterns ... ok
test tags::tests::extracts_typescript_defs_and_refs ... ok
test tags::tests::extracts_rust_defs_and_repo_map_output ... ok

test result: ok. 19 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.02s

```

## Command: bun --cwd=packages/natives run build

```text
$ bun scripts/build-native.ts
Building pi-natives for darwin-arm64 (local)…
   Compiling pi-natives v1.0.0 (/Users/jun/Developer/new/700_projects/jawcode/crates/pi-natives)
    Finished `local` profile [optimized] target(s) in 34.91s
Normalizing native addon filename: pi_natives.darwin-arm64.node → pi_natives.darwin-arm64.node
Generated 63 explicit ESM exports in index.js, fixed 10 const enums in index.d.ts
Build complete.
```

## Command: jwc map smoke

```text
# Repo map: /Users/jun/Developer/new/700_projects/jawcode/crates/pi-ast

## src/summary.rs  score:0.2987
16:class SummaryOptions
30:class SummarySegment
42:class SummaryResult
56:class LineSpan
61:function summarize_code
106:function resolve_language
117:function unparsed_result
131:function count_lines
139:function collect_elisions
201:function flush_groupable_run
232:function node_start_line
240:function node_end_line
254:function node_content_end_line
264:function node_line_count
270:function is_comment_kind
289:function is_elidable_kind
608:function is_groupable_kind
674:function normalize_spans
696:function build_segments
737:function push_segment
753:module tests
756:function summarize
756:method summarize
767:function segment_kinds
767:method segment_kinds
776:function summarizes_typescript_function_body
776:method summarizes_typescript_function_body
797:function summarizes_rust_method_body_but_keeps_impl_boundaries
797:method summarizes_rust_method_body_but_keeps_impl_boundaries
817:function summarizes_python_function_body
817:method summarizes_python_function_body
845:function min_body_lines_controls_short_body_elision
```

## Command: affordance grep

```text
230:{{#ifAny (includes tools "ast_grep") (includes tools "ast_edit") (includes tools "map")}}
233:{{#has tools "map"}}- `{{toolRefs.map}}` gives a ranked structure map; run it before deep grep in unfamiliar code, and scope it to subtrees when possible.{{/has}}
```

## Command: focused biome touched TS files

```text
Checked 4 files in 12ms. No fixes applied.
```

## Command: coding-agent type check

```text
$ tsgo -p tsconfig.json --noEmit
```

## Command: broad check:ts

```text
$ bun run check:tools && bun run check:node20-baseline && bun run check:schemas && bun run check:jwc-ui && bun run --workspaces --if-present check
$ biome check . --no-errors-on-unmatched
packages/coding-agent/src/commands/orchestrate.ts format ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  × Formatter would have printed the following content:
  
    33 33 │       }),
    34 34 │       "render-pending": Flags.boolean({
    35    │ - → → → description:·"With·verdict·in·stage·c:·mark·render·grounding·in-scope·(arms·the·c→d·soft·warning·until·resolved)",
       35 │ + → → → description:
       36 │ + → → → → "With·verdict·in·stage·c:·mark·render·grounding·in-scope·(arms·the·c→d·soft·warning·until·resolved)",
    36 37 │       }),
    37 38 │       "user-approved": Flags.boolean({ description: "Explicit user approval override for a gated transition" }),
  

packages/coding-agent/src/jwc-runtime/orchestrate-runtime.ts format ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  × Formatter would have printed the following content:
  
     93  93 │   
     94  94 │   function parseArgs(argv: string[]): ParsedArgs | { error: string } {
     95     │ - → const·parsed:·ParsedArgs·=·{·positional:·[],·deliberate:·false,·json:·false,·userApproved:·false,·renderObserved:·false,·renderNotApplicable:·false,·renderPending:·false,·complete:·false·};
         95 │ + → const·parsed:·ParsedArgs·=·{
         96 │ + → → positional:·[],
         97 │ + → → deliberate:·false,
         98 │ + → → json:·false,
         99 │ + → → userApproved:·false,
        100 │ + → → renderObserved:·false,
        101 │ + → → renderNotApplicable:·false,
        102 │ + → → renderPending:·false,
        103 │ + → → complete:·false,
        104 │ + → };
     96 105 │     for (let i = 0; i < argv.length; i++) {
     97 106 │       const arg = argv[i];
    ······· │ 
    297 306 │       const picked = [args.renderObserved, args.renderNotApplicable, args.renderPending].filter(Boolean).length;
    298 307 │       if (picked > 1) {
    299     │ - → → → return·{·stderr:·"--render-observed,·--render-not-applicable,·and·--render-pending·are·mutually·exclusive\n",·status:·2·};
        308 │ + → → → return·{
        309 │ + → → → → stderr:·"--render-observed,·--render-not-applicable,·and·--render-pending·are·mutually·exclusive\n",
        310 │ + → → → → status:·2,
        311 │ + → → → };
    300 312 │       }
    301 313 │       const current = await readCurrent(cwd, args.sessionId);
    302 314 │       if ("error" in current) return { stderr: `${current.error}\n`, status: 2 };
    303     │ - → → if·(!current.envelope)·return·{·stderr:·"no·active·pabcd·state·—·nothing·to·record·a·verdict·against\n",·status:·1·};
        315 │ + → → if·(!current.envelope)
        316 │ + → → → return·{·stderr:·"no·active·pabcd·state·—·nothing·to·record·a·verdict·against\n",·status:·1·};
    304 317 │       if (current.envelope.current_phase !== "c") {
    305     │ - → → → return·{·stderr:·`render·grounding·verdicts·apply·only·in·stage·c·(current:·${current.envelope.current_phase})\n`,·status:·1·};
        318 │ + → → → return·{
        319 │ + → → → → stderr:·`render·grounding·verdicts·apply·only·in·stage·c·(current:·${current.envelope.current_phase})\n`,
        320 │ + → → → → status:·1,
        321 │ + → → → };
    306 322 │       }
    307 323 │       const renderStatus: PabcdRenderGroundingStatus = args.renderObserved
  

packages/coding-agent/src/modes/controllers/input-controller.ts format ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  × Formatter would have printed the following content:
  
     529  529 │             this.ctx.ui.requestRender(false, "realign heal");
     530  530 │             await new Promise(resolve => setTimeout(resolve, 25));
     531      │ - → → → → → realigned·=
     532      │ - → → → → → → this.ctx.ui.realignOverflowedFrame?.(measureComposerClusterRows(this.ctx))·??·false;
          531 │ + → → → → → realigned·=·this.ctx.ui.realignOverflowedFrame?.(measureComposerClusterRows(this.ctx))·??·false;
     533  532 │           }
     534  533 │           // The preamble (welcome banner etc.) sits above chatContainer, so
  

Checked 2466 files in 1811ms. No fixes applied.
Found 3 errors.
check ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  × Some errors were emitted while running checks.
  

error: script "check:tools" exited with code 1
error: script "check:ts" exited with code 1
exit=1
```

## Judgement

Implementation evidence is fresh. pi-ast TS/Rust fixture tests pass; napi/native build succeeds and regenerates repoMap exports; jwc map prints a ranked map; prompt affordance grep finds the map line; focused Biome for touched TS files passes; coding-agent type check passes. Broad check:ts remains blocked by unrelated formatter issues in packages/coding-agent/src/commands/orchestrate.ts, packages/coding-agent/src/jwc-runtime/orchestrate-runtime.ts, and packages/coding-agent/src/modes/controllers/input-controller.ts. Pre-existing dirty .codexclaw and defaults/jwc/skills files were not reverted.
