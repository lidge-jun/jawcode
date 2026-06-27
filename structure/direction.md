# Jawcode Direction

> **Snapshot (2026-06-28, `jawcode@1.0.2` / public `jawcode@1.0.9`, HEAD `af363c8`):** Standalone Bun-native coding-agent harness with public `jwc` CLI, `.jwc/` state, IPABCD/PABCD orchestration, durable goals, and tmux-backed `team` workers. Active engineering is **GJC chase execution** (`struct_har/chase/10_*`) plus cli-jaw embedding (bands 160–310). See [00_INDEX.md](./00_INDEX.md) and [08-git-commit-history.md](./08-git-commit-history.md).

## 한 문장 결론

Jawcode는 `gajae-code` 계열을 **독립 OSS repo**로 재포장한 coding-agent 런타임이며, 계획·감사·검증이 기본값인 IPABCD 워크플로와 증거 기반 goal ledger를 제공한다. 공개 표면은 `jwc` / `.jwc`이고, 내부 패키지는 `@jawcode-dev/*`를 유지한다. upstream attribution은 보존하되 제품 브랜드는 Jawcode로 통일한다.

> 출처: [Yeachan-Heo/gajae-code](https://github.com/Yeachan-Heo/gajae-code)
> 출처: [lidge-jun/jawcode](https://github.com/lidge-jun/jawcode)

## 제품 정체성

Jawcode는 Codex CLI·Claude Code·OpenCode 옆에서 돌리는 **구조화된 코딩 에이전트 하네스**다. 숨겨진 플러그인이 아니라 별도 프로세스로 repo/worktree에서 실행되며, 다음을 기본 제공한다.

```text
46 providers · 3,600+ models · IPABCD workflow · 40+ tools · 5 role agents
Plans before build · Audits before ship · Verifies before done
```

핵심 차별점:

- **IPABCD / PABCD** — Interview → Plan → Audit → Build → Check → Done 게이트 (`jwc orchestrate`, `plan` skill)
- **Goal ledger** — 장기 목표 + 증거 체크포인트 (`jwc goal`)
- **Team** — tmux 병렬 워커 (`team` skill, `.jwc/state/team/`)
- **Tri-axis docs** — `structure/` (현재 계약) · `struct_har/` (gjc↔jwc 대조) · `struct_har/chase/` (갭 추적)

## 라이선스와 attribution

- Public repo: **MIT** ([LICENSE](../LICENSE))
- Upstream: `gajae-code` / GJC lineage — NOTICE·소스 주석에 보존
- Public commands·경로·예제: **`jwc`**, **`.jwc/`** 만 사용 (legacy `gjc` bin은 compat 패키지에 격리)

## 우선순위 (2026-06-28)

| 순위 | 축 | 이유 |
|---|---|---|
| 1 | **GJC chase 10.x** | upstream 기능·버그픽스를 카드 단위로 이식·검증 (`struct_har/chase/`) |
| 2 | **99 밴드 안정화** | MLB 62 달성 — memory CLI·orchestrate discovery 완료; HUD·슬래시 패리티 잔여 |
| 3 | **cli-jaw 통합 (160–310)** | embedded Jawcode bundle, UI selector, ACP e2e — [roadmap.md](./roadmap.md) |
| 4 | **문서 정본** | `structure/` + chase MOC + 본 direction/roadmap/git-history 동기화 |

## 비목표

- `gajae-code` 전체 1:1 미러 (선택적 chase만)
- GitHub fork UI 브랜딩
- Hidden MCP surface in public README (G002 gate)

## 관련 정본

| 문서 | 역할 |
|---|---|
| [roadmap.md](./roadmap.md) | Phase별 완료 기준 |
| [50_status.md](./50_status.md) | Readiness · 99 밴드 |
| [40_fork-delta.md](./40_fork-delta.md) | 체리픽·이탈 파일 인덱스 |
| [AGENTS.md](../AGENTS.md) | 에이전트 운영 계약 |
