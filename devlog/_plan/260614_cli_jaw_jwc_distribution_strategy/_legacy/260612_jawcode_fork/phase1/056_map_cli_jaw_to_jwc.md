# 056 — cli-jaw → jwc 명령·어휘 매핑 전수 표 (dev 스킬 치환 정본)

> 상위: [055_moc_dev_skills_compat.md](./055_moc_dev_skills_compat.md). 적용 지점: [057](./057_plan_skill_compat_patch.md) P1 치환 레이어.

## 1. 명령 매핑 (시맨틱 차이 포함)

| cli-jaw | jwc 등가물 | 시맨틱 차이 (치환 시 안내 포함 여부) |
|---------|-----------|--------------------------------------|
| `cli-jaw orchestrate I\|P\|A\|B\|C\|D` | `jwc orchestrate i\|p\|a\|b\|c\|d` | **대소문자** + 상태 저장(서버 ctx vs `.gjc/state/pabcd-state.json`). P/A 워커: dispatch+JSON worker vs **Boss 세션+task subagent(planner∥architect)** — 차이 안내 불요(051 정본이 지시) |
| `cli-jaw orchestrate reset` | `jwc orchestrate complete` | 완전 동형 아님(reset=IDLE+ctx 클리어 / complete=active false) — "(full reset 미지원)" 주석 포함 |
| `cli-jaw orchestrate status` | `jwc orchestrate status` | 동형 |
| `cli-jaw dispatch --agent "X" --task "…"` | **task subagent** (planner/architect/critic/executor — `task/agents.ts:48-67`) | 직원=별도 프로세스·temp cwd·HTTP vs subagent=in-session. `--mutable`/`--scope`/plan 자동 주입 **없음** — task 프롬프트에 plan 전문 직접 포함 지시로 치환 |
| `cli-jaw dispatch --virtual` | task/explore subagent | virtual employee 개념 없음 |
| `cli-jaw goal set/update/done/pause…` | `jwc goal …` (060 예정, [061](./061_design_goal_merge.md)) | 060 전까지 "[jwc: goal 표면 060 밴드 예정]" stub 안내 |
| `cli-jaw memory search/read/save` | `jwc memory …` (070 예정, [99.01.01](./99.01.01_design_memory_merge.md)) | 동일 stub |
| `cli-jaw bgtask add …` | **없음** | degraded: "[jwc: unavailable — 장기 외부 대기는 로컬 폴링 또는 사용자 수동 재개]" |
| `cli-jaw browser …` | **없음** (cli-jaw 설치 머신 한정) | degraded 안내 |
| `cli-jaw project set/clear` | **없음** | "Project root는 프롬프트 주입으로 대체" 안내 |
| `cli-jaw task add/done/…` | **없음** (서버 태스크) | degraded — jwc 내부 todo 도구 사용 안내 |
| `/interview` slash | `jwc orchestrate i` (또는 `jwc interview` 단독) | D050-1 동일 엔진 |

## 2. 역할 어휘 매핑

| cli-jaw 어휘 | jwc 어휘 | 문맥 규칙 |
|--------------|----------|-----------|
| Boss / 보스 | main session (메인 세션) | 단독 에이전트 — "지휘" 뉘앙스 제거 |
| employee / 직원 / worker | subagent | 격리·프로세스 분리 함의 제거 |
| `cli-jaw dispatch` 결과 "stdout 동기 반환" | task tool 결과 반환 | |
| worklog `## Plan` SSOT | `plan_ref` devlog 파일 + `.gjc/plans/ralplan/<run-id>/pending-approval.md` | 062에서 approved-plan 주입 등가물 설계 — 그 전까지 "plan은 task 프롬프트에 직접 포함" |
| `~/.cli-jaw` (identity folder) | **보존** + "(cli-jaw instance folder — jwc 프로젝트 아님)" 주석 | 경로 치환 금지 (085.5 경계 규칙) |
| Web UI / 대시보드 / 채널 전송 | degraded 안내 | jwc 단독에 없음 |

## 3. dev 스킬 본문 — 적용 지점 전수 (file:line은 ~/.cli-jaw/skills/dev/SKILL.md 기준)

| line | 원문 요지 | 치환 |
|------|-----------|------|
| 3, 24, 89, 91-97 | "orchestrated sub-agents", "employee audit", "Boss/direct", employee role/task_tags | §2 역할 어휘 |
| 26 | C5 → `cli-jaw orchestrate I` | `jwc orchestrate i` |
| 69-70, 94-97 | task_tags dispatch 메타 | degraded: "[jwc: task_tags 자동 주입 없음 — 해당 role 스킬을 직접 읽을 것]" |
| 108-110 | §0.4 모드 표(orchestrate/goal/employee) | 명령 매핑 + 역할 어휘 |
| 135 | dev-pabcd companion 참조 | "jwc orchestrate 단계 프롬프트(네이티브)" 로 치환 |
| 339-346 | §3 bgtask 서버 재호출 | degraded 블록 치환 |
| 44, 359, 488 | worklog 파일·서브에이전트 비용 | 보존 (호환) |

dev-code-reviewer `SKILL.md:314-316` Sub-Agent Review Mode — §2 역할 어휘만.

## 4. 치환 규칙 (구현 계약 — 057 P4 `applyCliJawDevVocabularyMap`)

1. **보존 우선**: `~/.cli-jaw` 경로·`.gjc/`·코드 블록 내 비명령 텍스트는 무변경. 명령 치환은 단어 경계 `cli-jaw ` 접두 매치만
2. **대문자 stage 변환**: `orchestrate ([IPABCD])\b` → 소문자
3. **degraded는 대체 안내 삽입**(조용한 삭제 금지): `[jwc: unavailable — <대안>]` 고정 포맷
4. **gjc 브랜드 no-op**: jaw 브랜드 + provider `cli-jaw` 조합에서만 적용 (gjc는 애초에 cli-jaw 스킬 invisible)
5. 치환 테이블은 **단일 모듈 정본** — dev 스킬 개정 시 테이블만 갱신 (스킬 소스는 cli-jaw 인스턴스 소유, jwc가 수정 금지)

## 5. [열린 질문]

1. goal/memory stub 문구 — 060/070 구현 후 자동으로 실명령 치환으로 바뀌도록 테이블에 feature-flag를 둘지, 그때 테이블을 고칠지 ([기본값 제안: 그때 수정 — YAGNI])
2. `cli-jaw chat search` 등 매핑 표 밖 명령 잔여 — 발견 시 테이블 추가 (전수조사는 dev 스킬군 한정이었음; 다른 cli-jaw 스킬 29종 전체는 055 범위 밖)
