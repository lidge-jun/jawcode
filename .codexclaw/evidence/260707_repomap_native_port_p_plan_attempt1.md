# Evidence: repo-map native port P-plan

Date: Tue Jul  7 00:06:21 KST 2026

## Command: git status --short

```text
 M .codexclaw/bridge.db
 M .codexclaw/subagents.json
 M packages/coding-agent/src/defaults/jwc/skills/goal/SKILL.md
 M packages/coding-agent/src/defaults/jwc/skills/plan/SKILL.md
?? .codexclaw/cache/
?? .codexclaw/evidence/
```

## Command: contract exists

```text
contract present
```

## Command: insertion map exists

```text
insertion map present
```

## Command: cxc map attempt with 5s timeout

```text
exit=142
```

## Command: key insertion point grep

```text
packages/coding-agent/src/cli.ts:68:const jawOnlyCommands: CommandEntry[] = [
packages/coding-agent/src/cli.ts:83:const commands: CommandEntry[] = [...baseCommands, ...(isJawBrandEnv() ? jawOnlyCommands : [])];
crates/pi-ast/src/lib.rs:1:pub mod language;
crates/pi-ast/src/lib.rs:2:pub mod ops;
crates/pi-ast/src/lib.rs:5:pub use language::SupportLang;
packages/coding-agent/src/tools/index.ts:327:		return cleaned.filter(name => name in BUILTIN_TOOLS);
packages/coding-agent/src/tools/index.ts:333: * Public callable factory map. External callers may invoke `BUILTIN_TOOLS.read(session)` or
packages/coding-agent/src/tools/index.ts:334: * `BUILTIN_TOOLS[name](session)` to construct a public coding-harness tool directly.
packages/coding-agent/src/tools/index.ts:339:export const BUILTIN_TOOLS: Record<string, ToolFactory> = {
packages/coding-agent/src/tools/index.ts:385:export type ToolName = keyof typeof BUILTIN_TOOLS;
packages/coding-agent/src/tools/index.ts:424: * Create tools from BUILTIN_TOOLS registry.
packages/coding-agent/src/tools/index.ts:505:	const allTools: Record<string, ToolFactory> = { ...BUILTIN_TOOLS, ...HIDDEN_TOOLS };
packages/coding-agent/src/tools/index.ts:559:					...Object.entries(BUILTIN_TOOLS)
packages/coding-agent/src/prompts/system/system-prompt.md:231:<ast-tools>
crates/pi-natives/src/ast.rs:533:pub fn ast_grep(options: AstFindOptions<'_>) -> task::Promise<AstFindResult> {
crates/pi-natives/src/ast.rs:689:pub fn ast_edit(options: AstReplaceOptions<'_>) -> task::Promise<AstReplaceResult> {
```

## Judgement

P-phase planning is evidence-backed: the repo-map contract and jawcode insertion map are present; existing code surfaces for pi-ast export, napi ast-grep/edit, tool registry, jaw-only CLI commands, and ast-tools prompt were verified. No implementation/build claim is made yet. `cxc map` did not provide usable map evidence in this environment, so direct rg/file inspection was the correct fallback for planning.
