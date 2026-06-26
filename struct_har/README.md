# struct_har/ — gjc_origin ↔ jwc_patched 계층 대조

> **스냅샷 (2026-06-26)**: `resolve-heads.ts` + 재생성 스크립트로 worktree/클론 HEAD 자동 반영. **99.03** discovery·stage-context ✅ ([structure/50_status.md](../structure/50_status.md)).

> **목적**: 업스트림 gajae-code(`gjc_origin`)과 jawcode 포크(`jwc_patched`)의 **현재 형태**를 devlog MOC 밴드별로 병렬 기록한다.
> `structure/`가 patched 단일 SoT라면, `struct_har/`는 **양쪽 스냅샷 대조용**이다.

## 기준선

| 쪽 | 코드 소스 | HEAD (reviewed through) |
|---|---|---|
| **gjc_origin** | [`devlog/_gjc_chase/gajae-code/`](../devlog/_gjc_chase/gajae-code/) — Yeachan-Heo/gajae-code upstream `dev` tracking clone (gitignored) | `f0a8a3eb6e619392af4965273c3cf95c3faf4345` (재생성 시 `git -C devlog/_gjc_chase/gajae-code rev-parse HEAD`) |
| **jwc_patched** | jawcode worktree (포크 패치 반영; dirty local edits respected) | `da23db8f217637412552c7a7b1e411a180c5ecc8` (재생성 시 `git rev-parse HEAD`) |
| **omp_origin** | [`devlog/_omp_chase/oh-my-pi/`](../devlog/_omp_chase/oh-my-pi/) | `0fc6d136c34a279a711a2d3f2df9d64e0fa06cee` (재생성 시 클론 HEAD) |
- 업스트림 remote: `https://github.com/Yeachan-Heo/gajae-code`
- chase reviewed-through 정본: GJC MOC는 GJC+JWC, OMP MOC는 OMP+JWC를 기록하고, 횡단 인벤토리/INDEX/README는 세 축을 모두 기록한다.
- **gjc_origin 문서의 code facts는 `devlog/_gjc_chase/gajae-code/` 아래 파일을 정본으로 cite** (절대경로 `/Users/jun/Developer/new/700_projects/jawcode/devlog/_gjc_chase/gajae-code/…`).
- jwc_patched는 repo root `packages/`·`structure/`를 정본으로 cite.

## 폴더 규약

```text
struct_har/
  README.md
  INDEX.md
  gjc_origin/
    <band>/
      01_overview · 02_code_facts · 02_logic_changes · 03_devlog_refs
  jwc_patched/
    <band>/
      (동일)
    099_stabilization/
  omp_origin/
    <band>/          ← gjc/jwc 동형 id (13)
      (동일)
    architecture/
  gjc_origin/architecture/ · jwc_patched/architecture/
  chase/             ← 갭·gjc/omp 참조 방안 (수동 갱신)
    bands/
```

- **밴드 폴더명** = devlog `NNN_moc_*` 접두와 정렬 (`010_shell` … `100_node`, `architecture`).
- **파일명** = `01_overview` → `02_code_facts` → **`02_logic_changes`** → `03_devlog_refs`
- **갱신 규칙**: 포크 밴드 완료 시 `jwc_patched` 먼저; upstream fetch 후 `gjc_origin`/`omp_origin` HEAD, chase MOC reviewed-through 행, `002_gap_inventory`, `INDEX.md`, 본 README 기준선을 함께 갱신.
- **로직 정본**: [structure/40_fork-delta.md](../structure/40_fork-delta.md)
- **재생성**: `struct-har-regenerate.ts` · `struct-har-regenerate-logic.ts` · `struct-har-regenerate-architecture.ts` · `struct-har-regenerate-overviews.ts` · **`struct-har-regenerate-omp.ts`**

## upstream 클론 사용법

```bash
# 클론 (최초 1회 — devlog/.gitignore 대상)
git clone https://github.com/Yeachan-Heo/gajae-code devlog/_gjc_chase/gajae-code

# 갱신
git -C devlog/_gjc_chase/gajae-code fetch upstream dev
git -C devlog/_gjc_chase/gajae-code switch dev
git -C devlog/_gjc_chase/gajae-code pull --ff-only upstream dev
git -C devlog/_gjc_chase/gajae-code log -1 --oneline

# gjc_origin 대조 시 diff 예
diff -u devlog/_gjc_chase/gajae-code/packages/coding-agent/src/cli.ts packages/coding-agent/src/cli.ts
```

## 읽기 순서

1. [INDEX.md](./INDEX.md) — 전체 트리
2. `architecture/` — 양쪽 공통 토폴로지
3. M1 밴드 순: `010` → `040` → `050` → …
4. TUI 서브밴드: `081_cursor` / `082_input` / `083_output`

## 관련 문서

| 문서 | 역할 |
|---|---|
| [`devlog/_gjc_chase/gajae-code/`](../devlog/_gjc_chase/gajae-code/) | **업스트림 코드 정본** (gjc_origin 근거) |
| [structure/](../structure/) | jawcode patched 단일 SoT |
| [structure/40_fork-delta.md](../structure/40_fork-delta.md) | fork 동작 (git) |
| [structure/50_status.md](../structure/50_status.md) | MLB 50→62→68 |
| [structure/50_status.md](../structure/50_status.md) | 99 결정·착수 순서 |
| [structure/50_status.md](../structure/50_status.md) | beta v0.1 문서·OSS 마감 |
| [devlog/_plan/260612_jawcode_fork/](../devlog/_plan/260612_jawcode_fork/) | MOC·플랜·이슈 원본 |
| [AGENTS.md](../AGENTS.md) | upstream 운영 계약 (수정 금지) |
| [chase/](./chase/README.md) | gjc/omp **뒤쳐짐** · 참조 방안 |

