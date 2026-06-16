# omp_origin — 02 code facts

> **repo 기준**: `devlog/_upstream_omp/` 클론 (gitignored).
> 절대 cite: `/Users/jun/Developer/new/700_projects/jawcode/devlog/_upstream_omp/<path>:<line>`

## 1. 루트·진입

| path | fact |
|---|---|
| `package.json` | `name`: `omp-monorepo`, `packageManager`: `bun@1.3.14` |
| `packages/coding-agent/` | primary product — bin `omp` via `@oh-my-pi/pi-coding-agent` |
| `AGENTS.md` | 개발 규칙; catalog은 `@oh-my-pi/pi-catalog`에서 import |
| `.omp/skills/`, `.omp/commands/` | repo-local omp 확장 표면 |
| `crates/pi-natives/` | Rust 네이티브 (gjc/jawcode와 동형 계열) |

## 2. catalog (gjc에 없는 축)

| path | fact |
|---|---|
| `packages/catalog/` | bundled `models.json`, provider descriptors, model identity |
| `packages/ai/` | 스트리밍·프로바이더; **모델 카탈로그 값은 catalog 패키지** |

gjc upstream (`devlog/_upstream_gjc`): `packages/ai/src/models.json` + generate-models 스크립트 — **단일 ai 패키지**.

## 3. coding-agent CLI

| path | fact |
|---|---|
| `packages/coding-agent/src/cli.ts` | worker host dispatch (`declareWorkerHostEntry`, `__omp_*_worker` argv) |
| `packages/coding-agent/package.json` | `@oh-my-pi/pi-coding-agent`, version catalog `15.11.x` 대역 (클론 시점) |

jwc_patched: `packages/jwc/bin/jwc.js` → `@gajae-code/coding-agent/cli` (wrapper only).

## 4. 문서·에셋

| path | fact |
|---|---|
| `README.md` | 40+ providers, 32 tools, LSP/DAP ops — 마케팅·벤치 수치 |
| `docs/` | slash-command, skills, tui-runtime, ttsr-injection 등 내부 설계 문서 다수 |

jawcode: upstream `docs/`는 리베이스 충돌 방지로 루트 유지; jaw 전용은 `devlog/` + `structure/`.

## 5. Python / Docker

| path | fact |
|---|---|
| `python/robomp/` | robomp 웹 (gjc의 `robogjc`에 대응하는 omp 명명) |
| `Dockerfile.robomp` | omp 컨테이너 빌드 |

## 6. 갱신 절차

1. `git -C devlog/_upstream_omp fetch origin`
2. `git -C devlog/_upstream_omp log -1 --oneline` → 본 파일 상단·`README.md`에 기록
3. 패키지 추가/삭제 시 `01_overview.md` 패키지 맵 동기화

## 부록

- **밴드**: `omp_origin` (struct_har 참조축, MOC 010–100과 직교)
- **대조**: [gjc_origin/010_shell](../gjc_origin/010_shell/02_code_facts.md) (gjc bin·jwc wrapper)