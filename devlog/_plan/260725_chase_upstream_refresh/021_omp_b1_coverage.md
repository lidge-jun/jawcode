# 021 — OMP band 1 chase-card coverage

## Band and method

Reviewed OMP `b0d04e517..v17.0.8`. Hash identity is normalized to the unique 9-character abbreviations emitted by `git log --format=%h`; all set operations use the same representation.

```bash
git -C devlog/_omp_chase/oh-my-pi rev-list --no-merges --count b0d04e517..v17.0.8  # 678
git -C devlog/_omp_chase/oh-my-pi rev-list --no-merges --count b0d04e517..v17.0.6  # 502
git -C devlog/_omp_chase/oh-my-pi rev-list --no-merges --count v17.0.6..v17.0.8    # 176
```

## Card allocation

| card | theme | classification | bucket | cited commits |
| --- | --- | --- | --- | ---: |
| 20.081 | AI catalog, streaming, auth, and provider recovery | adapt | A | 60 |
| 20.082 | session context, settings, and persistence integrity | adapt | A | 31 |
| 20.083 | tool filesystem, shell, Git, and timeout safety | adapt | A | 38 |
| 20.084 | task, subagent, advisor, and launch coordination | split | C | 140 |
| 20.085 | TUI rendering, input, Markdown, and terminal resilience | track-only | B | 86 |
| 20.086 | extensions, MCP, LSP, DAP, and browser integration | split | C | 44 |
| 20.087 | native diff, search, memory, and performance kernels | adapt | A | 40 |
| 20.088 | release, build, platform, and CI hardening | adapt | A | 46 |
| 20.089 | runtime stats, logging, collaboration, and operational edges | adapt | A | 20 |
| 20.090 | robomp and swarm reference tail | track-only | B | 2 |

## No-card hashes

The following 171 commits are explicit no-card entries because they are tests, formatting, changelog/docs, CI bookkeeping, version/vouch administration, or revert/merge-adjacent maintenance. They remain in the coverage set and may support a future card if a concrete JWC failure reproduces.

