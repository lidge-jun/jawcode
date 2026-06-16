# 260612 — Jawcode 포크 부트스트랩

> gajae-code(gjc)를 포크해 cli-jaw의 메인 네이티브 런타임 "jawcode"를 만든다.
> 목표: cli-jaw 전역 스킬 + PABCD 공유, TUI 지원, spawn/resume 로직 없는 in-process 통합.

> ⚠️ **2026-06-12 02:57 체계 개편**: 마스터 로드맵은 [000_roadmap.md](./000_roadmap.md)로 이동.
> 새 넘버링 — **000–099 = jwc 만들기(M1) / 100~ = cli-jaw 런타임 이식(M2)**. 아래 2자리 문서는 리서치 입력으로 흡수됨.

## 문서 인덱스

| # | 문서 | 내용 | 상태 |
|---|------|------|------|
| 000 | [000_roadmap.md](./000_roadmap.md) | **마스터 로드맵 (정본)** | ✅ |
| 00 | 이 파일 | (구) 인덱스 + 목표 | 흡수됨 |
| 01 | [01_research_gajae_code.md](./01_research_gajae_code.md) | gajae-code가 제공하는 것 (포크 직후 실사) | ✅ |
| 02 | [02_research_cli_jaw_seams.md](./02_research_cli_jaw_seams.md) | cli-jaw 통합 시임 분석 | ✅ |
| 03 | [03_roadmap_phases.md](./03_roadmap_phases.md) | 단계 로드맵 + 미해결 결정 | ✅ |
| 04 | [04_interview_log.md](./04_interview_log.md) | 인터뷰 라운드별 기록 (R1–R5) | ✅ 종료 |
| 05 | [05_interview_conclusions.md](./05_interview_conclusions.md) | 확정 결정 D1–D9 + M1/M2 구조 | ✅ |
| 10 | [10_phase1_jwc_shell.md](./10_phase1_jwc_shell.md) | Phase 1: jwc 셸 (packages/jwc) | ✅ 구현 완료 |
| 20+ | (미작성) | M1 디테일 플랜 (리네이밍/Interview 병합/Plan 병합/메모리/PABCD 커맨드) — 05 기준 | ⬜ |

> **2026-06-12 02:53 인터뷰 종료 — 우선순위 개정**: M1(jwc 단독 완성, jaw 워크플로우 이식)이
> Node 포팅·cli-jaw 임베딩(M2)보다 선행한다. 기존 03 로드맵의 Phase 2~6은 M2 영역으로 이동. 상세: 05.

## 한 줄 결론

가능하다. 에이전트 런타임의 어려운 절반(프로바이더/인증/스트리밍/루프/TUI/스킬)은
gjc가 전부 갖고 있고, `sdk.ts createAgentSession()`이 공식 임베딩 통로다.
남은 것은 (1) Bun↔Node 호스팅 결정, (2) cli-jaw 어댑터, (3) 스킬/PABCD 브리지, (4) 세션 단일화.

## 완료 기준 (이 플랜 단위)

- [x] gajae-code 클론 + remote `upstream` 설정
- [x] Jawdev source-of-truth 스캐폴딩 (`structure/`, `devlog/`)
- [x] 리서치 문서 01–03
- [x] 호스팅 방식 확정: 상주 네이티브(Node 포팅 본선), 사이드카 기각 — 03 §결정 1
- [x] Phase 1 구현: `packages/jwc` — `bun packages/jwc/bin/jwc.js --version` → `gjc/0.4.4`,
      `jwc/sdk`에서 `createAgentSession`/`discoverSkills`/`buildSystemPrompt` import 확인
      (선행: `bun install` + `bun run build:native` 필요 — natives Rust 빌드 1m 10s)
- [ ] Phase 2 diff 플랜(20_*) 작성 — 조사 결과: `check:node20-baseline`은 Node 지원
      보장이 아니라 "Node 20 지원" 허위 주장을 막는 가드 → 업스트림은 명시적 Bun 전용.
      모든 패키지가 raw .ts 배포(빌드 산출물 없음)이므로 Phase 2는
      ① `Bun.*` 셰임 ② tsc/esbuild 트랜스파일 빌드 단계 **둘 다** 필요
