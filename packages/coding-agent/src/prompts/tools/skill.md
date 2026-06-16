Invoke another available skill in the current turn.

<conditions>
- A SKILL document instructs you to chain into another skill on completion (e.g. orchestrate p → goal)
- You finished one skill's workflow and the next step requires another skill's full prompt context
</conditions>

<instruction>
- `name` is the skill name as it appears in `/skill:<name>` (e.g. `goal`, `team`, `jaw-interview`)
- `args` is the free-form argument string the skill would receive after `/skill:<name>` on the command line
- The skill tool dispatches the callee's SKILL.md as a user-attribution custom message in the current turn (steering the stream when active, appending otherwise). Before dispatch, the tool atomically demotes the caller and promotes the callee in `.jwc/state/` by calling `jwc state <caller> handoff --to <callee>` in-process.
- The chain is refused unless the caller's `current_phase` is in `{complete, completed, handoff, failed, cancelled, canceled, inactive}`. To prepare the active skill for chaining, write `current_phase: "handoff"` to its mode-state via `jwc state <skill> write --input '{"current_phase":"handoff"}' --json`. The skill tool itself then runs `jwc state <skill> handoff --to <callee>` in-process to atomically demote the caller and promote the callee — you do not need to run the handoff verb separately.
- Call once per chain step. To chain `A → B → C`, A calls `skill(B)`; B's next agent turn calls `skill(C)`.
</instruction>

<critical>
- Do NOT use this tool to "remind yourself" of a skill you're already running. The current SKILL.md is already in your context.
- Do NOT chain into the same skill recursively. If a skill's flow needs another iteration, follow its in-document instructions.
- The chained skill's planning/execution-boundary rules still apply. Chaining does not grant execution approval.
</critical>

<examples>
# Hand off from orchestrate p to goal after an approved plan
{"name": "goal", "args": "track execution of .jwc/plans/planphase/<run-id>/pending-approval.md"}

# Trigger jaw-interview with no arguments
{"name": "jaw-interview"}
</examples>
