# 00 — MOC: jwc 도구 토큰 오버헤드 감축 (38k → 14-16k)

> 상태: 🟡 계획 수립 완료 / 구현 대기
> 입력: 세션 시작 시 도구 정의에 약 38k 토큰 소비. PI 모델 호환성을 유지하면서 58-63% 감축.

## 한 줄 결론

`tools.discoveryMode` 기본값을 `"all"`로 전환하고, essential 도구를 15개로 확장하고,
managed MCP에서 `computer-use`를 제거하고, `search_tool_bm25`에 전체 도구 스냅샷을 추가하면
**38k → 14-16k (58-63% 감축)** 달성.

## 변경 요약

| # | 변경 | 파일 | 효과 |
|---|---|---|---|
| 1 | `tools.discoveryMode` 기본값 `"off"` → `"all"` | settings-schema.ts | discoverable 도구 ~14k defer |
| 2 | `DEFAULT_ESSENTIAL_TOOL_NAMES` 3개 → 15개 | tools/index.ts | PI 모델 호환성 확보 |
| 3 | managed MCP에서 `computer-use` 제거, `cua-driver`만 유지 | jwc-defaults.ts | macOS MCP ~1.2k 절감 + cu-mcp 의존성 제거 |
| 4 | search_tool_bm25 description에 도구 스냅샷 추가 | search-tool-bm25.ts, search-tool-bm25.md, tool-index.ts | PI 모델이 deferred 도구를 정확히 검색 |
| 5 | 테스트 업데이트 | default-mcp-config.test.ts, initial-tools.test.ts | 변경 사항 검증 |
| 6 | 문서 업데이트 | structure/21_extensibility.md | 정합성 유지 |

## Essential 도구 세트 (DEFAULT 14개 + search_tool_bm25 자동 = active 15개, ~10,739 토큰)

> `DEFAULT_ESSENTIAL_TOOL_NAMES`에는 14개가 들어가고, `search_tool_bm25`는 `discoveryMode !== "off"`일 때
> `createIf()`로 자동 생성됨 (loadMode=essential). 따라서 초기 active essential surface는 15개.

| # | 도구 | 토큰 | 카테고리 |
|---|---|---:|---|
| 1 | `read` | 1,394 | 📖 파일 읽기 |
| 2 | `bash` | 601 | ⚡ 명령 실행 |
| 3 | `edit` | 1,295 | ✏️ 파일 수정 |
| 4 | `write` | 188 | 📝 파일 생성 |
| 5 | `find` | 632 | 🔍 파일 탐색 |
| 6 | `search` | 534 | 🔍 grep 코드 검색 |
| 7 | `ast_grep` | 889 | 🔍 AST 구조 검색 |
| 8 | `ast_edit` | 853 | ✏️ AST 구조 편집 |
| 9 | `web_search` | 240 | 🌐 웹 검색 |
| 10 | `browser` | 690 | 🌐 브라우저 (검색 에스컬레이션) |
| 11 | `ask` | ~400 | 💬 사용자 상호작용 |
| 12 | `subagent` | 1,097 | 🤖 에이전트 위임 |
| 13 | `task` | 1,457 | 📋 작업 관리 |
| 14 | `skill` | ~400 | 🔧 jwc 스킬 시스템 |
| 15 | `search_tool_bm25` | ~500 | 🔍 도구 발견 (자동 생성) |

### 근거

- PI(provider-independent) 철학: 모든 모델이 기본 코딩 워크플로를 수행할 수 있어야 함
- system prompt에서 `web_search → read → browser` 검색 파이프라인이 명시됨 (system-prompt.md:251-252)
- `subagent`/`task`는 jwc의 team/goal/plan 워크플로의 핵심
- `ast_grep`/`ast_edit`는 리팩터링 필수
- `skill`은 jwc 고유 기능 시스템

## Discoverable 도구 (search_tool_bm25 뒤에 defer)

debug, eval, lsp, monitor, inspect_image, todo_write, github, CronCreate/List/Delete,
recipe, render_mermaid, calc, checkpoint, rewind, job, ssh, irc, goal(조건부)

## MCP 변경

| MCP 서버 | 현재 | 변경 후 | 근거 |
|---|---|---|---|
| context7 | managed default (모든 플랫폼) | **유지** | 2개 도구 ~870 토큰, docs 검색 필수 |
| computer-use | managed default (macOS) | **제거** | cu-native macOS 전용 Swift 바이너리, cua-driver와 기능 중복 |
| cua-driver | managed default (macOS) | **유지** | AX-트리 기반 데스크톱 자동화, 36개 도구는 MCP discovery로 defer |

## 문서

| # | 문서 | 내용 |
|---|---|---|
| 00 | 본 MOC | 결론·변경 요약·도구 세트 |
| [10](./10_implementation_plan.md) | 구현 계획 — diff-level 상세 |
