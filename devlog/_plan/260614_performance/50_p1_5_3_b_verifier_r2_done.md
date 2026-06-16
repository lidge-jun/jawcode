DONE

Read-only P1.5.3 C-failure fix verification completed.

Findings:
- C-P153-1 is fixed: `pruning-redteam.test.ts` now includes a `grep` digest case asserting `matches=8` and `files=2`, plus an unparseable `search` case asserting `search digest unavailable`.
- C-P153-2 is fixed: the bash digest test now asserts all required fields: `exit=2`, `tail=done tail`, and `error=error: compile failed`.
- `pruning.ts` has bounded extra digest budget via `DIGEST_NOTICE_MIN_EXTRA_TOKENS = 24` combined with the existing multiplier cap; digest output still flows through `truncateField()`.
- The redteam test keeps the actual-notice-length `tokensSaved` assertion and a bounded notice size assertion.
- `49_p1_5_3_b_fix_summary.md` records sufficient observed gates for this fix: focused pruning tests PASS 45 tests / 171 expects, focused biome PASS, and `bun --cwd=packages/agent run check` PASS.
