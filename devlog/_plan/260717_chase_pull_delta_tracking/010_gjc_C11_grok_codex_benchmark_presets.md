# 010_gjc_C11_grok_codex_benchmark_presets

> Range: `4a80bac9..3ddf26079` (subset)
> Cluster: C11 — Grok 4.5/Codex benchmark/presets
> Sol priority: P1
> Model-related: yes
> Card target: 10.092_grok_codex_benchmark_presets
> Worker: GW3

## 커밋 전수 테이블

| # | hash | summary | JWC impact area |
|---|---|---|---|
| 1 | `289134891` | fix(ci): format model profile tests (#2193) | model profile activation/catalog 테스트 |
| 2 | `851f71a97` | fix(ci): format model profile tests (#2193) | model profile activation/catalog 테스트 원본 |
| 3 | `684a26694` | feat(grok-build): add documented Grok 4.5 support (#2075) | Grok vendor catalog, payload sanitize, provider 등록 |
| 4 | `2f213136c` | feat(coordinator-mcp): authoritative model profile selection via mpreset (#2003) (#2073) | coordinator MCP model preset 선택 |
| 5 | `cc661b43a` | feat(coding-agent): benchmark GPT-5.6 Codex presets (#2022) | model profiles, benchmark 문서·검증 패키지 |

## 주제 분석

이 클러스터는 모델 이름을 추가하는 작업보다 실행 프로필의 권위를 고정하는 작업이다. Grok 4.5 지원은 vendor catalog, reasoning effort clamp, alias, payload sanitize를 함께 맞춘다. GPT-5.6 Codex preset은 benchmark evidence를 바탕으로 default와 역할별 모델·effort를 정한다.

coordinator의 `mpreset`은 세션 시작 전 merged profile registry에서 이름을 해석한다. 잘못된 프로필은 spawn 전에 거부하고, 선택한 프로필을 세션 상태에 남기며, 기존 세션 재사용 시 충돌을 fail-closed로 처리한다. 따라서 CLI에서 보이는 preset과 coordinator가 실제 실행한 모델 프로필이 어긋나지 않는다.

## Worktree 대조

현재 JWC worktree에는 `packages/ai/src/models.json`의 Grok 4.5 항목과 GPT-5.6 Sol/Terra/Luna descriptor가 존재한다. `packages/coding-agent/src/config/model-profiles.ts`의 `codex-standard`와 고성능 profile도 GPT-5.6 tier를 사용한다. CLI `--mpreset`과 durable default profile 활성화 문서·코드도 이미 있다.

그러나 `packages/coding-agent/src/coordinator-mcp/server.ts`의 start-session 입력에는 `mpreset` 전달·충돌 계약이 확인되지 않았다. upstream의 `docs/gpt-5.6-codex-preset-benchmark.md`에 대응하는 근거 문서와 benchmark 검증 패키지도 JWC에는 보이지 않는다. 정적 catalog/profile은 선행 또는 부분 동등이지만 coordinator 권위와 benchmark receipt는 남은 차이이다.