## gjc_origin vs jwc_patched (횡단 요약)

| 영역 | gjc_origin (`devlog/_gjc_chase/gajae-code`) | jwc_patched (worktree) |
|---|---|---|
| CLI bin | `gjc` (+ stats) | **`jwc` only** (`packages/jwc`) |
| packages/jwc | 없음 | wrapper ✅ `jwc/sdk` |
| default interview | `deep-interview` | **`jaw-interview`** |
| config dir (runtime) | upstream `.jwc` 전환 중 | **`.jwc/`** (`dirs.ts`) |
| orchestrate IPABCD | 없음 | 런타임 ✅ · **99.03 discovery + 매 턴 stage-context** ✅ |
| global skills | `.jwc` 2계층 | + `~/.cli-jaw/skills` (D5 목표) |
| TUI theme | upstream 기본 | jaw 테마 · HUD ⬜ **99.04** |
| omp 참조축 | — | [omp_origin/](./omp_origin/README.md) |

## evidence 규칙

- gjc_origin: `/Users/jun/Developer/new/700_projects/jawcode/devlog/_gjc_chase/gajae-code/<repo-relative-path>:<line>`
- jwc_patched: `/Users/jun/Developer/new/700_projects/jawcode/<path>:<line>` (structure/11_conventions.md 동형)
- devlog MOC는 스코프·결정 정본; **코드 형태는 클론/worktree가 우선**

## 밴드 ↔ upstream 경로 (요약)

| 밴드 | upstream에서 볼 핵심 경로 |
|---|---|
| 010_shell | `packages/utils/src/dirs.ts`, `scripts/rebrand-inventory.ts`, `packages/gajae-code/` |
| 020_prompt | `packages/coding-agent/src/prompts/`, `system-prompt.ts` |
| 030_skills | `extensibility/skills.ts`, `defaults/gjc-defaults.ts`, `defaults/gjc/skills/` |
| 040_interview | `defaults/gjc/skills/deep-interview/`, `commands/deep-interview.ts` |
| 050_plan | `defaults/gjc/skills/ralplan/`, `commands/ralplan.ts` |
| 060_goal | `defaults/gjc/skills/ultragoal/` |
| 070_memory | memory hooks / `.jwc` 규약 |
| 080_tui | `packages/tui/` |
| 081_cursor | `packages/ai/src/providers/cursor.ts`, `packages/coding-agent/src/cursor.ts` |
| 082_input | `packages/tui/` IME/keys |
| 083_output | TUI output / tool collapse |
| 090_auth | `packages/ai/src/auth-storage.ts` |
| 100_node | Bun-only modules (M2 포팅 대상) |

## changelog

| 날짜 | 변경 |
|---|---|
| 2026-06-26 | jwc `da23db8` · gjc `f0a8a3eb` · omp `0fc6d136` · actual chase clone 경로(`devlog/_gjc_chase/gajae-code`, `devlog/_omp_chase/oh-my-pi`) 우선 · GJC `upstream/dev` 기준 재생성 |
| 2026-06-14 | jwc `d60b7822` · gjc `269387ba` · HEAD 동적 `resolve-heads.ts` · 밴드 앵커 `jwc-runtime`/`jwc-defaults` 정정 · structure executor 동기화 · **chase/ 미포함** |
| 2026-06-13 (3차) | 기준선 전진: gjc `75d103f45145` (+2: receipt spool exporter, model-profiles UX), jwc `dc4f22672581`. **10.009·10.010 채택 완료** (99.11.01/02 구현 랜딩) → `_legacy/10/` 이동. 신규 chase: [10.011 receipt spool](./chase/10.011_gjc_chase_receipt_spool.md) (가치 60, owner/storage clean 실측); `a12a751` model-profiles는 **사용자 직접 패치 중** (카드 미발급). chase 공유 문서 `0NN` 3자리 리네임 (`001_overview`…`006_jwc_own_backlog`). |
| 2026-06-13 (2차) | 기준선 전진: gjc `2b4d407b471b` (+2: pi-shell UTF-8 panic, harness submit gate), omp `db421bb2ef68` (15.12.3, +11), jwc `ff0003db6ac0` (+17: 99.00.03·99.07·99.20). 신규 chase: `10.009`·`10.010`·`20.005`·`20.006`. **구현가치 MLB 표** 신설 ([002_gap_inventory](./chase/002_gap_inventory.md)). 재생성 스크립트 `ROOT` 경로 버그 수정 (`../..`). |
| 2026-06-13 | chase 기준선 reviewed through: gjc `050aa1731551`, omp `ba27bbd3a327`, jwc `a771f492d382`; GJC `10.007` team `@gjc-profile` gap과 `10.008` RPC lifecycle gap 할당. |
| 2026-06-13 | **전수 재생성** (26×02, 26×01/03, architecture×14, 스크립트 3종) + omp_origin |
| 2026-06-13 | **chase/** — 갭·gjc/omp 참조 + bands/13 |
| 2026-03-13 | 초기 struct_har 94 md 생성 |
| 2026-03-13 | 문서 >=100 lines 확장 |
| 2026-03-13 | gjc_origin 근거를 `devlog/_gjc_chase/gajae-code` 클론으로 통일 |
