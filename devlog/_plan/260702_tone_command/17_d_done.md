# 17 — D DONE summary (/tone slash command)

## Cycle summary

- **P (Plan)**: Authored `/tone` plan at `10_plan.md`, iterated through Critic (`10.1`) until OKAY, finalized at plan a-r2 after A-stage findings.
- **A (Audit)**: Dual audit used gpt-5.5 only after user directive; planner/architect deltas closed at a-r2 (`10.8`, `10.9`) with `audit_status=pass`.
- **B (Build)**: Implemented `/tone` feature and docs across commits `5de9a79`, `2d5ba0c`, then C-routed hardening commits `665aad2` and `3df39c4`.
- **C (Check)**: Fresh mechanical gates green and final gpt-5.5 adversarial review PASS; C report at `16_c_final.md`.

## Files changed

Implementation:
- `packages/coding-agent/src/prompts/identity/tone-{sarcastic,savage,deadpan,hype,uhehe}.md` (NEW)
- `packages/coding-agent/src/config/settings-schema.ts`
- `packages/coding-agent/src/system-prompt.ts`
- `packages/coding-agent/src/slash-commands/builtin-registry.ts`
- `packages/coding-agent/src/cli/config-cli.ts`
- `packages/coding-agent/test/system-prompt-identity.test.ts`
- `packages/coding-agent/test/config-cli.test.ts`
- `schemas/config.schema.json`

Docs/evidence:
- `packages/coding-agent/CHANGELOG.md`
- `structure/40_fork-delta.md`
- `devlog/_plan/260702_tone_command/*`

## Acceptance criteria met

1. `renderIdentityBlock()` renders `## Tone` for presets/custom, preserves vibe coexistence, keeps language as trailing instruction, and remains null when all identity fields/toneBody unset.
2. `/tone` supports `sarcastic|savage|deadpan|hype|uhehe|custom|off|status` with autocomplete metadata; `/identity` prints `identity.tone` and `identity.toneCustom`.
3. `/tone custom <text>` stores inline custom text; `/tone custom` no-args launches a safe instruction path using a temp file + `config set ... -- "$(cat <file>)"` rather than unsafe heredoc/inline shell text.
4. `identity.tone` and `identity.toneCustom` are persisted in config schema; default-undefined enum typing supports unset without casts.
5. Mechanical verification green: `bun test packages/coding-agent/test/config-cli.test.ts packages/coding-agent/test/system-prompt-identity.test.ts` (19 pass), `packages/coding-agent` check, and root `bun run check:ts`.
6. Final adversarial review PASS; ADV-1/ADV-B1/B2 closed, ADV-2 waiver sound.

## WONDER — still missing / assumptions / residual risks

- Acceptance criteria did not originally require threat-modeling the agent-instruction persistence lane. That surfaced late: heredoc delimiter collision and fixed temp path risks were not in the P/A plan and were only caught by C adversarial review.
- The no-args custom lane still relies on an agent following an instruction instead of a first-class interactive input widget. That is acceptable per non-goal, but it is more brittle than a typed form or TUI selector.
- The config CLI still intentionally drops dash-leading values without `--` (pre-existing behavior). The safe lane now instructs `--`, but future free-form config docs should mention this convention.

## REFLECT — spec improvements

- Add an explicit security acceptance item for any command that asks the agent to persist pasted free-form text: no shell heredoc delimiter collision, no fixed temp path, no inline shell injection, and `--` for dash-leading values.
- Specify parser behavior for whitespace-only slash-command args up front; `/tone custom   ` is indistinguishable from `/tone custom` after `parseSlashCommand()` trimming, so the spec should not demand unreachable error behavior.
- Make "all audit/review lanes use gpt-5.5" a project/session convention in future plans when required by the user, rather than discovering it mid-cycle.

## Verdict

Complete. No route-back remains.
