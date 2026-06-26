# Jawcode 컨벤션

## 1. 포크 규칙 (리베이스 친화)

업스트림과의 충돌 면적을 최소화하되, 공개 문서·프롬프트·사용자 표면은 **jwc 기준**으로 유지한다.

- ✅ 신규 파일/폴더 추가: `structure/`, `devlog/`, 그리고 jawcode 전용 코드는
  가능한 한 새 패키지(`packages/jaw-*`) 또는 새 모듈 파일로
- ⚠️ 업스트림 파일 수정: 해당 devlog 플랜에 경로·사유를 기록한 뒤에만
- ✅ `AGENTS.md`, `README*.md`, `structure/` 문서는 jwc 기준 정본으로 유지한다. upstream GJC 기준 문구는 `devlog/_gjc_chase/gajae-code/`·`struct_har/gjc_origin/` 같은 비교/근거 문맥에만 남긴다

### 커밋 트레일러 규약 (fork-delta 동기 — 067.1 §3.1)

HARD-EDIT·INVERTED-GUARD·REMOVED 파일이 포함된 커밋은 트레일러를 붙인다 (NEW/SOFT-EDIT는 선택 — `fork-delta.md` 갱신으로 대체 가능):

```
Fork-Delta: <NEW|HARD-EDIT|REMOVED|INVERTED-GUARD|SOFT-EDIT> <저장소상대경로>
```

파싱: `git log --format=%(trailers:key=Fork-Delta)`. 소스 인라인 마커(`// [jawcode-fork]`)는 채택하지 않음 — 예외: 파일 상단 1행 한정 보존 경계 주석.

## 2. 업스트림 동기화

### 2.1 worktree remote

- public remote: `origin` = https://github.com/lidge-jun/jawcode
- upstream lineage는 worktree remote가 아니라 `devlog/_gjc_chase/gajae-code/` 참조 클론에서 대조한다.
- 공개 repo는 fresh root commit으로 시작한다. upstream 동기화는 별도 브랜치/작업트리에서 검토한 뒤 필요한 패치만 이식한다.
- `packages/ai/src/models.json`(1.5MB 모델 카탈로그)은 업스트림 추종, 직접 수정 금지

### 2.2 업스트림 참조 클론 (`devlog/_gjc_chase/gajae-code/`)

포크 개발은 **worktree 패치 + upstream 클론 pull·대조**를 병행한다. `structure/`는 patched SoT, 클론은 upstream baseline 근거다.

| 항목 | 값 |
|---|---|
| 경로 | `devlog/_gjc_chase/gajae-code/` |
| remote | `upstream` → `https://github.com/Yeachan-Heo/gajae-code` (`dev`) |
| git 추적 | **gitignored** — jawcode 커밋에 upstream 트리를 넣지 않음 |
| 용도 | file:line 근거, `diff -u` 대조, upstream-only 버그 재현 (081 등) |
| 대조 문서 | `struct_har/gjc_origin/` (클론 @ HEAD) ↔ `struct_har/jwc_patched/` (worktree) |
| omp 참조 클론 | `devlog/_omp_chase/oh-my-pi/` — [struct_har/omp_origin/](../struct_har/omp_origin/README.md) (can1357/oh-my-pi, `origin/main`, gitignored) |

**최초 클론**

```bash
mkdir -p devlog/_gjc_chase
git clone https://github.com/lidge-jun/gajae-code devlog/_gjc_chase/gajae-code
git -C devlog/_gjc_chase/gajae-code remote add upstream https://github.com/Yeachan-Heo/gajae-code
```

**밴드 착수·리베이스 전 pull (권장)**

```bash
git -C devlog/_gjc_chase/gajae-code fetch upstream dev
git -C devlog/_gjc_chase/gajae-code switch dev
git -C devlog/_gjc_chase/gajae-code pull --ff-only upstream dev
git -C devlog/_gjc_chase/gajae-code log -1 --oneline    # HEAD를 devlog·struct_har에 기록
```

