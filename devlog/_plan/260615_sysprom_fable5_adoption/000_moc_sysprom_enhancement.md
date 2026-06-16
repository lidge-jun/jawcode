# Sysprom Enhancement — Fable 5 / Claude Code / Codex Pattern Adoption

## 배경

Claude Fable 5 system prompt 분석 후, Jawcode sysprom에 채택할 패턴 선별.
Consumer chat 전용(copyright, child safety, wellbeing, recipe/map/weather 등)은 제외.
코딩 에이전트에 실질적 품질 향상이 되는 규칙만 도입.

## 유저 선택 (Interview 결과)

| ID | 선택 | 상세 |
|---|---|---|
| search_scaling | 명시 추가 | 단순 1회, 중간 3-5회, 깊은 조사 5-10회 |
| search_negative | 구체적 네거티브 | 기본 문법, 수학 공식, 역사적 사실 → 검색 불필요 |
| unrecognized_entity | 강제 검색 | 모르는 라이브러리/API/도구 → MUST search |
| url_fetch | MUST fetch | 유저 URL 언급 → 반드시 read |
| date_aware_search | 명시 추가 | web_search 쿼리에 현재 연도 사용 |
| formatting_restraint | 가벼운 절제 | 최소한 포맷, 과도한 bold/bullet 자제 |
| mistake_handling | Fable + 원인 분석 | 과잉사과/항복 금지 + 틀렸을 때 다른 각도에서 원인 파고듦 |
| tool_economy | 메타 도구 우선 | 넓은 도구로 범위 좁힌 후 구체 도구 사용 |

## 수정 대상

파일: `packages/coding-agent/src/prompts/system/system-prompt.md`

### 1. `<policy>` — tool economy 추가

현재:
```
Use tools whenever they materially improve correctness, completeness, or grounding.
**Search first, code second.**
```

추가:
```
Use broad/meta tools first to narrow scope, then specific tools for precision.
Avoid repeating near-identical queries — rephrase or use a different tool instead.
```

### 2. `<communication>` — formatting restraint 추가

현재: "Be concise and information-dense."

변경:
```
Be concise and information-dense. Use the minimum formatting needed for clarity — avoid
excessive bold, headers, and bullet points. Prefer prose for casual responses.
```

### 3. `<search-mandate>` — 5개 규칙 추가

기존 규칙 유지 + 아래 추가:

```
- **Search scaling**: scale tool calls to complexity — 1 for a single fact, 3-5 for
  medium investigation, 5-10 for deep research or multi-source comparison.
- **When NOT to search**: do not search for basic language syntax, well-known algorithms,
  math formulas, or established historical facts that training data answers reliably.
  Searching for "python for loop" or "what is binary search" wastes a tool call.
- **Unrecognized entities**: if you do not confidently recognize a library, API, CLI tool,
  framework, or external service, you MUST search before answering. Guessing costs the
  user's trust; searching costs one tool call.
- **URL fetch**: when the user mentions or provides a URL, MUST `read` it before responding.
  Do not answer about a URL's content without fetching it first.
- **Date-aware queries**: use the actual current year in `web_search` queries. Do not search
  "latest X 2025" when the year is 2026 — use "latest X" or "X 2026".
```

### 4. `<soul>` — mistake handling 추가

추가:
```
- **Own mistakes without groveling** - When wrong, acknowledge the error and pivot to a
  different angle of investigation. No excessive apology, no self-abasement, no unnecessary
  surrender. If the user's correction is itself wrong, say so — do not capitulate just to
  end the disagreement. Stay on the problem with steady, honest helpfulness.
```

## Phase

- [x] 10: Interview/선택
- [x] 11: mistake_handling 최종 결정 (Fable + 원인 분석)
- [ ] 20: 구현 (4곳 패치)
- [ ] 30: typecheck + 커밋

## 추가 발견 — Claude Code (`prompts.ts`) 분석

