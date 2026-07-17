# 019 — GJC batch-note commits

> Range: `4a80bac9..3ddf26079`
> These commits are version bumps, CI-only, style-only, or test-contract syncs
> that do not warrant a dedicated cluster file.

기계적으로 생성한 문서 인덱스는 `chore`로 표시한다. 나머지는 버전 증감과 의미 변경이 없는 formatting만 남긴다.

## 커밋 목록

| # | hash | summary | category |
|---|---|---|---|
| 1 | `260c1a5cc` | chore(prompts): regenerate docs index | chore |
| 2 | `390455508` | style(gjc-sdk): match nightly rustfmt for oversized-frame test arms | style |
| 3 | `a630a79ea` | chore: bump version to 0.11.1 | bump |
| 4 | `5c40ca865` | chore: bump version to 0.11.0 | bump |
| 5 | `cc48cd5be` | chore: bump version to 0.10.2 | bump |
| 6 | `ff03e588a` | chore: bump version to 0.10.1 | bump |
| 7 | `58dcc0a81` | Revert "chore: bump version to 0.10.2" | bump |
| 8 | `5b6076367` | chore: bump version to 0.10.2 | bump |
| 9 | `e96856d2f` | Revert "chore: bump version to 0.10.1" | bump |
| 10 | `115c49058` | chore: bump version to 0.10.1 | bump |
| 11 | `9e63d6e74` | chore: bump version to 0.10.0 | bump |
| 12 | `c2651e828` | fix(gjc-rpc): clean up failed post-ready startup (#2025) | coverage-gap |
| 13 | `1975c7a29` | fix(coding-agent): trim CRLF from editor output (#2024) | coverage-gap |
| 14 | `a14ee84a6` | fix(coding-agent): reject malformed SQLite pagination (#2023) | coverage-gap |
| 15 | `5edb79bc5` | fix(coding-agent): repair issue 1938 post-merge regressions (#2037) | coverage-gap |
| 16 | `3355ab879` | fix(coding-agent): reject out-of-range numeric gate replies (#2030) (#2038) | coverage-gap |
| 17 | `d9dcffd0e` | fix(pi-natives): treat CRLF as zero-width in grapheme_width_str (#2036) | coverage-gap |
| 18 | `b4a74d0e7` | fix(agent-core): hint at tool discovery when a called tool is not found (#2042) | coverage-gap |
| 19 | `dc56acebe` | fix(coding-agent): guard selector done() restoreComposer with editor-swap fallback (#2052) | coverage-gap |
| 20 | `b6a15bb9e` | fix(coding-agent): scrub macOS MallocStackLogging env at the launch boundary (#2054) | coverage-gap |
| 21 | `663828fe9` | fix(agent): make the token heuristic script-aware for CJK text (#2067) | coverage-gap |
| 22 | `51b21c16e` | fix: exit quietly on broken output pipes instead of crashing (EPIPE) | coverage-gap |
| 23 | `e3e861ce3` | feat(dev-link): fail loudly when workspace symlinks point at another worktree | coverage-gap |
| 24 | `40cc74080` | fix: scope broken-pipe handling to owned output sinks | coverage-gap |
| 25 | `df190d65e` | fix: suppress logger during quiet pipe cleanup | coverage-gap |
| 26 | `e7850bcc7` | docs(coding-agent): regenerate embedded RPC reference | coverage-gap |
| 27 | `cc44dc2d4` | fix(coding-agent): preserve clipboard images on submit | coverage-gap |
| 28 | `6a62bf3b3` | fix(coding-agent): return a defensive copy from extension getSystemPrompt() | coverage-gap |
| 29 | `84a4585a6` | test(coding-agent): make the system-prompt defensive-copy regression test real | coverage-gap |
| 30 | `6e147d58e` | fix(sdk): make SDK the canonical external bus (#2078) | coverage-gap |
| 31 | `55128f1ba` | fix(session): default permission mode to allow when no provider is connected (#2143) | coverage-gap |
| 32 | `a11b621db` | fix(coding-agent): preserve successor image attachments | coverage-gap |
| 33 | `a158bc7ce` | fix(coding-agent): enforce composer restore contract | coverage-gap |
| 34 | `f3724cd80` | fix(ask): use local UI for attended asks instead of hanging on workflow gate (#2149) | coverage-gap |
| 35 | `aeacb9376` | fix(tui): share stdout error listener (#2156) | coverage-gap |
| 36 | `82554b256` | feat(tui): disabled select-list items with coherent no-selection state (#2154) | coverage-gap |
| 37 | `a8f9602d0` | fix(sdk): reject typed retired mode aliases (#2140) | coverage-gap |
| 38 | `81adacf76` | fix(coding-agent): preserve clipboard images on submit | coverage-gap |
| 39 | `247fe0cc8` | fix(coding-agent): preserve successor image attachments | coverage-gap |
| 40 | `825ea2de6` | fix(coding-agent): persist credential import decisions (#2205) | coverage-gap |
| 41 | `972d431ea` | fix(coding-agent): enforce composer restore contract | coverage-gap |
| 42 | `5a16c9aa7` | fix(ask): use local UI for attended asks instead of hanging on workflow gate (#2149) | coverage-gap |
| 43 | `80adb0cdf` | fix(tui): share stdout error listener (#2156) | coverage-gap |
| 44 | `5b0d2ebf0` | feat(tui): disabled select-list items with coherent no-selection state (#2154) | coverage-gap |
| 45 | `bc8f8f12f` | fix(lsp): contain owned stdin peer closure (#2210) | coverage-gap |
| 46 | `cc63e38a9` | Revert "fix(ask): use local UI for attended asks instead of hanging on workflow gate (#2149)" | coverage-gap |
| 47 | `c3d8b5d81` | fix(lsp): defer language-server startup until first use (#2230) | coverage-gap |
| 48 | `68538a6e7` | fix(coding-agent): isolate source SDK broker respawns (#2236) | coverage-gap |
| 49 | `b86930b4c` | fix(sdk): correlate workflow gate presentations (#2220) | coverage-gap |
| 50 | `949893be7` | fix(vendor/insane-search): cross-platform yt-dlp resolution (upstream v0.9.2) (#2285) | coverage-gap |
| 51 | `91e8652e7` | fix(sdk): idempotent gate completion + capability-gated workflow controls | coverage-gap |
| 52 | `363557663` | fix(sdk): deliver accepted prompt lifecycle terminals (#2280) | coverage-gap |
| 53 | `9e1a23ee0` | fix(discord): make inbound lease recovery deterministic (#2305) | coverage-gap |
| 54 | `5c6a28f3f` | fix(discord): bound terminal prune mapping scans (#2310) | coverage-gap |
| 55 | `4e1e44888` | feat(coding-agent): pin explicit tool folds | coverage-gap |
