DONE

B-stage delta verification of commit 3df39c4 (ADV-B1/B2 fix). Verifier model: openai/gpt-5.5:high.

- Current instruction scope: `packages/coding-agent/src/slash-commands/builtin-registry.ts:61-75` is only `buildToneCustomInstruction()` returning string literals joined with `\n`.
- Heredoc/fixed delimiter: no operational heredoc, fixed delimiter, `TONE_EOF`, `cat >`, `<<`, or fixed `/tmp/tone-custom.txt` remains. `builtin-registry.ts:67` mentions `shell heredoc` only as an explicit prohibition and mentions `any delimiter line` only as safe input content.
- Unique temp path + cleanup: `builtin-registry.ts:68` says to run `mktemp`; `:70` uses `<that-file>` instead of fixed `/tmp`; `:72` deletes the temp file.
- Verbatim write path: `builtin-registry.ts:69` requires writing pasted text VERBATIM with the agent file-write tool, explicitly `not via shell`.
- Persistence order retained: `builtin-registry.ts:70` runs `config set identity.toneCustom -- "$(cat <that-file>)"`; `:71` then runs `config set identity.tone custom`.
- Empty/no-save and trim wording retained: `builtin-registry.ts:65` preserves interior-newline/end-trim wording; `:66` says decline or paste nothing saves nothing.
- Diff containment: `git show 3df39c4 --name-status` lists only `packages/coding-agent/src/slash-commands/builtin-registry.ts`; current file matches the verified commit for this path.
- Residual injection surface: no step evaluates pasted text as shell syntax. Step 2 writes the paste through the file-write tool. Step 3 executes `cat <that-file>`; pasted bytes become one argv value after `--`, not recursively parsed shell code.

Main-session gate evidence before this verifier: bun test config-cli + system-prompt-identity → 19 pass/0 fail; coding-agent check clean.
