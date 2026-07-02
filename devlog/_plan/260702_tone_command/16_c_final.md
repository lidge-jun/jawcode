# 16 — C final verification (/tone)

## Mechanical gates

All green (fresh C final run):

- `bun test packages/coding-agent/test/config-cli.test.ts packages/coding-agent/test/system-prompt-identity.test.ts` → 19 pass / 0 fail / 61 expects.
- `(cd packages/coding-agent && bun run check)` → biome check + tsgo clean.
- `bun run check:ts` at repo root → check:tools + node20 baseline + check:schemas + jwc-ui/rebrand inventory + all workspace checks green (`FINAL_ALL_GATES_GREEN`). Biome emitted the existing deprecation info for `recommended`; no errors.

## Adversarial review

Final adversarial review (openai/gpt-5.5:high): PASS.

- Plan/spec and C artifacts checked: a-r2 requires identity.tone/toneCustom persistence, ## Tone injection after Vibe before language, /tone status/off/preset/custom lanes, config -- safety, and docs/schema updates; current code matches those contracts.
- /tone behavior checked: first token only is normalized; custom rest is preserved with trim only; off unsets identity.tone and keeps toneCustom; status avoids dumping custom text.
- ADV-1/ADV-B1/B2 closed: config parser treats everything after -- as positional, and no heredoc/fixed delimiter/TONE_EOF/fixed /tmp path remains; no pasted bytes are evaluated as shell syntax.
- ADV-2 waiver remains sound: parseSlashCommand pre-trims args, so whitespace-only `/tone custom   ` reaches the no-args prompt branch, not an empty save branch.
- TUI handle-only path checked: no handleTui on /tone; executeBuiltinSlashCommand falls back through adaptTuiSlashRuntime, forwards output/notifyConfigChanged, and clears editor.
- renderIdentityBlock checked: toneBody guard prevents custom-without-text injection, null gate includes toneBody, and language remains the trailing instruction.
- Schema/type/docs checked: settings-schema, generated config schema, changelog, and fork-delta are aligned; relevant target files have no uncommitted diff from HEAD.

## Verdict

PASS — no route-back remains. Proceed to D.
