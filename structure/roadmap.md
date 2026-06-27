# Jawcode Roadmap

> **Snapshot (2026-06-28, HEAD `af363c8`):** Bands **000–099** stabilization largely complete for daily use (MLB 62). **100–150** Node port + package distribution ✅. **160–310** cli-jaw merge active in devlog. **GJC chase** (`struct_har/chase/10_*`, `20_*`) is the primary implementation backlog. Historical order below; active cards live in chase MOCs.

## 목적

[direction.md](direction.md)의 방향을 **구현 순서·완료 기준**으로 고정한다. 완료된 단계는 ✅로 표시하고, 진행 중 chase는 `struct_har/chase/`를 정본으로 한다.

---

## Phase 0. Documentation Baseline ✅

| Item | Status |
|---|---|
| `structure/` 10-doc hub | ✅ 2026-06-26 consolidate |
| `struct_har/` three-axis | ✅ gjc_origin · jwc_patched · omp_origin |
| `struct_har/chase/` gap tracking | ✅ 10.x / 20.x MOC |
| `direction.md` + `roadmap.md` + git history | ✅ 2026-06-28 docs sync |

---

## Phase 1. Public Identity & OSS Launch ✅ (2026-06-16)

- Repo public · MIT · `jawcode@1.0.0`
- Bun-primary install, npm alternative
- CI/CD baseline, mac-native probes
- IPABCD branding in README

**완료 기준:** `5892f59` initial tree · npm publish path green

---

## Phase 2. JWC Surface Lock ✅ (2026-06-12 – 2026-06-14)

- Public `jwc` CLI · `.jwc/` state dir
- Workflow skills: `jaw-interview`, `plan`, `goal`, `team`
- G002 rebrand gates · legacy name inventory
- System prompt + orchestrate native IPABCD discovery (99.03)

**완료 기준:** `verify-g002-gates.ts` · public docs use `jwc` only

---

## Phase 3. Stabilization 99 Band ✅ (runtime) / ⬜ (HUD·slash)

| ID | Item | Status |
|---|---|---|
| 99.01 | `jwc memory *` + `jwc chat search` | ✅ |
| 99.03 | IPABCD discovery + stage context | ✅ M1–M3 |
| 99.02 | CI schemas + biome + docs | 코드 ✅ / PR 마감 ⬜ |
| 99.04–07 | HUD `.jwc/`, slash 패리티 | 설계 ✅ / 구현 잔여 |

**Readiness:** MLB **62** — daily coding + goal + orchestrate ([50_status.md](./50_status.md))

---

## Phase 4. M2 Node Port & Package Distribution ✅ (band 100–150)

- `dist-node/` esbuild bundle · Node22 SDK
- `jawcode` npm package · managed Bun bootstrap
- Local tarball / install smoke
- Devlog: `260614_cli_jaw_jwc_distribution_strategy`

---

## Phase 5. GJC Chase Execution 🔄 (active)

카드 단위 PABCD: plan (`docs/chase WP*`) → implement → retire `_fin` + struct_har update.

**Recent closures (Jun 27–28):**

| Card | Summary |
|---|---|
| 10.012 | Goal steering port |
| 10.021 | Live-surface evidence gate |
| 10.023 | Compaction custom-message counting |
| 10.007 | Team tmux self-heal |
| 10.003 | Cursor shell timeout ms→s |
| 20.005 | Stranded steer drain |
| 20.006 | TUI Esc draft clear |

**Open backlog:** `struct_har/chase/10_gjc_chase_MOC.md`, `007_follow_index.md`

---

## Phase 6. cli-jaw Integration (160–310) — planned

| Band | Scope | Doc |
|---|---|---|
| 160–260 | dependency merge · CI · identity rename | [160 slice](../devlog/_plan/260614_cli_jaw_jwc_distribution_strategy/160_cli_jaw_release_slice.md) |
| 270–310 | JWC UI selector · default switch · ACP e2e · code UI parity | distribution MOC |

---

## Phase 7. Documentation Sync Loop 🔄

Repeat after major chase milestones or release:

1. Regenerate `structure/data/git-log-1000.tsv`
2. Update [08-git-commit-history.md](./08-git-commit-history.md) eras
3. Refresh [00_INDEX.md](./00_INDEX.md) HEAD cites
4. Snapshot [direction.md](./direction.md) / [roadmap.md](./roadmap.md)
5. Archive plan to `devlog/_fin/`

---

## Reading Order

1. [direction.md](direction.md) — why
2. [roadmap.md](roadmap.md) — when (this file)
3. [50_status.md](50_status.md) — readiness now
4. [08-git-commit-history.md](08-git-commit-history.md) — what shipped when
5. [06-devlog-map.md](06-devlog-map.md) — where evidence lives
