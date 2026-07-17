# 029 — OMP batch-note commits

> Range: `7aa1d581c..b0d04e517`
> These commits are version bumps, merge resolutions, --amend pairs, style-only,
> or test-contract syncs that do not warrant a dedicated cluster file.

## 커밋 목록

| # | hash | summary | category |
|---|---|---|---|
| 1 | `f9977f5c6` | reconciled test contracts with merged behavior changes | test |
| 2 | `e28197c69` | reverted merged empty-toolUse retry reclassification | merge |
| 3 | `1df790a5d` | reverted incomplete sibling tool-call discard | merge |
| 4 | `1e85462cf` | reconciled merged sources with current main APIs | merge |
| 5 | `af541f257` | `--amend` follow-up | merge |
| 6 | `778ef6d7f` | `--amend` follow-up | merge |
| 7 | `984a97fa5` | formatted evaluator test additions | style |
| 8 | `69de4b772` | formatted history-protocol test imports | style |
| 9 | `22374ab21` | aligned retry/flag/python-detach tests with merged semantics | test |
| 10 | `cfb5d71c0` | aligned merged provider/RPC regression tests | test |
| 11 | `5e74444c2` | repaired auth-storage merge resolution and normalized changelogs | merge |
| 12 | `891967485` | added IPC clone-error changelog entry | style |
| 13 | `3c0a09ff5` | attributed eval-fix changelog entry | style |
| 14 | `93db3913d` | updated tips | style |
| 15 | `337feb297` | improved test null safety and type assertions | test |
| 16 | `9af5835b2` | removed noisy test | test |
| 17 | `46a898f87` | removed verbosity from changelog | style |
| 18 | `3c2c9f5bc` | updated changelog for u10 | style |

## 누락 커밋 보완 (2026-07-17)

범위 전체와 기존 분류 파일의 정확한 해시 차집합에서 확인한 누락 커밋을 추가한다.

| # | hash | git one-line summary | category |
|---|---|---|---|
| 1 | `017fd641d` | feat(harbor-manager): added support for apple-container backend | misc |
| 2 | `02efdee78` | fix(omfg): compiled generated-rule conditions via inline-flag helper | misc |
| 3 | `0418d8622` | fix(cli): handle native parser usage errors | misc |
| 4 | `0856055df` | feat(harbor-manager): unified benchmark normalization and reporting | misc |
| 5 | `09fa0fcb6` | docs(ttsr): clarified scope frontmatter forms | style |
| 6 | `0a79dba7f` | test(coding-agent): adapted plugin-install and loader-accent tests to landed behavior changes | test |
| 7 | `0f9a30153` | fix(harbor): fixed Disable dev console mirroring in bun server to prevent AbortError crashes during hot reloads | misc |
| 8 | `14aa1e206` | feat(harbor-manager): implemented experiment tracking and orchestration | misc |
| 9 | `1a5331e50` | test(ai): aligned suppression regression with versioned usage cache key | test |
| 10 | `22f2c1947` | test(session): validated auto-compaction guard and recovery behavior | test |
| 11 | `295655255` | test(coding-agent): validated behavioral consistency across core toolset | test |
| 12 | `2c7b701e1` | test(cli): cover one-shot print working indicator | test |
| 13 | `3047c27c3` | fix(test): skip real-browser tab.evaluate test when chromium cannot exec | test |
| 14 | `32714d2fd` | feat(harbor-manager): support apple container runs | misc |
| 15 | `35d3e49d1` | fix(harbor-manager): prevented dev-server teardown rejections from killing the manager | misc |
| 16 | `3e6ae36c7` | feat(robomp): added repo-scoped issue search to issue triage flow | misc |
| 17 | `4181ef18b` | build(coding-agent): prevented embedding native runtime dependencies | misc |
| 18 | `45e7a12f3` | chore(harbor-manager): relabel downshift arm trigger | style |
| 19 | `465f463ad` | fix(python/robomp): ensured omp run directory remained writable for all slots | misc |
| 20 | `539c13209` | feat(python/robomp): refined issue triage prompts with stricter bug classification rules | misc |
| 21 | `5c58641e5` | test(coding-agent): isolate header fallback regression | test |
| 22 | `5c9fa528c` | test(coding-agent): cover nested output priority | test |
| 23 | `62d037778` | test: hardened dynamic-border and plugin-install tests for full-suite runs | test |
| 24 | `6328671d1` | chore(coding-agent): updated legacy pi module import path | style |
| 25 | `6624b97e3` | docs(coding-agent): describe lazy web search fallbacks | style |
| 26 | `6a4bd404c` | test(cli): reset usage-error exit status | test |
| 27 | `6bd51d4ad` | refactor(coding-agent): decoupled tip weight test from tips.txt data | style |
| 28 | `6dc48a8b0` | fix(cli): print concise usage error instead of source dump | misc |
| 29 | `6f6f2f263` | feat(harbor-manager): introduced experiment analytics and arm management | misc |
| 30 | `77f641268` | feat(metaharness): migrated harbor-manager to metaharness and updated harness logic | misc |
| 31 | `79faf94f2` | feat(python/robomp): added the wontfix primary classification and comment-only triage path | misc |
| 32 | `7bfdf73cd` | docs(coding-agent): link advisor staleness fix to #4850 | style |
| 33 | `7c49c6cf9` | test(ai): cover Cursor usage registration | test |
| 34 | `81c4cb6df` | fix(coding-agent): address PR review feedback (#4924) | test |
| 35 | `86824c94e` | fix(ttsr): registered rules with inline regex flags and malformed scope | misc |
| 36 | `8702a3f22` | feat(metaharness/scripts): added trace-report generation for metaharness run traces | misc |
| 37 | `8a510052a` | feat(tools): implemented command extraction and filtering logic | misc |
| 38 | `8f783d100` | refactor(export): removed redundant parse error logging | style |
| 39 | `96ba1a99f` | feat(harbor-manager): implemented arm orchestration and vite dev harness | misc |
| 40 | `9978404c6` | test(coding-agent): guarded compiled header fallback regression | test |
| 41 | `b451f9456` | feat(harbor-manager): implemented job resumption and trial recovery | misc |
| 42 | `b6559861d` | feat(cli): standardized throughput calculation to total duration | misc |
| 43 | `bda0d5ddc` | test(lsp): require initial configuration before hover | test |
| 44 | `cbe083224` | docs(coding-agent): corrected context promotion docs | style |
| 45 | `d76872274` | test(harbor-manager): updated test suites for downshift migration | test |
| 46 | `d7849ddea` | feat(harbor-manager): migrated reasoning slide functionality to downshift nomenclature | misc |
| 47 | `d8ad39320` | test(launch): validated terminal screen replay rendering and state | test |
| 48 | `df7193731` | fix(test): raised timeout for real-browser tab.evaluate test | test |
| 49 | `e42589d43` | test(coding-agent): validated session persistence and downshift logic | test |
| 50 | `e426186e4` | feat(robomp): added local issue indexing and commit-search tool support | misc |
| 51 | `e889572cf` | test(pi-shell): added integration tests for shell builtins | test |
| 52 | `e90bbf121` | feat(harbor-manager): replaced vite with native bun server bundling | misc |
| 53 | `ecd2b7122` | test(ai): updated zai feature quota expectation | test |
| 54 | `edd959a38` | build: removed generation of docs index | misc |
| 55 | `fc35e17cb` | fix(pi-ast): satisfied rustfmt and clippy const-fn lint in ops.rs | style |
