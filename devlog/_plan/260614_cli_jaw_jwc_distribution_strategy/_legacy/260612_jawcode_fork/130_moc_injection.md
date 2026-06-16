# 130 MOC — 스킬·PABCD·인증 주입 (cli-jaw 측) = M2 Done 지점

> 📐 상세 설계: [111_design_runtime_attach.md](./111_design_runtime_attach.md) §5 — 030 brand-aware 디스커버리 덕에
> 스킬 주입 1차 경로가 "서버 GJC_BRAND_NAME=jwc 설정"으로 단순화됨 (프롬프트 합성 주입안 대체).

> 상태: ⬜. 결정 근거: D5/D7 [확정]. **이 밴드 완료 = M2 done 3항목 충족.**
> **260613 플립 기준 재구체화 (gjc→jwc flip 반영)** — 앵커 재검증·추가:
> `loadSkills`(`src/extensibility/skills.ts:108`, dir 단위는 `:71 loadSkillsFromDir`) ·
> `discoverAuthStorage`(`src/sdk.ts:409`, 세션 주입 계약은 `sdk.ts:225` AuthStorage 옵션) ·
> pabcd 상태 정본 `src/jwc-runtime/orchestrate-state.ts`(구 gjc-runtime — 플립) ·
> 스킬 임베디드 prefix `embedded:jwc/`(`jwc-defaults.ts`). **이별 교차(99.30.02→260613 확정)**:
> 주입 대상 워크플로 스킬은 jaw-interview·ultragoal·team — ralplan은 superseded 스텁이라
> 주입 카탈로그에서 제외 후보 (착수 시 CANONICAL_JWC_WORKFLOW_SKILLS 축소와 동행 검토).

## 스코프 A — 스킬 주입 (M2 done ③)

> ⚓ 상위 원칙 [D112-2, 260612]: cli-jaw = 영속 인스턴스(메모리·스킬의 주체) / jwc = 일회용 병렬
> 세션(소비자). 스킬·메모리는 **하향 주입만**, 세션의 자체 축적(consolidation)은 임베디드에서 격하/비활성
> [확정 260612: **비활성 — 주입만**, 격하안 기각] — [112_moc_gui.md](./112_moc_gui.md) §인스턴스 vs 세션.

> **260613 결정 [확정]: 네이티브 우선 — 프롬프트 합성 경로(구 1차) 건너뜀.**
> browse skill (260612_browse 트랙) 구현으로 jwc가 tool guidance를 자체 처리함이 입증됨.
> cli-jaw는 PABCD/boss/identity/memory만 주입, tool-specific guidance는 jwc 네이티브에 위임.

1. ~~[기본값] 1차는 프롬프트 합성 경로~~ → **폐기**. jwc가 tool description + hidden skill로 자체 처리.
2. [확정] jwc 네이티브 디스커버리가 정본. cli-jaw `~/.cli-jaw/skills/`는 jwc `session.skills`로 직접 전달.
3. **A1 조건부 축소** [확정]: jwc 모드 시 A1 시스템 프롬프트의 tool-specific 섹션(browser, search, web-ai) 제거. cli-jaw 고유 기능만 잔류 (dispatch, computer-use, vision-click).
4. **browser 정본 = jwc browser tool** [확정]: `cli-jaw browser` CDP 커맨드는 jwc 모드에서 jwc browser tool로 라우팅. A1의 browser/desktop-control 섹션 제거, browse skill이 정본.
5. **search/web-ai 포팅** ✅ 완료: search는 standalone hidden skill (`hide:true`), web-ai는 browse:web-ai fragment (`skill-fragment`, `parentSkillName: "browse"`). A1의 search 섹션 제거 대상.
6. 충돌 주의: 020 jaw 아이덴티티 오버레이와 cli-jaw 시스템 프롬프트의 이중 적용 방지 — cli-jaw는 PABCD/identity 영역만 합성

> [D10 이득, R14] M1에서 jwc 명령 표면이 cli-jaw와 통일되므로(orchestrate/goal/memory),
> 임베딩 시 프롬프트·스킬·사용자 학습의 어휘 충돌이 원천 제거 — 130의 단일화 작업이 "표면 정합"이 아니라
> "엔진 연결"만으로 줄어듦.

## 스코프 B — PABCD 연결

