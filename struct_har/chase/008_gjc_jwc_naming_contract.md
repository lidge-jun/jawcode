# chase — GJC ↔ JWC 명명 계약 (포팅 시 필수)

> **목적**: upstream `devlog/_gjc_chase/gajae-code`를 읽을 때와 jwc에 이식할 때 **같은 기능, 다른 이름**을 헷갈리지 않게 한다.
> chase 카드·executor·PABCD 산출물은 **jwc 정본 이름**을 쓴다. upstream 인용만 `gjc`/`gjc-rpc` 유지.

## 축 요약

| 영역 | upstream (gjc) | jawcode (jwc) | 비고 |
|------|----------------|---------------|------|
| CLI bin | `gjc` | **`jwc`** | `packages/jwc` only public bin |
| 런타임 config/state | `.gjc/` (전환 중) | **`.jwc/`** | agent dir, workflow-gates, harness state |
| Python RPC 클라이언트 | `python/gjc-rpc` · `gjc_rpc` · `from gjc_rpc import …` | **`python/jwc-rpc`** · **`jwc_rpc`** · `from jwc_rpc import …` | ✅ **jawcode worktree에 존재** |
| RPC 실행 | `gjc --mode rpc` | **`jwc --mode rpc`** | `RpcClient(executable="jwc")` |
| 내부 harness env (D4) | `GJC_*` (예: `GJC_RECEIPT_SPOOL_DIR`, `GJC_TMUX_LAUNCHED`) | **선별 유지 + dual-read** | rebrand-inventory; 사용자 문서는 `JWC_*` 우선 |
| upstream 이슈 문서 | `issues/06-gjcrpc-…` | 매트릭스 시 **`jwc_rpc`** 열로 번역 | 이슈 **번호**는 동일 |

## Python `jwc-rpc` (jawcode 정본)

- 경로: `python/jwc-rpc/`
- 패키지: `jwc-rpc` (pyproject `name = "jwc-rpc"`)
- import: `jwc_rpc` (`python/jwc-rpc/src/jwc_rpc/`)
- Docker: `COPY python/jwc-rpc`, wheel `jwc_rpc-*.whl`
- upstream `devlog/_gjc_chase/gajae-code/python/gjc-rpc`는 **diff 참조만** — 파일을 `gjc-rpc` 이름으로 복사하지 않음.

## chase / executor 규칙

1. **갭 설명·완료 기준·테스트 경로** → `jwc`, `jwc-rpc`, `jwc_rpc`, `.jwc`.
2. **upstream fact 인용** (CHANGELOG, commit, `devlog/_gjc_chase/gajae-code/...`) → `gjc`, `gjc-rpc` 그대로 가능.
3. **10.026 issues 06–08** → 제목은 upstream `gjcrpc`이어도 jwc 매트릭스 열은 **`python/jwc-rpc`** 기준으로 재평가.
4. **10.018** registry/list_sessions → TS는 `session-registry.ts`; Python은 **`jwc_rpc`에 `list_sessions()`** (upstream gjc_rpc 패리티).

## 자주 틀리는 것

| ❌ | ✅ |
|----|-----|
| “repo에 gjc-rpc 없음” | `python/jwc-rpc` 있음 — **list_sessions 등 API 갭**은 별도 |
| `from gjc_rpc import RpcClient` in jwc docs | `from jwc_rpc import RpcClient` |
| harness default `.gjc` when porting | default **`.jwc`** (`storage.ts` 등) |
| `gjc harness` in jwc chase | **`jwc harness`** |

## 링크

- [003_reference_from_gjc](./003_reference_from_gjc.md) · [004_reference_from_omp](./004_reference_from_omp.md)
- [007_follow_index](./007_follow_index.md)
- [structure/11_conventions.md](../../structure/11_conventions.md) (D4 public surface)
