# 010_gjc_C08_telegram_notification_v2

> Range: `4a80bac9..3ddf26079` (subset)
> Cluster: C08 — Telegram notification v2
> Sol priority: P2
> Model-related: no
> Card target: 10.098_telegram_notification_v2
> Worker: GW5

## 커밋 전수 테이블

| # | hash | summary | JWC impact area |
|---|---|---|---|
| 1 | `2bbcd6a46` | fix(telegram): harden directed replay and reasoning provenance | Telegram directed replay, SDK/native frame provenance |
| 2 | `d2ee76f83` | feat(telegram): implement /verbose /lean tool-activity + reasoning-summary contract (#2304) | notification protocol, agent events, Telegram 렌더링 |
| 3 | `f1683b9f2` | ci(dev): remove Windows notification atomicity gate | notification CI 계약 |
| 4 | `2810868f3` | fix(notifications): telegram poll-health log hygiene + malformed-update safety (#2297) | Telegram polling과 malformed update 처리 |
| 5 | `5a4ee337d` | feat(coding-agent): repair #2050 notification settings on current dev (#2088) | 설정 스키마, notification 런타임, TUI, 문서 |
| 6 | `62e4ae965` | fix(coding-agent): harden Telegram command UX (#2105) | Telegram 명령 파싱과 사용자 피드백 |
| 7 | `340338f3a` | test: make Telegram daemon pid rewrite deterministic (#2269) | Telegram daemon PID 테스트 |
| 8 | `3784dc5cd` | fix(notifications): harden Telegram lifecycle routing (#2258) | SDK/native notification 수명주기 라우팅 |
| 9 | `c6e53baac` | fix(ci): make notification replay durable | notification replay 저장과 테스트 |
| 10 | `d7355a04d` | fix(ci): synchronize notification replay state | replay 상태 동기화 테스트 |
| 11 | `fb98dd12b` | fix(ci): preserve notification startup identity | notification 시작 식별자와 CI 범위 |
| 12 | `e49113408` | fix(gjc-notifications): gate Telegram ask controls per-client by capability (#2029) (#2076) | Telegram ask capability, Rust/native protocol |
| 13 | `e3c311847` | feat(notifications): configurable Telegram topic name template (#1909) (#2051) | topic 템플릿 설정과 스키마 |
| 14 | `dea702687` | feat(coding-agent): shared notification service for CLI and /notify (#2050) (#2058) | 공용 notification service와 테스트 |
| 15 | `2be1fe33d` | feat(coding-agent): suppress child notifications under primary session scope (#2056) | 하위 세션 notification 억제 |
| 16 | `be3dedd46` | feat(coding-agent): add beginner-safe daemon operational shortcuts (#2057) | daemon 운영 명령 UX |
| 17 | `4ba30dd10` | fix(notifications): reload a stale-generation Telegram daemon instead of attaching (#2028) | daemon generation/attach 수명주기 |
| 18 | `f194900ec` | fix(coding-agent): acknowledge Telegram ask selections (#1999) | Telegram ask 선택 확인 응답 |

## 주제 분석

이 클러스터는 Telegram 알림을 단순 완료 메시지에서 원격 작업 관찰 표면으로 확장한다. `/verbose`와 `/lean`이 tool activity와 reasoning summary의 노출량을 바꾸며, directed replay에는 원본 이벤트와 변환 경로를 추적할 provenance가 붙는다. raw reasoning을 그대로 내보내지 않고 요약 계약을 통과시킨다는 점이 핵심이다.

운영 측면에서는 per-client capability가 없는 클라이언트에 ask control을 보내지 않는다. topic 이름을 설정으로 관리하고 CLI와 `/notify`가 하나의 notification service를 사용한다. 하위 세션 알림 억제, stale daemon 재시작, polling health와 malformed update 처리까지 합쳐 중복·오염·무응답을 줄인다.

## Worktree 대조

현재 JWC는 `packages/coding-agent/src/notifications/` 아래에 daemon, lifecycle, Telegram inbound, ask keyboard, redaction, rich turn delivery를 분리해 둔다. `config-command-parser.ts`와 테스트에는 `/verbose`, `/lean` 매핑이 이미 있고, `session-lifecycle.ts`는 `taskDepth !== 0`인 하위 세션을 억제한다. 기존 10.074 계열 chase 작업으로 rich rendering과 live/final delivery 기반도 상당 부분 갖춘 상태이다.

반면 이 범위의 tool-activity/reasoning-summary 종단 계약, directed replay provenance, per-client ask capability, poll-health 분류를 하나의 SSOT로 증명하는 대응은 집중 검색만으로 완결되지 않았다. topic lifecycle과 stale daemon 처리도 JWC의 분할 모듈에 맞춘 직접 대조가 필요하다. 현재 평가는 기능 기반은 강하지만 새 GJC 계약별 증거가 남은 부분 대응이다.