CC의 `getSimpleDoingTasksSection()`과 `getOutputEfficiencySection()`에서 추가 채택 후보:

### CC-1: 코드 스타일 절제 (CC "Doing tasks" 섹션)
```
- Don't add features, refactor code, or make "improvements" beyond what was asked.
- Don't add error handling for scenarios that can't happen.
- Don't create helpers or abstractions for one-time operations.
- Three similar lines of code is better than a premature abstraction.
```
**평가**: Jawcode `<completion-contract>`에 일부 있지만 "과도한 수정 금지"는 없음. AGENTS.md에 일부 규칙 있음.

### CC-2: 실패 시 진단 우선 (CC "Doing tasks")
```
If an approach fails, diagnose why before switching tactics — read the error,
check your assumptions, try a focused fix. Don't retry the identical action
blindly, but don't abandon a viable approach after a single failure either.
```
**평가**: Jawcode에 이런 규칙 없음. 실제로 에러 시 동일 명령 재시도하는 패턴 빈번.

### CC-3: 읽지 않은 코드 수정 금지 (CC "Doing tasks")
```
Do not propose changes to code you haven't read. If a user asks about or
wants you to modify a file, read it first.
```
**평가**: Jawcode `<before-editing>`에 암시적이지만 이렇게 명시적이지 않음.

### CC-4: Output efficiency — 산문 우선 (CC ant-only)
```
Write user-facing text in flowing prose while eschewing fragments, excessive
em dashes, symbols and notation. Only use tables when appropriate. Avoid
semantic backtracking.
```
**평가**: Fable의 formatting restraint와 겹침. 우리 formatting_restraint 선택과 통합 가능.

### CC-5: 독립 검증 에이전트 (CC verification agent)
```
When non-trivial implementation happens, independent adversarial verification
must happen before reporting completion. Your own checks do NOT substitute.
```
**평가**: Jawcode PABCD B-stage의 verifier와 유사하지만, 일반 세션에서는 적용 안 됨. 향후 고려.

### CC-6: 진행 상황 보고 시점 (CC ant-only output)
```
Before your first tool call, briefly state what you're about to do. While
working, give short updates at key moments: when you find something
load-bearing, when changing direction, when you've made progress without
an update.
```
**평가**: Jawcode `<communication>`에 유사 규칙 있지만 "첫 tool call 전 한 줄" 규칙은 없음.

## 추가 발견 — Codex 분석

### CX-1: developer / user instruction 분리
Codex는 `developer` role과 `user` contextual fragment를 명시적으로 분리.
**평가**: 아키텍처 수준 변경 — sysprom 패치 범위 아님.

### CX-2: memory exclusion
AGENTS.md/SKILL은 memory exclusion 대상으로 compaction 시 보존 안 됨.
**평가**: Jawcode compaction은 별도 구현. sysprom 범위 아님.

## 최종 추가 후보

| ID | 소스 | 채택 | 설명 |
|---|---|---|---|
| CC-1 | CC | ✅ 채택 | 과도한 수정 금지 — 요청 범위 밖 개선/리팩터/추상화 금지 |
| CC-2 | CC | ✅ 채택 | 실패 시 진단 우선, 동일 명령 맹목 재시도 금지 |
| CC-3 | CC | ✅ 채택 (MUST) | 읽지 않은 코드 수정 금지 — read 먼저 |
| CC-4 | CC | 통합 | formatting_restraint에 흡수 |
| CC-5 | CC | 보류 | PABCD verifier가 이미 커버 |
| CC-6 | CC | ❌ 불채택 | 현행 communication 규칙으로 충분 |
| CX-1 | Codex | 보류 | 아키텍처 수준 |
| CX-2 | Codex | 보류 | compaction 구현 수준 |

## 구현 대상 통합 (11개)

### sysprom 패치 위치별:

**`<policy>`** (tool economy):
- 메타 도구 우선, 동일 쿼리 반복 금지