**근거 cite 규칙**

- upstream baseline: `/Users/jun/Developer/new/700_projects/jawcode/devlog/_gjc_chase/gajae-code/<repo-relative-path>:<line>`
- fork patched: `/Users/jun/Developer/new/700_projects/jawcode/<path>:<line>`

클론 HEAD 갱신 후: `struct_har/gjc_origin/**/02_code_facts.md`, `struct_har/README.md`, `structure/11_conventions.md`; omp fetch 시 `struct_har/omp_origin/**` 동기화.
`bun struct_har/_scripts/struct-har-regenerate.ts` (+ architecture, overviews)로 밴드 스냅샷 일괄 갱신 가능 (2026-06-13).

## 3. 코드 컨벤션

업스트림 컨벤션을 그대로 따른다:
- Bun workspaces + catalog, biome (린트/포맷), TypeScript strict
- 패키지 네임스페이스: 업스트림 `@jawcode-dev/*`는 유지하고, 공개 standalone npm 패키지는 `jawcode`(`bin: jwc`, `import: jawcode/sdk`)로 둔다.
- 커밋: 업스트림은 conventional commits (`fix(scope):`, `docs(changelog):`) — 동일하게

| 규칙 | 근거 |
|---|---|
| no `any`, no `ReturnType<>`, no inline imports | `/Users/jun/Developer/new/700_projects/jawcode/AGENTS.md:51`, `/Users/jun/Developer/new/700_projects/jawcode/AGENTS.md:52`, `/Users/jun/Developer/new/700_projects/jawcode/AGENTS.md:53` |
| prompts는 static `.md` 파일 import | `/Users/jun/Developer/new/700_projects/jawcode/AGENTS.md:57` |
| `packages/coding-agent/`에서 console logging 금지 | `/Users/jun/Developer/new/700_projects/jawcode/AGENTS.md:75` |
| 검증은 `bun check` / `bun run check:ts`, `tsc`/`npx tsc` 금지 | `/Users/jun/Developer/new/700_projects/jawcode/AGENTS.md:89` |

## 4. Devlog (Jawdev 표준)

- 플랜 단위 폴더: `devlog/_plan/YYMMDD_slug/`
- `00_*`가 그 플랜 단위의 인덱스/MOC다.
- 문서 파일명은 **lexicographic execution order**를 유지한다. 파일 목록 정렬만 봐도 phase별 구현 순서와 PABCD 왕복 이력이 보여야 한다.
- 상위 phase는 작업 규모에 맞춰 10 또는 100 단위 밴드를 예약한다.
  - 작은/단일 플랜: Phase 1 → `10_*`, Phase 2 → `20_*`, Phase 3 → `30_*`
  - 장기/대형 플랜: Phase 1 → `100_*`, Phase 2 → `200_*`, Phase 3 → `300_*`
- phase 내부 문서는 그 phase 밴드 안에서 실행 순서대로 배치한다.
  - 작은 플랜 예: Phase 2의 계획/감사/합성/구현 문서는 `20_plan.md`, `20.1_p_critic_round1.md`, `20.2_p_synthesis_round1.md`, `20.3_a_planner_round1.md`, `20.4_a_architect_round1.md`, `21_impl.md`
  - 대형 플랜 예: Phase 2 → `200_plan.md`, `210_p_critic_round1.md`, `220_p_synthesis_round1.md`, `230_a_audit_round1.md`, `240_impl.md`
- PABCD 단계명은 최상위 번호 체계가 아니다. P/A/B/C/D 산출물은 관련 phase 안에서 plan/audit/synthesis/build/check 문서로 lexicographic하게 배치한다.
- phase 번호는 **구현 실행 순서** 기준이다. 발견/작성 시간순 append가 아니라, 다음 에이전트가 실행 순서를 그대로 따라갈 수 있는 번호를 선택한다.
- 기존 문서 사이에 새 작업을 끼워 넣어야 하면 새 번호를 끝에 붙이지 말고 사용 가능한 lexicographic gap 또는 점 표기를 사용한다.
- diff 레벨 플랜은 채팅이 아닌 파일로: 정확한 경로, NEW/MODIFY/DELETE, MODIFY는 before/after
- 완료된 플랜 폴더는 `devlog/_fin/`으로 이동
- 문서 내 파일 참조는 **절대 경로** 사용

