# architecture / conventions (jwc_patched)

> **스냅샷 (2026-06-13)**: patched SoT는 [`structure/11_conventions.md`](../../../structure/11_conventions.md).
> fork `d60b78223d5d5f5b3f82b3d0ccfe95620f754eb5` · gjc clone `269387babcbf02e33613032bc8e41ea395aa10ec`.

## structure/ 발췌 (첫 12줄)

```markdown
# Jawcode 컨벤션

## 1. 포크 규칙 (리베이스 친화)

업스트림과의 충돌 면적을 최소화하되, 공개 문서·프롬프트·사용자 표면은 **jwc 기준**으로 유지한다.

- ✅ 신규 파일/폴더 추가: `structure/`, `devlog/`, 그리고 jawcode 전용 코드는
  가능한 한 새 패키지(`packages/jaw-*`) 또는 새 모듈 파일로
- ⚠️ 업스트림 파일 수정: 해당 devlog 플랜에 경로·사유를 기록한 뒤에만
- ✅ `AGENTS.md`, `README*.md`, `structure/` 문서는 jwc 기준 정본으로 유지한다. upstream gajae-code 기준 문구는 `devlog/_upstream_gjc/`·`struct_har/gjc_origin/` 같은 비교/근거 문맥에만 남긴다

### 커밋 트레일러 규약 (fork-delta 동기 — 067.1 §3.1)
```

## 대조 메모

| side | 역할 |
|---|---|
| gjc_origin | upstream 클론 시점의 structure 동형 요약 (과거 har_struct) |
| jwc_patched | **structure/** 가 항상 최신 정본 — 본 파일은 인덱스·리베이스 전 훑기용 |

## 부록

- 전수 갱신: `bun struct_har/_scripts/struct-har-regenerate-architecture.ts`

