# 020_omp_D11_search_grep_tools

> Range: `7aa1d581c..b0d04e517` (subset)
> Cluster: D11 — search, grep, and tool-surface consolidation
> Sol priority: P2
> Model-related: no
> Card target: 20.063_search_grep_tools
> Worker: OW7

## 커밋 전수 테이블

| # | hash | summary | JWC impact area |
|---|---|---|---|
| 1 | `91b67c7b0` | honor configured xAI transport for web search | web-search provider; model registry |
| 2 | `ce10e5fff` | add advanced grep with PCRE2 and traversal | native grep/search pipeline |
| 3 | `8755c3879` | extend regex and filtering capabilities | Rust/native grep |
| 4 | `f946d550e` | normalize GNU basic alternation | Rust/native grep |
| 5 | `d0f2feaa5` | record GNU basic alternation behavior | `packages/natives/CHANGELOG.md` |
| 6 | `d1317c303` | make native grep allocation-free | native grep |
| 7 | `f359a5f29` | right-size native grep read buffers | native grep |
| 8 | `b87cfc7e1` | read grep files from stable snapshots | native grep |
| 9 | `f69783765` | keep column caps from faking window truncation | tool output metadata; streaming output |
| 10 | `a9c038818` | remove separate selector args from read/grep APIs | read/search selector grammar |
| 11 | `5ff277349` | consolidate tool surface onto xd:// devices and hub | tool registry; internal URLs |
| 12 | `3d90b880b` | restore file completion in slash arguments | `packages/tui/src/autocomplete.ts` |
| 13 | `1d42de8ea` | constrain automatic file-completion triggers | autocomplete/editor |
| 14 | `45143e8c7` | restrict traversal depth for glob matching | native glob |
| 15 | `83fbefac2` | disable context padding for raw reads | `packages/coding-agent/src/tools/read.ts` |
| 16 | `a4f43be04` | reject writes to read-only internal URLs | internal URL router; write tool |
| 17 | `e291d77cb` | expand paths in the OMP grep CLI | grep CLI; path selector tests |
| 18 | `530faffd2` | distinguish glob timeout from empty results | glob tool |
| 19 | `3272b6574` | prioritize shallow fuzzy path matches | native file discovery/completion |

## 주제 분석

이 클러스터는 검색 정확도와 모델에 노출되는 도구 표면을 함께 바꾼다. xAI web search는 설정된 transport를 실제 요청까지 전달한다. native grep은 PCRE2, filtering, traversal, stable snapshot, buffer 크기와 allocation을 정비한다. read/grep selector와 output metadata는 결과 창이 잘렸는지, 실제로 결과가 없는지를 구분하도록 조정한다.

동시에 tool surface는 `xd://` device와 hub 중심으로 합쳐지고, slash argument의 파일 완성·glob depth·raw read padding·read-only internal URL 쓰기 제한이 경계 조건을 만든다. JWC에 필요한 핵심은 OMP의 도구 이름을 복제하는 것이 아니라 검색 budget, selector 의미, truncation 표지, 내부 URL 권한을 현재 search/read 계약에서 일관되게 유지하는 것이다.

## Worktree 대조

JWC에는 OMP의 `packages/coding-agent/src/tools/grep.ts`가 없고 `packages/coding-agent/src/tools/search.ts`, `read.ts`, `packages/natives/`가 검색 책임을 나눠 가진다. `xd://` 표면도 현재 JWC에는 없다. 반면 native grep, glob, TUI autocomplete, internal URL router는 모두 존재하므로 PCRE2와 traversal/budget 불변식은 비교 가능하다. 특히 JWC search의 전역 cap·파일별 cap·round-robin 결과 순서를 OMP의 ranged grep/window 의미로 바꾸지 않도록 별도 적합성 검토가 필요하다.

## 누락 커밋 보완 (2026-07-17)

범위 전체와 기존 분류 파일의 정확한 해시 차집합에서 확인한 누락 커밋을 추가한다.

| # | hash | git one-line summary | classification |
|---|---|---|---|
| 1 | `4c167eaa6` | feat(coding-agent): integrated google search with shared browser utilities | search/grep/tooling |
| 2 | `7a0ae7031` | feat(coding-agent/tools): implemented bulk conflict resolution via conflict://* | search/grep/tooling |
| 3 | `7e5e7e864` | feat(coding-agent-tools): implemented auto-trimming for echo lines | search/grep/tooling |
| 4 | `95add0187` | fix(coding-agent): load web search fallbacks lazily | search/grep/tooling |
| 5 | `a886a3090` | feat(hashline): standardized drift recovery using anchor remapping | search/grep/tooling |
| 6 | `a9adf20af` | fix: prevented false overlap errors by deduplicating identical edits | search/grep/tooling |
| 7 | `af1832af1` | feat(coding-agent/prompts): refined tool prompts for shell, browser, and eval workflows | search/grep/tooling |
| 8 | `bb35e7918` | fix(ast): auto-wrap multi-node patterns instead of erroring | search/grep/tooling |
| 9 | `bd7d39522` | feat(coding-agent/tools): added predicate polling support to wait() | search/grep/tooling |
| 10 | `d0f90f35a` | refactor(coding-agent): removed unreliable web search providers | search/grep/tooling |
| 11 | `d34ae9b79` | fix(coding-agent): keep lazy search fix unreleased | search/grep/tooling |
| 12 | `d50cc4e2d` | feat(coding-agent): made hashline seen-line guard opt-in via edit.enforceSeenLines | search/grep/tooling |
| 13 | `d7a71642c` | fix(coding-agent): guarded browser header generation | search/grep/tooling |
| 14 | `dabe233c6` | feat(coding-agent/web): improved perplexity results | search/grep/tooling |
| 15 | `de72e15fa` | fix(tools): accepted empty GitHub search date placeholders | search/grep/tooling |
| 16 | `e0e24efaf` | fix(tools): strip stray leading colon from tool paths | search/grep/tooling |
| 17 | `e45796908` | feat(hashline): implemented strict validation for boundary repairs | search/grep/tooling |
| 18 | `ea632a518` | feat(coding-agent): expanded search capabilities and scraping reliability | search/grep/tooling |
| 19 | `f512d9961` | fix(tool): strip leading colon before Windows path shapes | search/grep/tooling |
