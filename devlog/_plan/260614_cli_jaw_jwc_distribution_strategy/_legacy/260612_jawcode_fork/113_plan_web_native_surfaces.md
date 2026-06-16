# 113 — plan: 웹 네이티브 표면 (모델·설정·quota를 cli-jaw web UI에 jwc 엔진 단일 소스로)

> 상태: 🟡 시드 v1 (260613 새벽 인터뷰) — 핵심 결정 4건 확정, 2건 기본값. 착수는 M2 110/111(상주 부착) 이후.
> **260613 플립 기준 재구체화 (gjc→jwc flip 반영)** — 본 문서는 플립 후 작성이라 어휘 정합.
> 앵커 재검증: `resolveModelCommandSelection`(builtin-registry.ts:171, 비-TUI 경로) ·
> `flushPendingModelSwitch`(modes/types.ts:168) · settings-schema ui 메타 — 전부 실존 확인.
> 플립 교차: `/api/jwc/*` 라우트 명명은 ACP `_jwc/`(canonical)·`_gjc/`(legacy 별칭) 정합 —
> 웹 어댑터는 `_jwc` 세대만 보면 됨.
> 소속: M2 100~ 밴드. 자매: [112](./112_moc_gui.md)(셸/모드 — jaw·Code 2-트랙), [130](./130_moc_injection.md)(주입).
> 입력: 사용자 "model 변경 같은 복잡한 로직을 cli-jaw web UI 안에 네이티브로 어떻게 통합할지 —
> 팝업(이미 구현된 UI)이 좋아 보인다" + "동시 편집은 모달이라 불가능, 진짜 문제는 SSE 프런트 연동" (260613).

112가 "어디에 그리느냐"(jaw 모드=웹뷰, Code 모드=네이티브 React)라면, 113은 **"복잡한 상호작용
표면(모델 변경·설정·quota·effort)을 무엇이 소유하고 어떻게 동기화하느냐"**다. 원칙은 하나:
**복잡한 건 UI가 아니라 선택 의미론이고, 의미론은 이미 jwc 엔진에 있다** — 웹은 뷰만 재사용한다.

## 확정 결정 (260613 인터뷰)

1. **[확정] 팝업 재사용 + 엔진 단일 소스**: cli-jaw 웹의 기존 팝업 뷰를 유지하고, 데이터·의미론은
   jwc 엔진 API(modelRegistry·resolveModelCommandSelection — ACP용 비-TUI 경로 기존재)가 단일 소스.
   TUI 셀렉터 포팅·웹 재구현 기각.
2. **[확정] 설정 패널 = settings-schema 자동 생성**: `ui:{tab,label,description,options}` 메타를
   웹 패널이 그대로 소비 — 설정 추가 시 TUI/웹 동시 반영, 이중 구현 0. (`default: undefined` =
   "default" 표기 규칙 포함 — 99.20.04 핫픽스에서 확립.)
3. **[확정] REST 어댑터 `/api/jwc/*`**: cli-jaw 서버에 jwc 어댑터 라우트 — 웹이 이미 REST+SSE.
   ACP 패스스루 기각(웹이 ACP 클라이언트가 되는 비용). 공통 패턴: 모델·설정·quota·effort.
4. **[확정] 동기화 = 스냅샷 + 무효화 신호** (사용자 진단 "진짜 문제는 SSE 프런트 연동"의 해법):
   - 충돌은 **UI 모달 상호배제**가 구조적으로 차단 (팝업이 떠 있으면 반대편 조작 불가) —
     엔진 레벨 last-write는 백스톱일 뿐.
   - SSE로는 **무효화 신호만**: `{session, domain: "model"|"settings"|"quota"|"pabcd", rev}`.
     프런트는 신호 수신 → 해당 도메인 스냅샷 REST 재조회 → rev 단조 비교 후 렌더. **프런트 머지
     로직 0** — 재조회는 멱등이라 순서·중복·유실 무해. 재연결 시 rev 비교 풀 스냅샷 1회.
   - TUI는 같은 엔진 이벤트를 in-process 구독(상태줄 invalidate 기존 패턴) — 양면은 "연동"이
     아니라 **같은 소스의 두 뷰**라 구성상 수렴.

## 기본값 (이견 없음 — 착수 시 재확인)

5. [기본값] **모델 팝업 2탭**: `Boss 탭`(jwc 카탈로그 — 프로바이더 그룹 CLAUDE/CODEX/LOCAL +
   role + thinking, 084 데이터의 웹 표현) / `Workers 탭`(직원 디스패치용 CLI/모델 — cli-jaw 기존
   로직). M2에서 boss 대화 = jwc in-process이므로 boss 모델 변경 = jwc 세션 모델 변경; 직원은
   여전히 멀티-CLI — 2축을 탭으로 분리.
6. [기본값] **턴 중 변경 = 펜딩 의미론 노출**: jwc `setModel`은 턴 경계 적용(`flushPendingModelSwitch`
   기존재) — 웹은 "다음 턴부터 적용" 배지 1개.

## API 스케치

| 표면 | GET (스냅샷) | POST (변경) | SSE domain |
|------|-------------|-------------|-----------|
| 모델 | `/api/jwc/models` (카탈로그+그룹), `/api/jwc/sessions/:id/model` | `/api/jwc/sessions/:id/model {selector, role?, thinking?}` | model |
| 설정 | `/api/jwc/settings/schema` (ui 메타 포함) + `/values` | `/api/jwc/settings {path, value}` | settings |
| quota | `/api/jwc/quota` | — | quota |
| effort/tier | 세션 스냅샷에 포함 | `/api/jwc/sessions/:id/{effort,tier}` | model |

스코프 매핑(D112-1/2 정합): jaw 모드 팝업 = 인스턴스/boss 레벨(영속 — `serviceTier`·기본 모델 설정),
Code 모드 팝업 = 그 세션 한정(일회용). 영속은 인스턴스, 세션은 휘발 — D112-2 원칙 그대로.

## 선행 의존

- 110/111 in-process 부착 (이벤트 구독·세션 핸들) — 113은 그 위의 표면층.
- 112 Code 모드의 네이티브 모델 팝업도 같은 REST/스냅샷을 소비 (뷰만 다름).

## 열린 질문 (착수 시)

1. Workers 탭과 cli-jaw 기존 `/model` 팝업의 통합 순서 — 기존 팝업에 Boss 탭을 "추가"가 최소 경로.
2. rev 발급 단위 — 세션별 단조 카운터 vs 엔진 글로벌 (기본값 제안: 세션별).
3. 설정 쓰기의 브랜드/인스턴스 경계 — 웹에서 바꾼 설정이 TUI 세션에 즉시 반영되는 항목과
   재시작 필요 항목의 구분 표시 (settings-schema에 `requiresRestart` 메타 후보).

## 세부 실행 문서 (260613 구체화)

- [113.2_contract_stream_idempotency.md](./113.2_contract_stream_idempotency.md) — cli-jaw 260613 실증 패턴 5종 계약 조항 (113.1 증보, 트랙 C 산출물)
