# chase — 번호 · `_fin` 워크플로

> **정본 위치**: **`struct_har/chase/`**
> - MOC: `10_gjc_chase_MOC.md` · `20_omp_chase_MOC.md`
> - 플랜: `10.NNN_*.md` · `20.NNN_*.md` (같은 디렉터리)
> - 횡단 표·bands: `002_gap_inventory` · `bands/` · `03`/`04`

`devlog/_plan/260612_jawcode_fork/` 에는 **스텁**만 둘 수 있음 (로드맵 호환).

## 번호 축

| 접두 | MOC (struct_har/chase/) | 하위 파일명 |
|---|---|---|
| **10** | `10_gjc_chase_MOC.md` | `10.001_gjc_chase_cycle.md` … |
| **20** | `20_omp_chase_MOC.md` | `20.001_omp_chase_cycle.md` … |

- **1갭 = 1문서** · `NNN` 001부터 연속
- gjc = G1 흡수 · omp = G2 참조 (이식 ❌)

## 헤더 (플랜)

```markdown
# 10.NNN — 제목
> MOC: [10_gjc_chase_MOC](./10_gjc_chase_MOC.md)
> 상태: ⬜ | 🟡 | ✅
```

## `_fin` — 완료 시

| 단계 | 행동 |
|---|---|
| 1 | `> 상태: ✅` · 완료일 · HEAD |
| 2 | MOC 표 ✅ + [_fin/INDEX](./_fin/INDEX.md) |
| 3 | `10.NNN_*.md` → **`struct_har/chase/_fin/10/`** 또는 `…/20/` |
| 4 | [002_gap_inventory](./002_gap_inventory.md) · `bands/` |
| 5 | (선택) devlog `_fin/chase/`에 동일 복사 — **필수 아님** |

## 신규 NNN

1. MOC 다음 번호 (`10.011` …)
2. `struct_har/chase/10.011_<slug>.md` 생성
3. MOC 표 1행

## G3/G4

99·M2 자체 백로그 → [006_jwc_own_backlog](./006_jwc_own_backlog.md) (10/20 아님)