**`<communication>`** (formatting + progress):
- 최소 포맷, 과도한 bold/bullet 자제

**`<search-mandate>`** (5개 규칙):
- search scaling (복잡도별 1/3-5/5-10회)
- when NOT to search (기본 문법/수학/역사 검색 불필요)
- unrecognized entities (MUST search)
- URL fetch (MUST read)
- date-aware queries (현재 연도 사용)

**`<before-editing>`** (CC 3개):
- MUST read before edit (CC-3)
- 실패 시 진단 우선 (CC-2)
- 요청 범위 밖 수정 금지 (CC-1)

**`<soul>`** (mistake handling):
- Fable 스타일 + 다른 각도 원인 분석

## Phase

- [x] 10: Fable 5 Interview
- [x] 11: mistake_handling 최종 결정
- [x] 12: CC/Codex 분석 + 추가 후보 선택
- [ ] 20: 구현 (5곳 패치)
- [ ] 30: typecheck + 커밋

## 추가 발견 — GJC / OMO / OMX 분석

### GJC (Gajae-Code, 업스트림)
GJC sysprom은 현재 Jawcode sysprom의 직접 조상. 구조 동일(Handlebars 템플릿, XML 블록).
차이점은 네이밍(`gjc`/`.gjc`→`jwc`/`.jwc`)과 워크플로우 표면.
**채택 대상 없음** — Jawcode가 이미 GJC를 포크/발전시킨 상태.

### OMO (oh-my-openagent) — 호스트 위임형 주입자
- `AgentConfig.prompt` + 메시지 in-band splice로 호스트에 주입
- **모델별 별도 빌더**: GPT-5.4/5.5, Kimi, Opus 4.7 각각 다른 프롬프트
- Gemini lost-in-the-middle 보정 splice
- compaction-context 8섹션 보존 규칙

**채택 후보:**
- **OMO-1: 모델별 프롬프트 보정** — 모델 능력차를 프롬프트에서 교정. 향후 고려.

### OMX (oh-my-codex) — fragment provenance 3단
- `AGENTS.md` 마커 4종(GUIDANCE/MODELS/AGENTS/RUNTIME) 비파괴 upsert
- docs fragment → sync 마커치환 → 정규식 계약 테스트로 프롬프트 표류 CI 차단
- 토큰 계산식 대신 고정 우선순위 + 글자수 cap + 결정적 overflow

**채택 후보:**
- **OMX-1: fragment provenance 테스트** — 프롬프트 변경 시 계약 테스트로 표류 방지. 향후 고려 (CI 수준).

### Hermes — frozen snapshot 전략
- "변하는 것은 시스템 프롬프트에 안 넣는다" — CC의 DYNAMIC_BOUNDARY와 목표 같되 수단 정반대
- 3계층(stable/context/volatile) 캐시 정렬
- 날짜를 일 단위로 낮춰 바이트 안정

**채택 후보:**
- **HM-1: stable/volatile 분리 원칙** — 이미 Jawcode의 Handlebars 조건부 블록이 유사 역할.

### 최종 판단
OMO/OMX/Hermes의 핵심 패턴은 **아키텍처/CI 수준**이라 sysprom 텍스트 패치 범위를 벗어남.
이번 사이클에서는 Fable 5 + CC 소스에서 뽑은 **11개 규칙**으로 충분.

## Phase (최종)

- [x] 10: Fable 5 Interview
- [x] 11: mistake_handling 최종 결정
- [x] 12: CC/Codex 분석 + 추가 후보 선택
- [x] 13: GJC/OMO/OMX/Hermes 분석 — sysprom 범위 아님 확인
- [x] 14: 병렬 executor 감사 (CLEAR, 2 WATCH minor)
- [x] 20: 구현 (5곳 패치, 12개 규칙) — fb67490b
- [x] 30: typecheck pass + 커밋
