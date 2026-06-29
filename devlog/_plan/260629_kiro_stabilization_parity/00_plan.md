# 00 — Plan: Kiro full stabilization parity (opencodex as SoT)

> 상태: [P] 작성 → [A] 감사 → [B] 구현 → [C] 검증 → [D] 완료
> Goal: opencodex Kiro 어댑터(`src/adapters/kiro-*.ts`) + devlog를 SoT로,
>        jawcode `packages/ai/src/providers/kiro*.ts` 를 완전 안정화.
> Class: C3 (provider 공유 동작 / CodeWhisperer 와이어 계약 + 스트림/HTTP 안정화).

## Part 1 — 쉬운 설명

opencodex `dev` 브랜치의 Kiro 어댑터는 31개 커밋에 걸쳐 하드닝됐다(HTTP 리트라이/
타임아웃, 업스트림 에러 매핑/리댁션, 트렁케이션 fail-closed, tool schema sanitize/
flatten, 네이티브 이미지, thinking parseback, usage 추정, OAuth 하드닝, exception
frame terminal 처리, Codex web_search 경로의 parseResponse 등). jawcode는 이전
두 단계(`260628_kiro_parity_hardening/30,40`)에서 상당 부분을 포팅했지만, 아직
남은 gap 때문에 긴/병렬 세션에서 업스트림 에러가 산발적으로 보인다.

이 작업은 opencodex 를 SoT 로 삼아 남은 Kiro 안정화 로직을 전부 jawcode 관용구로
포팅/적용하고, Codex 특유의 MCP-call 경로를 따라가며, 각 단계를 PABCD 로 검증
(서브에이전트가 audit/check 담당)하고 devlog 로 문서화한 뒤 단계별로 커밋한다.

## Part 2 — Gap 인벤토리 (opencodex SoT 대비)

감사 근거: `git -C opencodex log -- src/adapters/kiro*` (31 커밋) + jawcode
`packages/ai/src/providers/kiro.ts` (1179줄) 코드 정밀 비교.

| # | opencodex 근거 | jawcode 현재 | gap |
| - | - | - | - |
| B1 | `shouldInjectKiroThinkingTags` (b496629) | `!toolResults` 면 무조건 주입 | tool 모드/continue 가드 없음 |
| B2 | 추정 usage + `contextUsagePercentage→totalTokens` (0b26c89,23bd889,e50ca23,45272b2,7374c3a) | usage 전부 0, 이벤트 무시 | 추정 usage 없음 |
| B3 | `kiro-truncation.ts` fail-closed (c3b10c9,a038784) | 미완 tool JSON 을 `{_raw}` 로 fail-open | 트렁케이션 감지/표면화 없음 |
| B4 | provider connect/stream timeout 100s (b62a145) | per-attempt 스트림 타임아웃 없음 | 타임아웃 가드 없음 |
| B5 | `kiro-credentials` 입력 확장 + 안전 source 기록 (4c97e0d,68b079f,931847b) | oauth 143줄, leaner | 자격증명 입력/리댁션 하드닝 부족 |
| B6 | Codex web_search → `parseResponse` (dd1d924), namespaced MCP 풀 와이어네임 | jawcode 아키텍처 상이 | Codex MCP-call 경로 parity 확인/적용 |
| B7 | (jawcode 자체) `aws-eventstream.ts` bounds 하드닝 + phase5 devlog 미커밋 | working tree dangling | 커밋 안 됨 |

## Part 3 — 진행 절차 (PABCD / 단계별 커밋)

각 B 단계는 다음 루프를 돈다:
1. (P/A) 해당 opencodex 커밋/devlog 정독 → jawcode idiom 매핑 확정.
2. (B) 구현 + 회귀 테스트 추가.
3. (C) `bun test <대상>` + `bun run check:types` (packages/ai) 통과.
   서브에이전트(architect/critic 역)가 독립 감사.
4. (D) 단계 devlog 기록 + 커밋.

전 단계 종료 후 전체 `packages/ai` 스위트 + 최종 gap-audit devlog 로 마감.

## 검증 게이트
- 단계별: `bun test packages/ai/src/providers/kiro*.test.ts` 그린.
- 타입: `bun run check:types` (packages/ai) 에러 0.
- 포맷: biome.
- 라이브 스모크(`tool use 10개`, 긴 세션)는 사용자 몫.

## 비-목표
- jawcode fail-open finalize 정책은 B3 에서 fail-closed 감지를 **추가**하되,
  트렁케이션 신호가 있을 때만 에러로 전환(기존 `{_raw}` 경로 무단 제거 금지).
- transformMessages 공유 유틸 재배선 등 대형 리팩터는 별건.