## 4.1 MOC 표기 규약

| 표기 | 의미 | 사용 위치 | 근거 |
|---|---|---|---|
| `[확정]` | 인터뷰에서 확정된 결정. 구현은 이 결정을 기준으로 한다. | MOC/roadmap/structure 문서 | `/Users/jun/Developer/new/700_projects/jawcode/devlog/_plan/260614_cli_jaw_jwc_distribution_strategy/_legacy/260612_jawcode_fork/phase1/000_roadmap.md:34` |
| `[기본값]` | repo(upstream jawcode)의 실제 동작. 별도 결정이 없으면 이대로 간다. | 코드 실사 결과, default behavior | `/Users/jun/Developer/new/700_projects/jawcode/devlog/_plan/260614_cli_jaw_jwc_distribution_strategy/_legacy/260612_jawcode_fork/phase1/000_roadmap.md:34` |
| `[제안]` | repo 기본값에서 벗어나는 변경안. 채택은 인터뷰 결정 필요. | 설계 옵션, 향후 개선안 | `/Users/jun/Developer/new/700_projects/jawcode/devlog/_plan/260614_cli_jaw_jwc_distribution_strategy/_legacy/260612_jawcode_fork/phase1/000_roadmap.md:34` |

## 4.2 문서 근거 규칙

| 규칙 | 적용 |
|---|---|
| 구조 문서의 사실 주장은 실제 파일 경로와 라인 번호를 단다. | `structure/*.md` |
| 실행 결과 근거는 명령과 관찰값을 같이 쓴다. | `conventions.md`의 remote/status/HEAD |
| 계획/결정과 코드 사실을 분리한다. | `[확정]`, `[기본값]`, `[제안]` 표기 |
| `structure/00_INDEX.md`는 문서 추가/삭제/범위 변경 때 같이 갱신한다. | `/Users/jun/Developer/new/700_projects/jawcode/structure/00_INDEX.md:1` |

## 5. str_func

현 단계에서는 사용하지 않는다 (경량 표준). 모듈 단위 함수 문서가 필요해지는
첫 광역 기능 작업 때 도입을 재검토한다.


---

# (merged) Git 구조 · 리베이스 가드


---

## Git Structure / Fork Operation

> fork 운영 원칙: 공개 명령·문서·상태 경로는 `jwc`/`.jwc` 기준으로 유지하고, 내부 `@jawcode-dev/*` namespace는 리베이스 비용을 낮추기 위해 보존한다.

### 현재 Git 상태

| 항목 | 값 | 근거 |
|---|---|---|
| Project root | `/Users/jun/Developer/new/700_projects/jawcode` | task instruction |
HEAD | `da23db8` (`main`) | `git -C /Users/jun/Developer/new/700_projects/jawcode rev-parse --short HEAD` (2026-06-26)
origin fetch/push | `https://github.com/lidge-jun/jawcode` (`main` tracks `origin/main`) | `git -C /Users/jun/Developer/new/700_projects/jawcode remote -v` · `git -C /Users/jun/Developer/new/700_projects/jawcode branch -vv` (2026-06-26)
upstream baseline (참조 클론) | `https://github.com/Yeachan-Heo/gajae-code` @ `devlog/_gjc_chase/gajae-code/` | §2.2 · `git -C devlog/_gjc_chase/gajae-code rev-parse --short HEAD`
worktree branch | `main` @ `da23db8` | `git -C /Users/jun/Developer/new/700_projects/jawcode branch -vv`
upstream 참조 클론 HEAD | `f0a8a3eb` | `git -C devlog/_gjc_chase/gajae-code rev-parse --short HEAD` (2026-06-26)

