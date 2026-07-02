DONE

B-stage delta verification of commit 665aad2 (ADV-1 fix). Verifier model: openai/gpt-5.5:high.

- Commit/current scope: `git show 665aad2` changes exactly the three target files; `git diff --stat 665aad2 -- <three files>` returned no output, so current target files match the commit.
- config-cli.ts:106-110: `--` handled before `--json`, pushes `args.slice(i + 1)` as positional, breaks; 112-116 keep prior behavior before the separator; 119-123 unchanged key/value assembly.
- Parser probe confirmed the quoted single-token dash-leading value is verbatim (`- bullet tone\n- second line`), `--json` before `--` sets flags.json, `-x` before `--` dropped (matches tests).
- builtin-registry.ts:65-70: instruction states interior newlines preserved/ends trimmed, retains no-save-on-empty, single-quoted heredoc temp file, persists via `config set identity.toneCustom -- "$(cat /tmp/tone-custom.txt)"`, then `identity.tone custom` in the required order.
- test/config-cli.test.ts:132-151: three parseConfigArgs cases match actual parser behavior.
- Regression hunt: `--json` after separator is positional (standard separator behavior); get/reset/path handlers ignore irrelevant extra key/value (get 318-340, reset 372-395, path 397-399) — no bad interaction.
- ADV-2 waiver factually accurate: helpers/parse.ts:31-35 pre-trims; /tone trims args/rest (builtin-registry.ts:1037-1040); `/tone custom   ` hits the no-args prompt branch (1055-1058), never a save branch.

Main-session gate evidence: bun test config-cli + system-prompt-identity → 19 pass/0 fail; coding-agent check clean; live E2E `config set identity.toneCustom -- "- bullet tone\n- second line"` persisted and read back intact.
