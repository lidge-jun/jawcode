# 260614 — Jaw Interview Markdown Mode + `/interview` I-stage Trigger

## Status

- Scope separated from `260614_subagent_cache_actor_lifecycle`; this patch is about jaw-interview runtime/prompt policy and slash-command I-stage triggering, not subagent resume/fork lifecycle.
- Product/source implementation files are still gated by normal approval. This document records the small runtime/prompt patch requested during interview-mode dogfooding.

## User direction

- While `jaw-interview` is active, runtime should allow `.md` edits and rely on prompt policy for judgment.
- Non-markdown product/source mutation should remain blocked by runtime guard.
- `.jwc/state/**` must remain runtime-owned and blocked from direct mutation.
- `/interview` should enter PABCD `i` and trigger the next agent turn whether or not a message is supplied.
- `/interview <message>` should enter PABCD `i` and forward `<message>` as the next prompt.
- `/interview` with no args should still send a minimal `i` prompt so the I-stage context is consumed instead of only changing state.

## Patch inventory

- `packages/coding-agent/src/skill-state/jaw-interview-mutation-guard.ts`
  - Allow mutation targets that resolve to `.md` while jaw-interview is active.
  - Keep unknown/non-md targets blocked under active jaw-interview.
  - Keep `.jwc/state/**` blocked as workflow state.
- `packages/coding-agent/src/defaults/jwc/skills/jaw-interview/SKILL.md`
  - Replace narrow plan-document mode wording with broader markdown interview mode.
  - Put policy control in the prompt: `.md` edits should be interview/planning/spec/decision/risk notes, not execution.
- `packages/coding-agent/src/slash-commands/builtin-registry.ts`
  - `/interview` invokes native PABCD `i`.
  - On success, it queues PABCD stage context and returns a prompt (`args` or `i`) so the next turn is triggered.

## Verification

Focused tests run after the patch:

- `bun test packages/coding-agent/test/jaw-interview-mutation-guard.test.ts`
- `bun test packages/coding-agent/test/jwc-skill-state-hooks.test.ts`
- `bun test packages/coding-agent/test/jwc-runtime/jwc-acl-gate.test.ts`
- `bun test packages/coding-agent/test/slash-commands/session-slash-surface.test.ts`
- `bun test packages/coding-agent/test/default-jwc-definitions.test.ts`
- `bun scripts/check-visible-definitions.ts`
- `bun scripts/verify-g002-gates.ts`
- `bun scripts/rebrand-inventory.ts --strict`

## Notes

- The prior attempted filename `80_jaw_interview_markdown_mode.md` under the subagent lifecycle plan was the wrong location/name for this patch family.
- Use this devlog folder for follow-up changes related to jaw-interview markdown-mode policy or `/interview` I-stage triggering.
