DONE

Read-only P1.5.3 verification completed against `devlog/_plan/260614_performance/41_p1_5_3_pruning_digest_plan.md`.

Findings:
- `packages/agent/src/compaction/pruning.ts` implements digest-aware notices with `DIGEST_NOTICE_TOKEN_CAP_MULTIPLIER`, `createGenericPrunedNotice()`, `createPrunedNotice(tokens, message?)`, and `resultDigest()` for `bash`, `search`, and `grep`; non-digest tools fall back to `[Output truncated - N tokens]`.
- `tokensSaved` uses `estimatePrunedSavings(tokens, notice)`, and candidates carry `notice` plus `savings`, so savings subtract the actual mutated notice length.
- The optional native token-counting path is preserved: `pruneToolOutputs(entries, config, encoding?)` still branches to `countMessageTokensNative(message as AgentMessage, encoding)` and does not introduce upstream `estimateEntryTokens(entry)`.
- Staleness implementation covers selector-stripped read paths, search key defaults (`skip`, `i`, `gitignore`), structured successful file details, failed per-file handling, `resolve`/`ast_edit`, and patch envelopes including `Add File`, `Update/Delete File`, and `Move to` destinations.
- `packages/agent/test/pruning-redteam.test.ts` includes digest assertions for bash/search summaries, generic non-digest notices, bounded notice size, and `tokensSaved` based on actual notice length.
- `packages/agent/test/pruning-staleness.test.ts` covers Add File staleness, Move to destinations, selector-qualified reads, failed per-file grouping, same-path partial success, resolve/ast_edit details, suffix-resolved reads, and search pagination/result-shaping defaults. `pruning-staleness-redteam.test.ts` remains the adversarial staleness coverage file.
- Parent docs are aligned: `04_verification_matrix.md` names P1.5.3 as digest-aware pruning/staleness parity, and `23_p1_5_upstream_v3_merge_plan.md` lists the three pruning tests instead of the absent token-cache test.
- `46_p1_5_3_b_summary.md` records the named Encoding runtime-test waiver, maps each staleness parity case to concrete test evidence, and cites the observed gates: focused pruning tests PASS 45/158, focused biome PASS, and `bun --cwd=packages/agent run check` PASS.

No files were edited by verifier.