1. cli-jaw orchestrate 상태머신(P/A/B/C/D 프롬프트 생성)이 JawRuntime 세션에 단계 프롬프트 주입
2. **[확정 D130-1, 260612]** 정본 규칙은 "어느 저장소가 이기느냐"가 아니라 **스코프 분리**:
   cli-jaw `orc_state`(단일 행, 서버당 1개)와 jwc `pabcd-state.json`(cwd·세션당 N개)은 **같은 사실의
   중복 저장이 아니라 다른 스코프의 상태**다.
   - cli-jaw DB = **boss 파이프라인 정본** ("회사가 지금 무슨 단계인가", 전사 1개)
   - jwc 상태 파일 = **세션/프로젝트 로컬 파이프라인** ("이 작업장이 지금 무슨 단계인가")
   - 동기화는 **단방향 주입만**: boss 단계 → 임베디드 jwc 세션 컨텍스트 (99.03 M2 헤더 레일 재사용).
     역방향 sync 금지 — N개 세션 → 1행 머지 문제 원천 차단. 세션 로컬 pabcd가 boss와 다른 단계여도 모순 아님.
   - 상향은 sync가 아니라 **보고**: worker verdict/체크포인트는 기존 dispatch 결과·`orchestrate verdict`
     경로로 boss가 수신 후 boss가 DB에 기록 (cli-jaw 현행 모델 유지).
   - 세부는 jaw 적용 시 **튜닝으로 보정** [사용자 확정]: ① 하향 주입 표기(boss/로컬 동시 활성 시
     `[BOSS — B] · [LOCAL — P]` 이중 라벨 vs boss 단독), ② 주입 시점(매 턴 vs 단계 변화 시),
     ③ HUD 세그먼트의 스코프 우선순위, ④ 자가 전이 단락 훅(아래 열린 질문)과의 결합.
   - (구 [기본값] "cli-jaw 상태머신을 정본으로"는 boss 스코프에 한정해 유지; 텍스트 리소스 공유로
     사본 드리프트 방지 원칙도 유지.)
3. 단계별 도구 게이팅: P/A에서 write/edit 비활성 (jwc role agent read-only 패턴 재사용 — `src/jwc-runtime/restricted-role-agent-bash.ts`)

## 스코프 C — 인증 공유 (M2 done ②)

1. cli-jaw 서버와 jwc TUI가 같은 AuthStorage(agentDir) 사용 — `discoverAuthStorage` 주입 [확정 D7]
2. 090 시딩 브리지를 cli-jaw 기동 경로에서도 호출 (서버가 먼저 떠도 토큰 사용 가능)

## M2 Done 검증 (3항목)

| # | 항목 | 검증 |
|---|------|------|
| ① | spawn 없는 jaw chat | 110 완료 기준 승계 + 회귀 |
| ② | 로컬 토큰 즉시 사용 | 신규 머신 시나리오: Claude 로그인만으로 Web UI 대화 |
| ③ | `~/.cli-jaw/skills` 주입 | Web UI에서 스킬 발동 e2e (search/diagram 등 실스킬 1개) |

## 열린 질문

- ~~스킬 주입 1차(프롬프트)→2차(네이티브) 전환 시점~~ → **해소**: 네이티브 우선 확정 (260613)
- ~~cli-jaw A1 시스템 프롬프트와 jwc 시스템 프롬프트의 권한 어휘 충돌 목록~~ → **축소**: A1 tool 섹션 조건부 제거로 충돌 범위 대폭 감소. 잔여: dispatch/computer-use/vision-click의 jwc tool과 충돌 여부만 확인
- 자가 전이 단락 훅: 상주 환경에서 모델의 `jwc orchestrate <stage>` shell 호출을 in-process로 가로채는
  방식 (BashTool 인터셉트 vs 전용 도구 등록) — [111 §착수 전 실측 보강](./111_design_runtime_attach.md) 열린 질문 2 승계
- D130-1 튜닝 항목 ①~④의 확정 시점 (130 착수 시 프로토타입으로 결정)
- ~~search skill 보강 범위~~ → **130.2 §6 감사 결과 참조**: 커버리지 갭 9건 식별 (높음 3 / 중 4 / 낮 2). progrok/M1-M5/agbrowse research plan은 의도적 미포팅

## 선행 완료 (109 밴드)

| 문서 | 내용 | 130 영향 |
|---|---|---|
| [109.1](./109.1_receipt_tool_guidance_porting.md) | browse/search/web-ai 포팅 | Slice A 전제 충족 (A1 축소 가능) |
| [109.2](./109.2_receipt_integration_audit.md) | 병렬 감사 + DAG | A1 분석 완료, post-A1 override 권장 |
| [109.3](./109.3_receipt_sdk_export.md) | sdk PABCD export | Slice C 즉시 착수 가능 |

## 세부 실행 문서 (260613 구체화)

- [130.2_plan_injection_compose.md](./130.2_plan_injection_compose.md) — 4스코프 합성 (3개 기구현 확인), M2 done 게이트, consolidation 비활성 분기 (098 130.1~130.3 매핑). §6 병렬 감사 결과 포함.