### JWC 표면 정책

| 정책 | 상태 | 근거 |
|---|---|---|
| package 표면 | `packages/jwc`가 npm package `jawcode`를 제공한다. | `/Users/jun/Developer/new/700_projects/jawcode/packages/jwc/package.json:2` |
| bin 표면 | `packages/jwc`가 `jwc` bin을 제공한다. | `/Users/jun/Developer/new/700_projects/jawcode/packages/jwc/package.json:8` |
| 내부 실행 | `jwc` bin은 Node 엔트리에서 managed Bun runtime을 찾아 재실행한 뒤 workspace CLI 또는 bundle을 import한다. | `/Users/jun/Developer/new/700_projects/jawcode/packages/jwc/bin/jwc.js:1` |
| SDK 표면 | `jawcode/sdk`는 coding-agent SDK를 재수출한다. | `/Users/jun/Developer/new/700_projects/jawcode/packages/jwc/package.json:18`, `/Users/jun/Developer/new/700_projects/jawcode/packages/jwc/src/sdk.ts:1` |
| default workflow slug | public defaults는 `jaw-interview`, `plan`, `team`, `goal`이다. legacy `deep-interview`는 upstream baseline/read-compat 문맥에만 둔다. | `/Users/jun/Developer/new/700_projects/jawcode/packages/coding-agent/src/defaults/jwc-defaults.ts:17`, `/Users/jun/Developer/new/700_projects/jawcode/AGENTS.md:11` |
| package namespace | 내부 workspace는 upstream `@jawcode-dev/*`를 유지하고, 공개 standalone package는 `jawcode`다. | `/Users/jun/Developer/new/700_projects/jawcode/structure/11_conventions.md:70` |
| state path | 런타임 `.jwc/` (`CONFIG_DIR_NAME`, `~/.jwc`) — repo 문서·마이그레이션은 Phase β 기준 | `/Users/jun/Developer/new/700_projects/jawcode/packages/utils/src/dirs.ts:219` |
| D4 결정 | bin `jwc`, 브랜딩/문서/스킬명은 jwc 기준; 내부 `@jawcode-dev/*` 스코프는 보존. | `/Users/jun/Developer/new/700_projects/jawcode/devlog/_plan/260614_cli_jaw_jwc_distribution_strategy/_legacy/260612_jawcode_fork/phase1/05_interview_conclusions.md:13` |

### 리베이스 가드

> 충돌 예상 파일 사전 점검: `grep "CONFLICT-EXPECTED" structure/40_fork-delta.md` ↔ `diff -qr devlog/_gjc_chase/gajae-code/packages packages` 대조 ([fork-delta.md](./40_fork-delta.md) 정본).

| Guard | 적용 | 근거 |
|---|---|---|
| upstream 파일 수정 최소화 | jaw 전용 context는 `structure/`, `devlog/`, 신규 패키지에 둔다. | `/Users/jun/Developer/new/700_projects/jawcode/structure/11_conventions.md:7` |
| public docs stay jwc-first | `AGENTS.md`, `README*.md`, `structure/`는 jwc 기준 정본으로 유지한다. | `/Users/jun/Developer/new/700_projects/jawcode/structure/11_conventions.md:10`, `/Users/jun/Developer/new/700_projects/jawcode/AGENTS.md:1` |
| model catalog 직접 수정 금지 | `packages/ai/src/models.json`은 generator/descriptors/resolvers로 바꾸고 regenerate한다. | `/Users/jun/Developer/new/700_projects/jawcode/AGENTS.md:73` |
| workflow default surface gate | default workflow skill 변경 후 required gates가 있다. | `/Users/jun/Developer/new/700_projects/jawcode/AGENTS.md:128` |
| no push/reset/clean | task context와 repo AGENTS 모두 destructive git 회피를 요구한다. | `/Users/jun/Developer/new/700_projects/jawcode/AGENTS.md:125` |

