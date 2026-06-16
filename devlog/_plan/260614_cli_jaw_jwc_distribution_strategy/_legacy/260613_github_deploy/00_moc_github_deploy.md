# 00 — MOC: GitHub 배포 준비

> 상태: 🟡 플래닝 완료 / 미착수. structure 갱신 + README + GitHub Pages + CI + postinstall.
> 블로커를 000-099에서 해결하고, 발견된 구조적 취약점은 100+에 기록한다.

## 번호 체계

### 000-099: 실제 작업 (실행 → 커밋 → 완료)

| 범위 | 용도 | 예약 |
|---|---|---|
| **001-009** | CI 블로커 해소 | biome, tsc, test, zod, lockfile |
| **010-019** | structure/ 갱신 | 기존 10개 정본 문서 보강 |
| **020-029** | README 폴리시 | architecture, contributing, badges, i18n |
| **030-039** | GitHub Pages + Developer Docs | VitePress, workflow guide, API ref |
| **040-049** | CI 파이프라인 (GitHub Actions) | darwin jobs, cache, gate, test scope |
| **050-059** | (예약) | 도구 토큰 최적화 / discoveryMode |
| **060-069** | postinstall / --safeinstall | platform detect, tmux, cua-driver, cu-mcp build |
| **070-077** | postinstall 확장 | skills setup, mcp/settings 템플릿, natives 검증, first-run hint, bun 체크, jwc setup defaults |
| **078-079** | (예약) | 릴리스 자동화 / changelog |
| **080-089** | (예약) | 테스트 인프라 보강 |
| **090-099** | (예약) | 최종 배포 체크리스트 |

### 100+: 발견 기록 (기록 → 분류 → 별도 스프린트)

작업(000-099) 중 드러난 **구조적 취약점·기술 부채·dev 스킬 위반·설계 결함**을 기록.
"해결"이 아니라 "기록" — 부딪힌 문제를 전부 적어놓고, 심각도별로 별도 세션/스프린트에서 처리.

| 범위 | 분류 |
|---|---|
| **100-119** | 토큰·성능·리소스 | 
| **120-139** | 타입 안전성·빌드·의존성 |
| **140-159** | 코드 품질·dev 스킬 위반 |
| **160-179** | 보안·안정성·외부 SPI |
| **180-199** | DX·온보딩·설정 |

## 실행 순서

```
001-009 (CI 블로커) → 040-049 (CI 파이프라인) → 060-069 (postinstall)
                   → 010-014 (structure) → 020-024 (README) → 030-037 (Pages)
```

블로커 5건이 **CI를 완전 차단**하므로 최우선. CI가 green이면 나머지 병렬.

## 문서

| # | 문서 | 내용 |
|---|---|---|
| 00 | 본 MOC | 번호 체계·범위·순서 |
| [10](./10_tasks_structure_readme_pages.md) | 010-037 | structure·README·Pages 작업 |
| [20](./20_tasks_ci_postinstall.md) | 040-069 | CI·postinstall 작업 |
| [30](./30_blockers.md) | 001-009 | CI 블로커 5건 해소 작업 |
| [40](./40_findings.md) | 100+ | 발견 기록 (구조 취약점·기술 부채·dev 스킬 위반) |
| bridge | [260614 deploy/fork/packaging bridge](../260614_deploy_fork_packaging_bridge/README.md) | GitHub deploy · jawcode fork promotion · packaging 교차 블로커 분석 |

## CI 블로커 요약 (001-009)

| # | 블로커 | 복잡도 | CI 차단 |
|---|---|---|---|
| 001 | dirty bun.lock + uncommitted files | S | frozen-lockfile |
| 002 | Biome 66 lint/format 에러 | S (auto-fix) | lint check |
| 003 | 2209 TS6305 stale .d.ts | S (build 선행) | tsc check |
| 004 | cu-mcp-server zod 3 vs catalog zod 4 | M | latent build risk |
| 005 | 27 failing tests / 8591 | M-L (mock fixture 갱신) | test check |

## discoveryMode (도구 토큰 최적화)

jwc 35개 빌트인 도구 = ~30K 토큰 (Claude Code는 ~12K). `tools.discoveryMode = "all"` 켜면
read/bash/edit/write만 로드(~8K), 나머지는 search_tool_bm25 뒤에 deferred. 별도 태스크.
