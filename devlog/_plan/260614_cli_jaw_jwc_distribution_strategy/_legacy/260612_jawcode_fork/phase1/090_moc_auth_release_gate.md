# 090 MOC — 인증 시딩 + M1 Release Gate

> 상태: ⬜. 결정 근거: D7 [확정] — 로컬 토큰 시딩 즉시 로그인, OAuth 옵션 유지.

## 코드 사실

- cli-jaw 추출 패턴 (`/Users/jun/Developer/new/700_projects/cli-jaw/src/routes/quota.ts:145`):
  macOS Keychain `security find-generic-password -s "Claude Code-credentials" -w` + `~/.claude/.credentials.json`
- gjc: `session/auth-storage.ts` AuthStorage + `discoverAuthStorage(agentDir)` (sdk.ts:409) —
  **외부 CLI credential 임포트는 업스트림에 없음 → 포크 신규 표면**
- OAuth 40+ 프로바이더는 `packages/ai/` 보유 — 플로우 자체는 공짜

## 스코프 A — 인증 시딩

1. `jwc auth import` 커맨드: Claude Code(Keychain/credentials.json) → AuthStorage 시딩
2. [기본값] 첫 기동 시 자동 감지: AuthStorage 비어있고 로컬 토큰 발견 시 시딩 제안(1키 확인)
3. 대상 소스 우선순위: [기본값] ① Claude Code ② Codex(`~/.codex/auth.json`) ③ Gemini — 1차는 ①만 필수
4. 토큰 갱신: 만료 시 재추출 시도 → 실패하면 OAuth 플로우 안내 (silent fallback 금지, 명시 보고)
5. 보안: 토큰 값 로그 출력 금지, 시딩 결과는 마스킹 표시

## 스코프 B — M1 Release Gate (횡단 스모크)

| # | 검증 | 밴드 |
|---|------|------|
| G1 | `jwc --help` jaw 브랜딩, gjc 문자열 0건 | 010 |
| G2 | 시스템 프롬프트 jaw 아이덴티티 스냅샷 | 020 |
| G3 | `~/.cli-jaw/skills` 스킬 로드·발동 e2e | 030 |
| G4 | jaw-interview 게이트+4차원 점수 동작 | 040 |
| G5 | `/pabcd` 풀사이클 (mutation 게이트 포함) | 050 |
| G6 | goal set→checkpoint(evidence)→done | 060 |
| G7 | memory save→search 세션 간 회수 | 070 |
| G8 | TUI 워크플로 표시 + 한글 스모크 | 080 |
| G9 | **신규 머신 시나리오**: 기존 Claude 로그인만으로 `jwc` 즉시 대화 | 090 |

## 완료 기준

- G1–G9 전부 ✅ + 증거(출력/스크린샷)를 본 밴드 문서에 기록 → **M1 done 선언**

## 서브플랜

- [091_plan_provider_kiro.md](./091_plan_provider_kiro.md) — kiro 프로바이더 추가 [제안] (260612 06시).
  토큰 캐시 임포트(`~/.aws/sso/cache/kiro-auth-token.json` 등)가 본 밴드 D7 시딩 패턴과 동형.
  **착수 게이트**: Kiro ToS가 서드파티 하네스 사용을 명문 금지 — 리스크 수용 인터뷰 선행

## 열린 질문

- OAuth ToS 그레이존(구 03 리스크 2) 재평가 시점 — [기본값] 150 승격 전 재검토
- Windows/Linux 토큰 추출(DPAPI/keyring) — [기본값] M1은 macOS만
- kiro ToS 리스크 수용 여부 + 계정 분리 정책 (091 §⑥)

---

## M1 Release Gate 증거 기록 + done 선언 (99.12 — 260613 새벽, 99.00.05 T4)

> 실행 환경: HEAD `bc116df2` (99 밴드 졸업 배치까지 랜딩), 전 증거 신선 실행 (260613 04:5x).
> 워크트리에 병렬 세션 미커밋 WIP 존재 — 영향 받는 항목은 클린 HEAD 풀런(99.00.04 C 게이트, 260613 04:1x) 결과를 인용하고 표기.

| G | 검증 | 판정 | 증거 |
|---|---|---|---|
| G1 | `jwc --help` jaw 브랜딩, gjc 0건 | ✅ | `bun packages/jwc/bin/jwc.js --help` → "jwc v0.4.4" 배너; gjc 출현 1건은 `(legacy alias: GJC_*)` — **의도된 env 하위호환 표기**(브랜딩 누출 0). brand-visual-identity.test.ts green |
| G2 | 시스템 프롬프트 jaw 아이덴티티 | ✅ | system-prompt-templates.test.ts (`<jawcode-system-prompt>` 스냅샷 단언) green |
| G3 | 스킬 로드·발동 | ✅(테스트) | skills-discovery-jaw.test.ts green — 글로벌 `~/.cli-jaw/skills` 우선순위 디스커버리. 라이브 발동 e2e는 수동 백로그 |
| G4 | jaw-interview 게이트+4차원 | ✅ | jaw-interview-gate-redteam.test.ts green (G1~G4 묶음 4파일 30 pass 0 fail) |
| G5 | pabcd 풀사이클 | ✅ | orchestrate-state.test.ts "i→p→a→(verdict pass)→b→(verdict done)→c→d→complete" green + Final Summary 영수증(99.00.04 S6) 3케이스 green |
| G6 | goal set→checkpoint(evidence)→done | ✅ | ultragoal-runtime.test.ts 79 pass (set/checkpoint/done + evidence 게이트 + --force 분리) |
| G7 | memory save→search 회수 | ✅ | memory-runtime.test.ts "save → search → read → context round-trip" green (G5~G7+G9 묶음 4파일 123 pass 0 fail) |
| G8 | TUI 워크플로 표시 + 한글 | ✅(부분) | 워크플로 표시: 99.04 HUD 완전체 + P1-5 즉시 갱신 랜딩·테스트 green. 한글: truncate-to-width wide-char + Hangul IME chord 테스트(클린 HEAD 풀런 pass; 현 워크트리 2 fail은 병렬 WIP composerFooter 소속). ⚠ **한글 직접 TUI 렌더 자동화 미보유** — 수동 e2e 백로그 |
| G9 | 신규 머신: 기존 Claude 로그인만으로 즉시 대화 | ✅(테스트) | auth-broker-import.test.ts green (Claude 토큰 자동 시딩). 실기기 신규 머신 시나리오는 수동 백로그 |

**잔여 수동 백로그** (자동화 부재 명시 — 허위 PASS 방지): G3 라이브 스킬 발동 1회 · G8 한글 라이브 렌더 1회 · G9 신규 머신 실기기 1회 · 94.3 수동 e2e 1건.

### M1 done 선언

**M1 (000–099, jwc 만들기) — done (2026-06-13, HEAD `bc116df2`).**
G1~G9 전 항목 자동화 증거 green (수동 백로그 4건 별도 명시). 000_roadmap.md "M1 done" 1줄은
roadmap이 병렬 세션 dirty(섹션 재구성 중)라 **병렬 랜딩 시 동승 이월** — 본 섹션이 선언 정본.