### Upstream Sync 절차

| 단계 | 명령 | 주의 |
|---|---|---|
| 0 | `git -C devlog/_gjc_chase/gajae-code fetch upstream dev && git -C devlog/_gjc_chase/gajae-code pull --ff-only upstream dev` | **참조 클론 pull** — gjc_origin 근거·diff 전에 실행. 최초: `git clone … devlog/_gjc_chase/gajae-code` + `remote add upstream`. |
| 1 | `git -C /Users/jun/Developer/new/700_projects/jawcode fetch origin` | worktree remote. |
| 2 | `git -C /Users/jun/Developer/new/700_projects/jawcode status --short` | rebase/merge가 아니라 필요한 패치만 현재 worktree 위에 적용한다. |
| 3 | conflict 확인 | `.jwc/`, `@jawcode-dev/*` 보존 정책과 충돌하면 D4를 우선한다. |
| 4 | gates | workflow/default surface 변경이 있으면 `bun scripts/check-visible-definitions.ts`, `bun scripts/verify-g002-gates.ts`, `bun scripts/rebrand-inventory.ts --strict`, `bun test packages/coding-agent/test/default-gjc-definitions.test.ts` (가드는 jwc 어휘 기준 — 02:04 하드 수정 개정). 근거: `/Users/jun/Developer/new/700_projects/jawcode/AGENTS.md:128` |
| 5 | 문서 | 클론 HEAD·밴드 diff → `struct_har/gjc_origin/`, `struct_har/README.md`; patched → `structure/` |

### upstream 참조 클론 (`devlog/_gjc_chase/gajae-code/`)

| 항목 | 값 | 근거 |
|---|---|---|
| 경로 | `devlog/_gjc_chase/gajae-code/` | jawcode `.gitignore`, `devlog/.gitignore` |
| remote | `https://github.com/Yeachan-Heo/gajae-code` | GJC upstream `dev` |
클론 HEAD (기록 시점) | `f0a8a3eb` | `git -C devlog/_gjc_chase/gajae-code rev-parse --short HEAD` (2026-06-26)
| paired docs | `struct_har/gjc_origin/` | upstream baseline 스냅샷 |
| patched SoT | `structure/` | worktree 현재 형태 |

개발 중 upstream과의 차이 확인:

```bash
diff -qr devlog/_gjc_chase/gajae-code/packages/coding-agent/src/ packages/coding-agent/src/ | head
grep -n deep-interview devlog/_gjc_chase/gajae-code/packages/coding-agent/src/defaults/<legacy-defaults-file>.ts
```

- **pull하면서 개발**: 밴드 착수 전에 GJC/OMP clone fetch + worktree status 확인을 한 세트로 돌린다.
- upstream-only 이슈(081 cursor 등)는 클론에서 line 확인 후 fork hotfix 또는 upstream PR.

### 문서 동기화

| 변경 | 갱신 문서 |
|---|---|
| `packages/jwc` public export 변경 | `architecture.md`, `architecture.md`, `conventions.md` |
| `.jwc` 경로 정책 변경 | `conventions.md`, `session_storage.md`, `extensibility.md` |
| default workflow skill 변경 | `extensibility.md`, `prompt_flow.md`, `extensibility.md`, `INDEX.md` |
| upstream sync 정책 변경 | `conventions.md`, `conventions.md` |
| `devlog/_gjc_chase/gajae-code` HEAD 갱신 | `struct_har/README.md`, `struct_har/gjc_origin/**`, `conventions.md` |
| patched 밴드 완료 | `structure/*`, `struct_har/jwc_patched/**` |
| `devlog/_omp_chase/oh-my-pi` HEAD 갱신 | `struct_har/omp_origin/**`, `bun struct_har/_scripts/struct-har-regenerate-omp.ts`, `fork-delta.md` |
