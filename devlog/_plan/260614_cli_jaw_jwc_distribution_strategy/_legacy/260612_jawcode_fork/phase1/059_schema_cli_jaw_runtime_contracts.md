# 059 — 스키마: cli-jaw 런타임 계약 (bgtask·C분류·Interview 증거)

> ⚠️ **[구원칙 폐기 — 인터뷰 260612 02:04]** 본 문서의 'gjc diff-0 / 무수정 추종 / 런타임 치환 / 무회귀' 서술은 폐기된 구원칙 기록이다. 현행 원칙은 **소스 하드 수정**(Jaw/jwc 어휘 직접 기입, 가드 jwc 기준 반전) — [085.5 개정판](./085.5_plan_prompt_rebrand.md) · [095](./095_plan_debt_cleanup.md) 참조.

> 상위: [055_moc_dev_skills_compat.md](./055_moc_dev_skills_compat.md). 조사: CLI 서브에이전트 (260612 13:05, cli-jaw 소스 기준 경로).
> 058이 "스킬이 가정하는 워크플로우 골격"이면 059는 "스킬이 인용하는 **부속 계약** 3종" — jwc에서 각각 이식/치환/degraded 판정.

## 1. bgtask — [확정: jwc degraded] 치환 불가, 스키마만 채록

dev 스킬 §3(작업 대기 규칙)이 인용하는 서버 소유 백그라운드 계약. jwc는 서버가 없어 **이식 불가** — 056 degraded 문구의 근거 스키마.

- `BgTaskSpec` (`src/bgtask/types.ts:29-48`): `{command?, cwd?, env?, completion, resultExtractor?, promptTemplate, stallAfterMs?, maxResultChars?, respawn?, deadlineAt?}`
- completion 4종: `exit` / `json-line{match}` / `line-pattern{regex}` / `session-status{sessionId}`; extractor 4종: `tail-lines{n}` / `matched-line` / `command` / `session-answer`
- status: `running|complete|failed|cancelled|orphaned`; 저장 jaw.db `background_tasks` (`src/core/db.ts:246-260`)
- 재호출: 완료 시 `promptTemplate`({{result}}/{{taskId}}/{{status}} 보간)을 Boss 메시지 큐에 주입 (`src/routes/bgtask.ts:44-86`)

**jwc 등가물**: 없음. 가장 가까운 것은 gjc 세션 내 long-running tool 대기 — 의미가 다름(턴 생존 vs 서버 영속). 056 치환: "[jwc: unavailable — bgtask is a cli-jaw server feature; keep long-running work in-turn or instruct the user]" 유지 [확정].

## 2. 작업 분류 C0–C5 + DEV-ESCALATE-01 — [기본값: jwc 이식 후보 1순위]

dev 스킬이 아니라 **Boss 시스템 프롬프트 템플릿**이 소유 (`src/prompt/builder.ts:558-565`) — 스킬 치환(057)으로는 안 들어오고 별도 이식 필요.

- 분류: C0 trivial text / C1 single-file local / C2 ordinary slice / C3 cross-domain·public API / C4 high-risk(auth·payments·security·deletion·migration·release·permissions) / C5 research·ambiguous. **두 분류 신호 충돌 시 상위 승**.
- 라우팅: C0-C1 direct / C2 compact plan / C3 compact-full PABCD(영속·계약·아키텍처 리스크 시) / C4 full PABCD / C5 research·interview
- DEV-ESCALATE-01 트리거(fast path 무효화): security, data deletion/migration, destructive ops, public contract change, release surface, permission model, new dependency/framework
- 검증 스케일: 주장 증명에 필요한 최소 명령 / C3 affected-suite / C4·release 전체 게이트

**jwc 이식 지점 [기본값 제안]**: 054 jwc orchestrate의 진입 판정(어느 모드로 시작할지)이 현재 미정 — C0-C5 표를 jaw 브랜드 시스템 프롬프트 조각(085.5 L1 레이어와 같은 buildSystemPrompt data 경유)으로 주입하면 dev 스킬의 "C4-promotion" 어휘가 jwc에서도 해석 가능해짐. gjc 브랜드는 미주입(diff-0). → 057 P-목록에 "P11: C분류 프롬프트 조각" 후보 등재.

## 3. Interview 증거 스키마 — 040 밴드 교차 (043 elicitation의 상위 계약)

`src/orchestrator/state-machine.ts:20-368` — jaw-interview(040)가 쓰는 추적 자료구조. 043은 질문 fence만 계약화했고 **증거/평가 스키마는 미채록**이었음 — 여기서 보완.

```typescript
type EvidenceSource = 'user_statement'|'repo_fact'|'inference'|'assumption'|'default';
type EvidenceDimension = 'goal'|'constraint'|'success'|'ontology';
type ClarityLevel = 'low'|'medium'|'high'|'xhigh'|'max';
interface InterviewEvidence { fact; source; confidence /*0-1*/; turnNumber; dimension? }
interface DimensionAssessment { goal; constraint; success; ontology }  // 각 ClarityLevel
```

- 트래커 직렬화 (`:332-338`): `<interview_tracker>` 블록에 `assessment` JSON + `known[]` + `unknown[]`
- 관점 로테이션 (`:240-260`): R1-2 RESEARCHER+SIMPLIFIER → R3+ ARCHITECT+BREADTH_KEEPER → 전 차원 xhigh/max 시 SEED_CLOSER
- 종료 기준 (`:356-366`): goal·success=max, 전 차원 ≥xhigh, blocking unknown 0, assumption 전부 확인/명시 수용 → "Run `cli-jaw orchestrate P`" 제안
- elicitation fence (`:305-312`): `questionId/label/description/options[{value,label}]/visibleWhen{fieldId:[values]}` — 043과 일치 (검증됨)

**jwc 함의**: 041 jaw-interview 병합 설계가 트래커를 자체 스키마로 재정의 중이면 이 5-튜플(`fact/source/confidence/turnNumber/dimension`)과 ClarityLevel 5단계로 **정렬** [기본값 제안] — federation(140)에서 인터뷰 산출물 교환 시 무변환. 관점 로테이션·종료 기준은 041 프롬프트 조각으로 채택 여부 [열린 질문 — 040 밴드 이월].

## 4. 요약 — jwc 판정 표

| 계약 | 판정 | 반영처 |
|------|------|--------|
| bgtask | degraded 안내 [확정] | 056 치환 테이블 (기존 유지) |
| C0-C5 + ESCALATE-01 | 프롬프트 조각 이식 [기본값] | 057 P11 후보, 085.5 L1 경유 |
| Interview 증거 5-튜플 | 스키마 정렬 [기본값] | 041 트래커 정의 |
| task_tags/role 맵 (058 §3) | 순수 데이터 이식 [기본값] | 057 P10 후보 |
