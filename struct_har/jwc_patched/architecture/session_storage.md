# architecture / session_storage (jwc_patched)

> **스냅샷 (2026-06-26)**: patched SoT는 [`structure/22_session_storage.md`](../../../structure/22_session_storage.md).
> fork `da23db8f217637412552c7a7b1e411a180c5ecc8` · gjc clone `f0a8a3eb6e619392af4965273c3cf95c3faf4345`.

## structure/ 발췌 (첫 12줄)

```markdown
# Session / Storage

> 현재 jwc storage는 `~/.jwc/agent` 중심이다. D6에 따라 TUI와 cli-jaw Web 세션은 공유하지 않고, 공유 대상은 스킬과 OAuth다.

## 경로 소스

| 함수/상수 | 경로 | 의미 | 근거 |
|---|---|---|---|
| `CONFIG_DIR_NAME` | `.jwc` | config root 기본 이름. | `/Users/jun/Developer/new/700_projects/jawcode/packages/utils/src/dirs.ts:22` |
| `getConfigDirName()` | `JWC_CONFIG_DIR` 또는 `GJC_CONFIG_DIR` 또는 `PI_CONFIG_DIR` 또는 `.jwc` | env override 가능. | `/Users/jun/Developer/new/700_projects/jawcode/packages/utils/src/dirs.ts:92` |
| `getAgentDir()` | `~/.jwc/agent` | agent config dir. | `/Users/jun/Developer/new/700_projects/jawcode/packages/utils/src/dirs.ts:216` |
| `getProjectAgentDir(cwd)` | `<cwd>/.jwc` | project-local runtime/config root. | `/Users/jun/Developer/new/700_projects/jawcode/packages/utils/src/dirs.ts:221` |
```

## 대조 메모

| side | 역할 |
|---|---|
| gjc_origin | upstream 클론 시점의 structure 동형 요약 (과거 har_struct) |
| jwc_patched | **structure/** 가 항상 최신 정본 — 본 파일은 인덱스·리베이스 전 훑기용 |

## 부록

- 전수 갱신: `bun struct_har/_scripts/struct-har-regenerate-architecture.ts`

