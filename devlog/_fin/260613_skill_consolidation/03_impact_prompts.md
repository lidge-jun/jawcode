# 프롬프트 템플릿 영향 전수 분석

> 서브에이전트 병렬 검증 결과 (260613)

## 변경 대상 요약

| 파일 | ralplan 히트 | ultragoal 히트 | 변경 유형 |
|---|---|---|---|
| `system/system-prompt.md` | L24,27-29,42,53,81 | L31-33,82 | 하드코딩 제거 + 라우팅 업데이트 |
| `tools/skill.md` | L4,9,23-24 | L4,9,23-24 | 예시 업데이트 |
| `agents/planner.md` | L7,20-21,57 | L42 | CLI 동사 + 핸드오프 |
| `agents/architect.md` | L9,28,89 | — | CLI 동사 |
| `agents/critic.md` | L7,20,62 | — | CLI 동사 |
| `agents/executor.md` | — | L34-45 | XML 태그 리네임 |
| `jaw/orchestrate-i.md` | — | — | jaw-interview 참조 |
| `jaw/orchestrate-p.md` | L8,17,19 | — | **최고 우선순위** — CLI 동사 |
| `jaw/orchestrate-a.md` | L12 | — | 어휘 라벨 |
| `jaw/orchestrate-b.md` | L8 | — | 경로 참조 (유지) |

## 파일별 상세 변경

### 1. system-prompt.md — 라우팅 테이블 전면 개편

```
현재 (L80-82):
- Vague requirements → use jaw-interview
- Clear requirements → use ralplan → pending approval
- Durable goal ledger → use ultragoal; no plan → ralplan first

변경:
- Vague requirements → use jaw-interview (또는 orchestrate i)
- Clear requirements → run orchestrate p → pending approval
- Durable goal ledger → use goal; no plan → orchestrate p first
```

하드코딩 `<skill>` 블록 (L23-37):
```xml
현재: jaw-interview, ralplan, ultragoal, team (4개 하드코딩)
변경: jaw-interview, team (2개 하드코딩) + 동적 {{#list skills}} (나머지)
```

ralplan/ultragoal은 동적 렌더 블록으로 이관 — 스킬이 존재하면 자동 노출.

### 2. orchestrate-p.md — 최고 우선순위

L17 CLI 동사가 orchestrate-p의 핵심 퍼시스턴스 경로:
```
현재: ralplan --write --stage critic → ralplan --write --stage final
변경: 주석 추가 "also serves orchestrate p" (CLI 자체는 유지)
```

`.jwc/plans/ralplan/` 경로는 **실제 디스크 경로이므로 유지**.

### 3. agents/planner.md + architect.md + critic.md

공통 패턴:
```yaml
# frontmatter
bashAllowedPrefixes:
  - jwc ralplan --write    # 유지 (실제 허용 CLI)
  - jwc state
```

제약 텍스트에 주석 추가:
```
"Persist through jwc ralplan --write (persistence channel for orchestrate p)"
```

### 4. agents/executor.md

XML 블록 리네임:
```xml
현재: <ultragoal_red_team_mode> ... </ultragoal_red_team_mode>
변경: <goal_red_team_mode> ... </goal_red_team_mode>
```

### 5. tools/skill.md

예시 업데이트:
```
현재: ralplan → ultragoal 체인 예시
변경: orchestrate p → goal 체인 예시
```

## 원자적 변경 그룹

### Group A: 안전 (독립 변경 가능)
- executor.md XML 태그 리네임
- tools/skill.md 예시 업데이트
- orchestrate-a.md 어휘 라벨

### Group B: 연관 (동시 변경 필수)
- system-prompt.md 라우팅 테이블 + `<skill>` 블록 제거
- skill-keywords.ts `$ralplan` 트리거 변경
- 동적 `{{#list skills}}` 렌더가 정상 작동 확인 후

### Group C: 민감 (테스트 필수)
- planner.md / architect.md / critic.md의 `bashAllowedPrefixes`
- orchestrate-p.md CLI 동사
→ 이들은 `jwc ralplan --write`가 실제 작동하는 CLI이므로 리네임 시 통합 테스트 필수