- `5e362714f` — no card: maintenance-only (ci: installed libstdc++ and libgcc in alpine musl smoke; .github/workflows/ci.yml)
- `1f7d2ff9e` — no card: maintenance-only (ci: skipped glibc-host smoke for musl release binaries; .github/workflows/ci.yml)
- `ca3d052ea` — no card: maintenance-only (chore(vouch): vouched 112 contributors; .github/VOUCHED.td)
- `3f38358c6` — no card: maintenance-only (test(mcp): polled full post-condition for deferred xdev mount; packages/coding-agent/test/sdk-mcp-instructions.test.ts)
- `2f5a67694` — no card: maintenance-only (test(dap): made tcp transport tests deterministic; packages/coding-agent/src/dap/client.ts,packages/coding-agent/test/debug/dap-launch-failures.test.ts)
- `1db0d7182` — no card: maintenance-only (style(iso): wrapped FICLONE comment for rustfmt; crates/pi-iso/src/linux_reflink.rs)
- `9b54d9e9a` — no card: maintenance-only (chore: bump version to 17.0.8; Cargo.lock,Cargo.toml,bun.lock)
- `32eb139c1` — no card: maintenance-only (test(tui): model mux pane growth in the render-stress shadow ledger; packages/tui/test/render-stress-harness.ts)
- `fc6256372` — no card: maintenance-only (test: fix local-midnight logger flake and stale kimi k3 thinking format pin; packages/ai/src/providers/__tests__/kimi-code-thinking.test.ts,packages/coding-agent/test/tools/jtd-to-json-schema.test.ts,packages/coding-agent/test/tools/yield.test.ts)
- `7d404686c` — no card: maintenance-only (chore: updated changelogs + remove summarization marker; packages/agent/CHANGELOG.md,packages/ai/CHANGELOG.md,packages/catalog/CHANGELOG.md)
- `e4de9509c` — no card: maintenance-only (test: adapt catalog-pinned tests to regenerated model catalog; packages/ai/test/openai-responses-history-payload.test.ts,packages/catalog/test/gateway-reference.test.ts,packages/coding-agent/test/agent-session-concurrent.test.ts)
- `0002905ec` — no card: maintenance-only (chore: untrack node_modules symlinks and harden ignore pattern; .gitignore,packages/agent/node_modules,packages/ai/node_modules)
- `58a2acd33` — no card: maintenance-only (test(coding-agent): align ctx fixtures with settled-component cache and todo commit-on-execute; packages/coding-agent/test/agent-session-eager-todo.test.ts,packages/coding-agent/test/collab/chunked-welcome.test.ts,packages/coding-agent/test/collab/guest-subagent-badge.test.ts)
- `dd80dcd03` — no card: maintenance-only (test(catalog): adapt ChatGPT-only retention test to multi-account discovery API; crates/vendor/uu-rm/src/rm.rs,packages/catalog/test/codex-discovery.test.ts)
- `8a9aa0342` — no card: maintenance-only (chore: format evaluator fix commits and suppress intentional DAP placeholder lint; packages/coding-agent/src/utils/git.ts,packages/coding-agent/test/debug/dap-launch-failures.test.ts,scripts/fix-changelogs.test.ts)
- `1b7dc1c3f` — no card: maintenance-only (docs: normalize changelog entries under [Unreleased]; packages/ai/CHANGELOG.md,packages/catalog/CHANGELOG.md,packages/coding-agent/CHANGELOG.md)
- `61989b184` — no card: maintenance-only (test(sdk): cover discovery-only local provider default resolution; packages/coding-agent/test/sdk-default-role-discovery-local-provider.test.ts)
- `b39b49a2c` — no card: maintenance-only (docs(coding-agent): fix grammar in resolveSpawnItems doc comment; packages/coding-agent/src/task/index.ts)
- `e117474bb` — no card: maintenance-only (docs(changelog): move #6177 entry to Unreleased section; packages/coding-agent/CHANGELOG.md)
- `ab8e36fa6` — no card: maintenance-only (test(coding-agent): make prewalk no-auth test independent of runner env keys; packages/coding-agent/test/prewalk-startup-degradation.test.ts)
- `f741936c5` — no card: maintenance-only (test(agent): signal tool boundary from the gate itself; packages/agent/test/pause-gate.test.ts)
- `b81cbb00f` — no card: maintenance-only (docs(ai): note string-vs-Error pattern asymmetry in isTransientStreamParseError; packages/ai/src/error/flags.ts)
- `b98b4d160` — no card: maintenance-only (docs: add [Unreleased] changelog entries for connection-failure retry classification; packages/coding-agent/CHANGELOG.md)
- `298fea76b` — no card: maintenance-only (chore(agent): clean retry helper formatting; packages/coding-agent/src/session/agent-session.ts)
- `72394db60` — no card: maintenance-only (test(mnemopi): refresh bench artifact on an idle host and sync changelog claims; packages/mnemopi/CHANGELOG.md,packages/mnemopi/bench/native-vectors.bench.json,packages/natives/CHANGELOG.md)
- `b1653f51e` — no card: maintenance-only (test(natives): refresh diff bench evidence on an idle host with guard-inclusive timings; packages/natives/bench/diff-results.md)
- `8047bedaa` — no card: maintenance-only (test(mnemopi): record bench host metadata and allow archive-deployed sha; packages/mnemopi/bench/native-vectors.bench.ts)
- `973bad0c6` — no card: maintenance-only (test(natives): include production isWellFormed guards in native diff timings; packages/natives/bench/diff.ts)
- `ee6717872` — no card: maintenance-only (test(natives): cover ill-formed UTF-16 rejection and jsdiff fallback; packages/coding-agent/test/tools/edit-diff.test.ts,packages/coding-agent/test/tools/edit-renderer.test.ts,packages/hashline/test/recovery-session-chain.test.ts)
- `7cbcc3e3a` — no card: maintenance-only (Normalize OSC 8 links in inline Markdown; packages/tui/src/components/markdown.ts,packages/tui/test/markdown.test.ts)
- `08e617eec` — no card: maintenance-only (Fix ST-terminated OSC 8 Markdown tables; packages/tui/CHANGELOG.md,packages/tui/src/components/markdown.ts,packages/tui/test/markdown.test.ts)
- `6b9726552` — no card: maintenance-only (chore(mnemopi): add changelog attribution links; packages/mnemopi/CHANGELOG.md,packages/natives/CHANGELOG.md)
- `55bba890a` — no card: maintenance-only (chore(coding-agent): add changelog attribution links; packages/coding-agent/CHANGELOG.md,packages/hashline/CHANGELOG.md,packages/natives/CHANGELOG.md)
- `c71834040` — no card: maintenance-only (chore(coding-agent): sync changelog numbers with final bench artifact; packages/coding-agent/CHANGELOG.md,packages/natives/CHANGELOG.md)
- `85b44bb0e` — no card: maintenance-only (test(natives): refresh diff bench results at final revision; packages/natives/bench/diff-results.md)
- `1b3e35716` — no card: maintenance-only (chore(natives): regenerate diff export docs; packages/natives/native/index.d.ts)
- `63124d044` — no card: maintenance-only (chore(coding-agent): add changelog entries for native diff; packages/coding-agent/CHANGELOG.md,packages/hashline/CHANGELOG.md,packages/natives/CHANGELOG.md)
- `81aa4ad27` — no card: maintenance-only (test(natives): add seeded randomized word-diff parity coverage; packages/natives/test/diff-parity.test.ts)
- `492eb6e2c` — no card: maintenance-only (style(natives): satisfy clippy for native diff module; crates/pi-natives/src/diff.rs)
- `29338e150` — no card: maintenance-only (test(mnemopi): refresh bench artifact at final kernel revision; packages/mnemopi/CHANGELOG.md,packages/mnemopi/bench/native-vectors.bench.json)
- `4ba69285d` — no card: maintenance-only (style(natives): satisfy clippy for vector kernels without breaking float parity; crates/pi-natives/src/vectors.rs)
- `4de678f44` — no card: maintenance-only (chore(mnemopi): add changelog entries for native vector kernels; packages/mnemopi/CHANGELOG.md,packages/natives/CHANGELOG.md)
- `c1495d9ff` — no card: maintenance-only (test(natives): make diff bench iterations and scenario ceiling tunable; packages/natives/bench/diff.ts)
- `c11083c15` — no card: maintenance-only (test(mnemopi): refresh native vector bench artifact; packages/mnemopi/bench/native-vectors.bench.json)
- `86ef6636c` — no card: maintenance-only (test(mnemopi): benchmark every swapped native vector kernel with adaptive iterations; packages/mnemopi/bench/native-vectors.bench.ts)
- `9ce37050d` — no card: maintenance-only (style(coding-agent): sort native diff imports; packages/coding-agent/src/modes/components/diff.ts)
- `85fae6928` — no card: maintenance-only (style(mnemopi): format native vector parity test; packages/mnemopi/test/native-vector-parity.test.ts)
- `5f41203f0` — no card: maintenance-only (test(natives): add jsdiff parity suite for native line/word diff; packages/natives/package.json,packages/natives/test/diff-parity.test.ts)
- `ad36bbeae` — no card: maintenance-only (test(ci): run release publish coverage; package.json,scripts/ci-test-ts.ts)
- `3179a524b` — no card: maintenance-only (test(agent): synchronize pause gate tool boundary; packages/agent/test/pause-gate.test.ts)
- `eee940c1c` — no card: maintenance-only (test(agent): avoid global pause gate spy; packages/agent/test/pause-gate.test.ts)
- `b927c4d0c` — no card: maintenance-only (test(agent): synchronize pause gate tool boundary; packages/agent/test/pause-gate.test.ts)
- `2fcef1390` — no card: maintenance-only (docs: corrected /advisor as session-scoped, not persisted; docs/advisor-watchdog.md,packages/coding-agent/CHANGELOG.md,packages/coding-agent/src/prompts/system/workflow-notice.md)
- `7b141199d` — no card: maintenance-only (chore: bump version to 17.0.7; Cargo.lock,Cargo.toml,bun.lock)
- `fe415b547` — no card: maintenance-only (chore: vouch maatheusgois-dd; .github/VOUCHED.td)
- `ec562c30e` — no card: maintenance-only (test(ai): preserve auth failure precedence; packages/ai/src/error/flags.ts,packages/ai/test/error-id.test.ts)
- `aa1b89db4` — no card: maintenance-only (chore: bump version to 17.0.6; Cargo.lock,Cargo.toml,bun.lock)
- `24e2a5261` — no card: maintenance-only (chore: reformat; packages/coding-agent/src/prompts/system/workflow-notice.md)
- `1fe22ee58` — no card: maintenance-only (docs: normalized changelogs after merges (fix-changelogs --since 924ea9a4); packages/ai/CHANGELOG.md,packages/catalog/CHANGELOG.md,packages/coding-agent/CHANGELOG.md)
- `f20be013c` — no card: maintenance-only (chore(catalog): regenerated devin models for GLM-5.2 variant collapse; packages/catalog/src/models.json)
- `cdcb53b6b` — no card: maintenance-only (docs(coding-agent): drop duplicated 17.0.5 entries; keep only the Unreleased plan-exit rollback line; packages/coding-agent/CHANGELOG.md)
- `7fef9e667` — no card: maintenance-only (docs(ai): drop rebase-duplicated 17.0.5 changelog entries; packages/ai/CHANGELOG.md)
- `4bd2896ba` — no card: maintenance-only (Update VOUCHED list; .github/VOUCHED.td)
- `bf0f690b2` — no card: maintenance-only (docs(ai): move Devin recovery note to unreleased; packages/ai/CHANGELOG.md)
- `0eeb6c381` — no card: maintenance-only (test(ai): pin codex workspace-scoped identity invariants; packages/ai/test/auth-storage-codex-workspace-identity.test.ts)
- `38cfbdc78` — no card: maintenance-only (docs(coding-agent): move plan-exit rollback changelog entry to Unreleased; packages/coding-agent/CHANGELOG.md)
- `57c2e082a` — no card: maintenance-only (docs(coding-agent): note plan exit rollback fix; packages/coding-agent/CHANGELOG.md)
- `21e8db496` — no card: maintenance-only (test(coding-agent): activated eval in skill workflow fixture; packages/coding-agent/test/agent-session-skill-keywords.test.ts)
- `c9e11dbb8` — no card: maintenance-only (test(coding-agent): corrected workflowz backend assertions; packages/coding-agent/test/agent-session-magic-keywords.test.ts)
- `f20d0b996` — no card: maintenance-only (test(coding-agent): updated workflow notice contracts; packages/coding-agent/test/agent-session-magic-keywords.test.ts,packages/coding-agent/test/modes/workflow.test.ts)
- `1f1e04641` — no card: maintenance-only (style(coding-agent): fix biome formatting in bash-executor test; packages/coding-agent/test/bash-executor.test.ts)
- `e77b687a6` — no card: maintenance-only (test(stats): derive expected conversation total; packages/stats/test/overview-token-labels.test.tsx)
- `9fd6e9711` — no card: maintenance-only (chore: bump version to 17.0.5; Cargo.lock,Cargo.toml,bun.lock)
- `546dce763` — no card: maintenance-only (chore: update changelogs; packages/agent/CHANGELOG.md,packages/ai/CHANGELOG.md,packages/catalog/CHANGELOG.md)
- `29aefbca4` — no card: maintenance-only (test: restored read-tool context-expansion contract tests; packages/coding-agent/test/tools.test.ts)
- `8f2cd23e3` — no card: maintenance-only (Revert "Merge PR #5812: fix(read): honor exact line selector bounds (@roboomp)"; packages/coding-agent/CHANGELOG.md,packages/coding-agent/src/tools/read.ts,packages/coding-agent/src/utils/block-context.ts)
- `32dc28251` — no card: maintenance-only (test: aligned read-tool and logout tests with landed contracts; packages/coding-agent/test/modes/controllers/selector-controller-logout.test.ts,packages/coding-agent/test/tools.test.ts)
- `7c769a3d5` — no card: maintenance-only (chore: fix prompt regressions; packages/coding-agent/src/prompts/tools/bash.md,packages/coding-agent/src/prompts/tools/debug.md,packages/coding-agent/src/prompts/tools/read.md)
- `8a57bcd4f` — no card: maintenance-only (Revert "Merge PR #5886: fix(robomp): defer rate-limited submissions (@roboomp)"; python/robomp/.env.example,python/robomp/README.md,python/robomp/src/config.py)
- `c3b9e5415` — no card: maintenance-only (chore: normalized changelog sections after merges; packages/catalog/CHANGELOG.md,packages/coding-agent/CHANGELOG.md)
- `633b8b091` — no card: maintenance-only (docs(changelog): move #5060 entry to Unreleased, drop stray Fixed header in released 16.5.2; packages/coding-agent/CHANGELOG.md)
- `c4dcd6535` — no card: maintenance-only (chore(changelog): keep sticky-codex entry under Unreleased and drop resurrected GLM duplicates; packages/ai/CHANGELOG.md)
- `92f7dfa8b` — no card: maintenance-only (chore: drop eval scratch baseline copy; .baseline-auth-storage.ts)
- `e5dd48821` — no card: maintenance-only (test(auth): step past usage-report TTL so the sticky-rerank regression exercises the headroom flip; packages/ai/test/auth-storage-codex-selection.test.ts)
- `449e402a1` — no card: maintenance-only (style: formatted merge resolutions with biome; packages/coding-agent/test/selector-settings-side-effects.test.ts)
- `cbd6164e3` — no card: maintenance-only (chore: normalized changelog sections after merges; packages/catalog/CHANGELOG.md,packages/coding-agent/CHANGELOG.md,packages/tui/CHANGELOG.md)
- `18a24f8c4` — no card: maintenance-only (style: formatted merge resolutions with biome; packages/ai/src/utils/schema/normalize.ts)
- `1acda6c1e` — no card: maintenance-only (style: formatted merge resolutions with biome; packages/catalog/src/compat/openai.ts)
- `eefbb1292` — no card: maintenance-only (chore: normalized changelog sections after merges; packages/ai/CHANGELOG.md,packages/catalog/CHANGELOG.md,packages/coding-agent/CHANGELOG.md)
- `cac8ac2fe` — no card: maintenance-only (chore(changelog): drop duplicate #5578 entry already documented on main; packages/coding-agent/CHANGELOG.md)
- `6945c4cd9` — no card: maintenance-only (test: stub getLastAssistantMessage in noninteractive-dispose session mock; packages/coding-agent/src/modes/noninteractive-dispose.test.ts)
- `f7f8e1188` — no card: maintenance-only (chore: normalized changelog sections after merges; packages/agent/CHANGELOG.md,packages/ai/CHANGELOG.md,packages/coding-agent/CHANGELOG.md)
- `a1caad9ce` — no card: maintenance-only (test: stub getLastAssistantMessage in print-mode session mocks for baseline compatibility; packages/coding-agent/test/print-mode-working-indicator.test.ts,packages/coding-agent/test/silent-abort-print-mode.test.ts)
- `c439b1eac` — no card: maintenance-only (docs(tools): documented ARIA ref selector and navigation gotchas; packages/coding-agent/src/prompts/tools/browser.md)
- `1570f2510` — no card: maintenance-only (docs(coding-agent): documented inline ask previews; packages/coding-agent/CHANGELOG.md)
- `401b7ee09` — no card: maintenance-only (docs(auth): softened "expired" to "no longer guaranteed warm" for sticky idle gate; packages/ai/CHANGELOG.md,packages/ai/src/auth-storage.ts,packages/ai/test/auth-storage-codex-selection.test.ts)
- `0ca454bef` — no card: maintenance-only (chore: bump version to 17.0.4; Cargo.lock,Cargo.toml,bun.lock)
- `9ee329c9d` — no card: maintenance-only (chore: update changelogs; packages/ai/test/auth-storage-codex-selection.test.ts,packages/ai/test/openai-codex-responses-lite.test.ts,packages/catalog/test/issue-1617-repro.test.ts)
- `49ab195b0` — no card: maintenance-only (docs(changelog): add subagent-output-coalescing entry (#5936); packages/coding-agent/CHANGELOG.md)
- `c6b2cdab9` — no card: maintenance-only (docs(changelog): add carried-line-widths entry (#5938); packages/tui/CHANGELOG.md)
- `bf45eb771` — no card: maintenance-only (docs(coding-agent): place loop status changelog entry; packages/coding-agent/CHANGELOG.md)
- `eed5da008` — no card: maintenance-only (test(mnemopi): pin the corruption retry contract end-to-end; packages/mnemopi/src/core/embeddings.ts,packages/mnemopi/test/corrupt-model-retry.test.ts)
- `61cdedec0` — no card: maintenance-only (docs(mnemopi): changelog entry for corrupt-model self-heal; packages/mnemopi/CHANGELOG.md)
- `b468f3a7a` — no card: maintenance-only (docs(catalog): correct grammar flavor additionalProperties contract; packages/catalog/src/types.ts)
- `421fdb182` — no card: maintenance-only (chore: retrigger CI after PR reopen; no file diff)
- `1da8471be` — no card: maintenance-only (docs(advisor): distinguished immune-turn asides from preserved cards; docs/advisor-watchdog.md)
- `42810e14c` — no card: maintenance-only (docs(advisor): documented plan and ACP delivery constraints; docs/advisor-watchdog.md,packages/coding-agent/CHANGELOG.md)
- `546549938` — no card: maintenance-only (docs(advisor): clarified concern delivery after a self-ended yield; docs/advisor-watchdog.md,packages/coding-agent/CHANGELOG.md)
- `1373e2f84` — no card: maintenance-only (chore: trigger mergeability recompute; no file diff)
- `48241afcc` — no card: maintenance-only (test(coding-agent): dropped stale URL read-cache assertions; packages/coding-agent/test/tools/fetch-kagi-toggle.test.ts)
- `6c33fc28c` — no card: maintenance-only (chore: retrigger CI (unrelated sdk-mcp-instructions.test.ts polling flake, twice); no file diff)
- `2c225a0d0` — no card: maintenance-only (chore: bump version to 17.0.3; Cargo.lock,Cargo.toml,bun.lock)
- `766790cba` — no card: maintenance-only (chore: unclanking edit pr; packages/hashline/CHANGELOG.md,packages/hashline/src/input.ts,packages/hashline/src/prompt.md)
- `4d4090a57` — no card: maintenance-only (style: formatted shell tilde-expansion test; crates/pi-shell/src/shell.rs)
- `0e05691cd` — no card: maintenance-only (style: formatted kimi-code k3 reasoning test; packages/ai/src/providers/__tests__/kimi-code-thinking.test.ts)
- `69148a89c` — no card: maintenance-only (chore: normalized changelogs after farm PR sweep; packages/ai/CHANGELOG.md,packages/coding-agent/CHANGELOG.md)
- `22f3701d9` — no card: maintenance-only (test(mcp): distinguish zombie grandchildren from live ones in kill checks; packages/coding-agent/src/mcp/transports/stdio.test.ts)
- `42e17c52d` — no card: maintenance-only (test(mcp): skip SIGTERM-trap escalation timing test on Windows; packages/coding-agent/test/mcp-stdio-transport.test.ts)
- `73e98b494` — no card: maintenance-only (test(coding-agent): removed brittle prompt prose assertions; packages/coding-agent/test/job-tool-agent-roster.test.ts,packages/coding-agent/test/task/task-spawn.test.ts)
- `f10658fe3` — no card: maintenance-only (docs(coding-agent): clarified async job lifecycle contract; packages/coding-agent/CHANGELOG.md,packages/coding-agent/src/prompts/tools/hub.md,packages/coding-agent/src/prompts/tools/task-async-contract.md)
- `4121c1978` — no card: maintenance-only (test(eval): aligned allowed-agent prompt expectation; packages/coding-agent/src/tools/__tests__/eval-description.test.ts)
- `28689a88c` — no card: maintenance-only (docs: clarified process-wide history scope; packages/coding-agent/CHANGELOG.md,packages/coding-agent/src/prompts/system/system-prompt.md)
- `05afc94ec` — no card: maintenance-only (docs: narrowed history:// contract to current session tree; packages/coding-agent/CHANGELOG.md,packages/coding-agent/src/prompts/system/system-prompt.md)
- `bdd7647bd` — no card: maintenance-only (docs(lsp): documented 300 second timeout ceiling; docs/tools/lsp.md)
- `0f9fceeea` — no card: maintenance-only (test(plan): seeded anthropic runtime key in issue-816 repro; packages/coding-agent/test/issue-816-repro.test.ts)
- `d527259c2` — no card: maintenance-only (chore: bump version to 17.0.2; Cargo.lock,Cargo.toml,bun.lock)
- `0f26558d0` — no card: maintenance-only (chore: reformat; packages/ai/test/gitlab-duo-workflow-provider.test.ts,packages/coding-agent/CHANGELOG.md,packages/coding-agent/test/extensibility/legacy-pi-inplace-load.test.ts)
- `38b73a5cb` — no card: maintenance-only (style(tests): removed unused fixture variable and formatted plan test; packages/ai/test/gitlab-duo-workflow-provider.test.ts,packages/coding-agent/test/issue-816-repro.test.ts)
- `85b9c01f1` — no card: maintenance-only (test(plan): made plan-role apply and restore regressions deterministic; packages/coding-agent/test/issue-816-repro.test.ts)
- `4b4bad430` — no card: maintenance-only (test(ai): aligned kimi-code thinking tests with the zai compat policy; packages/ai/src/providers/__tests__/kimi-code-thinking.test.ts)
- `731a2cb5b` — no card: maintenance-only (test(natives): gave timeout drain repro a spawn-proof deadline; crates/pi-natives/src/shell.rs,packages/agent/CHANGELOG.md,packages/ai/CHANGELOG.md)
- `206cb93fa` — no card: maintenance-only (test(bash): asserted timeout settles as flagged result; packages/coding-agent/test/tools.test.ts)
- `adb2a3c7e` — no card: maintenance-only (style: formatted files from owner-approved merges; packages/coding-agent/src/modes/controllers/selector-controller.ts,packages/coding-agent/src/tools/bash.ts,packages/coding-agent/src/tools/image-gen.ts)
- `8876eef88` — no card: maintenance-only (Revert "merge PR #5669 via eval/pr-5669:  fix(tui): preserve inline images in scrollback"; packages/tui/CHANGELOG.md,packages/tui/src/components/box.ts,packages/tui/src/components/image.ts)
- `c43eab8d0` — no card: maintenance-only (chore align OpenTelemetry versions; bun.lock,package.json)
- `bf8925b43` — no card: maintenance-only (test(session): drove plan-reference compaction tests through an active goal; packages/coding-agent/test/agent-session-plan-reference-compaction.test.ts)
- `f36394ef5` — no card: maintenance-only (style: fixed formatting in merged test and session files; packages/ai/test/cursor-exec-handlers.test.ts,packages/coding-agent/src/session/agent-session.ts,packages/coding-agent/test/slash-commands/clear-alias.test.ts)
- `2594ae352` — no card: maintenance-only (style: formatted conflict-resolved files with biome; packages/coding-agent/src/advisor/__tests__/advisor.test.ts,packages/coding-agent/src/advisor/runtime.ts,packages/coding-agent/src/modes/interactive-mode.ts)
- `f4bbf2dec` — no card: maintenance-only (chore: normalized changelogs after merge sweep; packages/ai/CHANGELOG.md,packages/catalog/CHANGELOG.md,packages/coding-agent/CHANGELOG.md)
- `dd84ec57c` — no card: maintenance-only (apply PR #5468: fix(advisor): stop retrying terminal failures; packages/coding-agent/CHANGELOG.md,packages/coding-agent/src/advisor/__tests__/advisor.test.ts,packages/coding-agent/src/advisor/runtime.ts)
- `7e47a1d36` — no card: maintenance-only (test(auth): isolated import fixtures from broker env; packages/coding-agent/CHANGELOG.md,packages/coding-agent/test/auth-broker-import.test.ts)
- `4e85f6ace` — no card: maintenance-only (apply PR #5490: fix(tui): refresh dark/light appearance on explicit ctrl+l reset; packages/coding-agent/CHANGELOG.md,packages/coding-agent/src/modes/controllers/input-controller.ts,packages/coding-agent/test/input-controller-keybindings.test.ts)
- `06d11d11a` — no card: maintenance-only (apply PR #5480: fix(slash-commands): added /q alias for /quit; packages/coding-agent/CHANGELOG.md,packages/coding-agent/src/slash-commands/builtin-registry.ts,packages/tui/test/autocomplete.test.ts)
- `421584d2d` — no card: maintenance-only (test(tui): cover Enter skill draft preservation; packages/tui/test/editor-autocomplete-actions.test.ts)
- `e207a49c1` — no card: maintenance-only (chore: restore unrelated prompt whitespace; packages/coding-agent/src/prompts/system/tan-context-switch.md)
- `7b693f3d0` — no card: maintenance-only (test(cli): cover clear alias collision; packages/coding-agent/test/agent-session-prune-persistence.test.ts,packages/coding-agent/test/slash-commands/clear-alias.test.ts)
- `8d9ba57c1` — no card: maintenance-only (test(bash): keep timeout regression additive; packages/coding-agent/test/bash-executor.test.ts)
- `1b0d629a7` — no card: maintenance-only (test(coding-agent): cover Ask single-select space input; packages/coding-agent/src/modes/components/ask-dialog.test.ts,packages/coding-agent/test/modes/components/ask-dialog.test.ts)
- `9e926c6cb` — no card: maintenance-only (docs(changelog): describe Lite choice handling; packages/ai/CHANGELOG.md)
- `6a5fd4548` — no card: maintenance-only (test(web-search): preserve Kimi search env; packages/coding-agent/test/tools/web-search-kimi.test.ts)
- `81714e85f` — no card: maintenance-only (test(cli): cover bounded print-mode error teardown; packages/coding-agent/test/silent-abort-print-mode.test.ts)
- `46dbe4bfc` — no card: maintenance-only (test(coding-agent): covered PlanYolo tool restoration; packages/coding-agent/test/agent-session-plan-mode-convergence.test.ts)
- `7d77fd7e9` — no card: maintenance-only (test(coding-agent): modeled xdev write transport; packages/coding-agent/test/agent-session-tool-rebuild-skip.test.ts)
- `dea5fc877` — no card: maintenance-only (ci: retry flaky workspace tests; no file diff)
- `1827b5a2e` — no card: maintenance-only (docs(coding-agent): move Warp events entry to Unreleased; packages/coding-agent/CHANGELOG.md)
- `9331b95ee` — no card: maintenance-only (style(session): satisfy xdev rewind checks; packages/coding-agent/src/session/agent-session.ts,packages/coding-agent/test/agent-session-checkpoint-rewind-branch.test.ts)
- `2e5fe68d6` — no card: maintenance-only (test(session): harden xdev rewind coverage; packages/coding-agent/CHANGELOG.md,packages/coding-agent/src/session/agent-session.ts,packages/coding-agent/test/agent-session-checkpoint-rewind-branch.test.ts)
- `4326b01db` — no card: maintenance-only (docs(coding-agent): attribute Warp event contribution; packages/coding-agent/CHANGELOG.md)
- `83c7e6930` — no card: maintenance-only (test(plugins): covered native addon commonjs wrapping; packages/coding-agent/test/extensibility/legacy-pi-inplace-load.test.ts)
- `2a21194bb` — no card: maintenance-only (test(irc): replaced manual dispose promise gates; packages/coding-agent/test/tools/irc.test.ts)
- `d85469264` — no card: maintenance-only (style(warp): organize event bridge import; packages/coding-agent/src/main.ts)
- `54373c92e` — no card: maintenance-only (test(warp): stub isInsideTmux in permission_request test; packages/coding-agent/src/modes/warp-events.test.ts)
- `664c80256` — no card: maintenance-only (test(warp): assert exact permission_request OSC body; packages/coding-agent/src/modes/warp-events.test.ts)
- `a68ad9125` — no card: maintenance-only (docs: documented magic keywords; README.md,docs/magic-keywords.md,docs/settings.md)
- `4c161cd0e` — no card: maintenance-only (test(warp): cover native event protocol; packages/coding-agent/CHANGELOG.md,packages/coding-agent/src/modes/warp-events.test.ts)
- `871eaa389` — no card: maintenance-only (test(tui): covered hub task job model snapshots; packages/coding-agent/test/job-model-badge-renderer.test.ts)
- `80b64676c` — no card: maintenance-only (docs(changelog): moved fix entry to unreleased; packages/coding-agent/CHANGELOG.md)
- `b85d64f9c` — no card: maintenance-only (Revert "fix(coding-agent): use ctx.settings instead of global settings proxy in renderInitialMessages"; packages/coding-agent/src/modes/utils/ui-helpers.ts)
- `50421de30` — no card: maintenance-only (test(ai): harden pi-native delayed stream fixture; packages/ai/test/pi-native-client.test.ts)
- `a50cdef4f` — no card: maintenance-only (test(advisor): fix status-line mocks for getAdvisorStatusOverview; packages/coding-agent/test/status-line-model.test.ts,packages/coding-agent/test/status-line-overflow.test.ts,packages/coding-agent/test/status-line-settings-cache.test.ts)
- `292b54359` — no card: maintenance-only (docs(changelog): advisor per-agent toggle entries; packages/coding-agent/CHANGELOG.md,packages/tui/CHANGELOG.md)

## Hash-set proof

- Delta set: **678** unique non-merge commits.
- Card-cited set: **507** unique commits.
- Explicit no-card set: **171** unique commits.
- Overlap between cited and no-card: **0**.
- Coverage arithmetic: **507 + 171 = 678**.
- Set difference: `delta - cited - no_card = ∅`.
- Overflow/RESIDUAL: **none**; cards stop at 20.090, within the allocated 20.081–20.099 range.

Reproduction shape:

```bash
comm -23 \
  <(git -C devlog/_omp_chase/oh-my-pi log --no-merges --format=%h b0d04e517..v17.0.8 | sort -u) \
  <({ rg -o '\x60[0-9a-f]{9}\x60' struct_har/chase/20.08[1-9]_omp_chase_*.md struct_har/chase/20.090_omp_chase_*.md; \
      rg -o '\x60[0-9a-f]{9}\x60' devlog/_plan/260725_chase_upstream_refresh/021_omp_b1_coverage.md; } \
    | sed -E 's/.*\x60([0-9a-f]{9})\x60.*/\1/' | sort -u)
# output: empty
```

