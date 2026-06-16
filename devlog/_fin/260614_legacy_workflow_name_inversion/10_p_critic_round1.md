# P Critic Round 1 — ITERATE

Verdict: ITERATE

## Evidence

- Plan matches the core spec vocabulary: public `plan`, internal `planphase`, `jwc planphase --write`, `.jwc/plans/planphase/`, canonical `goal`, `.jwc/goal/`.
- Not actionable enough because it omits concrete coverage for normal user-facing command/help/hook surfaces where legacy `ralplan`/`ultragoal` remains a spec violation.
- Verified missing plan coverage includes `packages/coding-agent/src/commands/{goal,ultragoal,ralplan,interview,skills,state}.ts`, `packages/coding-agent/src/hooks/skill-state.ts`, `packages/coding-agent/src/modes/shared/agent-wire/workflow-gate-broker.ts`, `packages/coding-agent/src/modes/components/skill-hud/render.ts`, and `packages/coding-agent/src/skill-state/initial-phase.ts`.
- Compatibility policy is left ambiguous in places (`keep or remove` legacy commands/routes), forcing executors to make product decisions during B-stage.
- Verification misses explicit CLI/help, hook prompt/stop-output, broker/wire normalization, HUD, public-legacy inventory, and old/new storage precedence coverage.

## Required fixes

1. Add explicit CLI/public command surface phase for canonical `jwc goal`, deprecated/hidden `jwc ultragoal`, `jwc planphase --write`, `jwc ralplan` compatibility, and examples in `interview`, `skills`, and `state` commands.
2. Add hook/HUD cleanup acceptance for user prompt/stop guidance and display-name hacks so normal guidance no longer recommends `ralplan`/`ultragoal`.
3. Add `workflow-gate-broker.ts` wire-stage normalization/emission requirements, not only `approval-gate.ts` and `rpc-types.ts`.
4. Freeze alias policy for `jwc ralplan --write`, non-write `jwc ralplan`, `$ralplan`, `$ultragoal`, and `jwc ultragoal`.
5. Expand focused verification to include CLI command surface/help tests, hook/HUD tests, bridge/harness gate assertions, `scripts/check-public-legacy-zero.ts` or equivalent, and read-compat storage precedence tests where retained.
