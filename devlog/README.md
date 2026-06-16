# Devlog

Jawcode 포크의 계획, 완료 기록, 레퍼런스 문서 모음.

## Layout

```text
devlog/
  _plan/           # active or pending plans (YYMMDD_slug/)
  _fin/            # completed summaries
  _upstream_gjc/   # upstream gajae-code git clone (gitignored — diff·file:line baseline)
  _reference/      # 002_proxy/ — gjc 프로바이더 계층 분석 노트 (자체 git repo, 원본: /Users/jun/Developer/new/002_proxy)
```

upstream(gajae-code) 소유인 `docs/`는 리베이스 충돌 방지를 위해 루트에 그대로 둔다.
jawcode 전용 컨텍스트는 전부 이 폴더 아래에 둔다.

## 관련 문서 (repo root)

| 경로 | 역할 |
|---|---|
| [structure/](../structure/00_INDEX.md) | jawcode **patched SoT** — 코드 지도·계약 |
| [struct_har/](../struct_har/README.md) | `gjc_origin` ↔ `jwc_patched` MOC 밴드 대조 |
| `devlog/_upstream_gjc/` | upstream **코드 클론** — fetch 후 diff·file:line cite ([conventions §2.2](../structure/11_conventions.md)) |
| `devlog/_upstream_omp/` | oh-my-pi **참조 클론** — [struct_har/omp_origin/](../struct_har/omp_origin/README.md) |

## upstream 참조 클론 (`_upstream_gjc/`)

포크 개발은 worktree 패치와 **업스트림 클론 pull·대조**를 병행한다.

- **경로**: `devlog/_upstream_gjc/` (gitignored — `devlog/.gitignore`)
- **remote**: `https://github.com/Yeachan-Heo/gajae-code`
- **용도**: upstream baseline file:line, `diff -u` 대조, upstream-only 버그 재현
- **paired docs**: `struct_har/gjc_origin/` @ 클론 HEAD

**최초 클론**

```bash
git clone https://github.com/Yeachan-Heo/gajae-code devlog/_upstream_gjc
```

**밴드 착수·리베이스 전 pull (권장)**

```bash
git -C devlog/_upstream_gjc fetch origin
git -C devlog/_upstream_gjc log -1 --oneline    # HEAD를 devlog·struct_har에 기록
git fetch upstream && git rebase upstream/main  # worktree — 변경 정리 후
```

상세: [structure/11_conventions.md §2.2](../structure/11_conventions.md)
