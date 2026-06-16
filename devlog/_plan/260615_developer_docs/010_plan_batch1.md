# Plan — Developer Docs Batch 1 (Pages 001–015)

## Scope

첫 배치: Getting Started (5p) + Architecture (6p) = 11 페이지.
사이드바 네비 인프라 + 첫 11개 콘텐츠 페이지.

## Batch Strategy

55페이지를 5 배치로 나눠 각각 PABCD 사이클:
- **Batch 1**: 001–015 Getting Started + Architecture (이번)
- **Batch 2**: 020–029 IPABCD Workflow (10p)
- **Batch 3**: 030–049 Tools + Providers + Subagents (20p)
- **Batch 4**: 050–069 TUI + Config + SDK + Performance (15p)
- **Batch 5**: 070–089 Security + Extending + Contributing + Reference (15p)

각 배치는 B-stage에서 서브에이전트 병렬 작성. 100+ 시리즈에 모순 보고.

## Infrastructure (이번 배치에서 구축)

### NEW: docs-site/docs/ 디렉토리 구조
```
docs-site/docs/
├── sidebar.html          # 공통 사이드바 fragment (JS include)
├── doc-layout.css        # 문서 페이지 전용 CSS
├── getting-started/
│   ├── installation.html
│   ├── quickstart.html
│   ├── cli-reference.html
│   ├── environment-variables.html
│   └── troubleshooting.html
└── architecture/
    ├── overview.html
    ├── package-map.html
    ├── agent-loop.html
    ├── prompt-assembly.html
    ├── compaction.html
    └── binary-build.html
```

### NEW: docs-site/assets/docs.js
사이드바 토글 + 현재 페이지 하이라이트 + 접이식 카테고리

### MODIFY: docs-site/assets/style.css
기존 `.page-layout`, `.sidebar`, `.page-content` CSS를 문서 전용으로 확장

## 콘텐츠 소스 매핑

| 페이지 | 소스 | 작성 방식 |
|---|---|---|
| installation | README Install 섹션 + devlog distribution strategy | 재구성 |
| quickstart | README Quick start + 새 콘텐츠 | 확장 |
| cli-reference | `packages/coding-agent/src/cli/args.ts` 파싱 | 코드 추출 |
| environment-variables | 코드에서 `process.env` 검색 | 코드 추출 |
| troubleshooting | 새 콘텐츠 (common issues) | 신규 |
| architecture/overview | `structure/10_architecture.md` | 재구성+편집 |
| package-map | `structure/10_architecture.md` §packages | 추출 |
| agent-loop | `docs/codebase-overview.md` + 코드 | 재구성 |
| prompt-assembly | `structure/20_prompt_flow.md` | 재구성 |
| compaction | `docs/compaction.md` | 재구성 |
| binary-build | `structure/10_architecture.md` §binary | 추출 |

## 서브에이전트 할당

| Agent | Pages | 의존성 |
|---|---|---|
| main session | sidebar.html, docs.js, doc-layout.css | 없음 — 인프라 먼저 |
| executor #1 | installation, quickstart, cli-reference | 인프라 완료 후 |
| executor #2 | environment-variables, troubleshooting | 인프라 완료 후 |
| executor #3 | overview, package-map, agent-loop | 인프라 완료 후 |
| executor #4 | prompt-assembly, compaction, binary-build | 인프라 완료 후 |

## 수용 기준

1. 11 HTML 페이지 모두 존재하고 사이드바에서 접근 가능
2. 사이드바가 접이식으로 카테고리 토글
3. 현재 페이지 사이드바 하이라이트
4. 모든 페이지에 style.css + docs.js + i18n.js 로드
5. Getting Started 5페이지에 실제 설치/실행 명령어 포함
6. Architecture 6페이지에 구조 다이어그램 또는 코드블록 포함
7. 100+ devlog에 발견된 모순 기록 (최소 1개 — 이미 4개 발견됨)
8. README에 모순 수정 반영

## 모순 추적 (100+ 시리즈)

이미 발견된 4개:
- `docs/sdk.md`: `@gajae-code/coding-agent` → `jawcode`
- `docs/REBRANDING_PLAN_260525.md`: red-claw → abyss-bite
- `docs/grok-build-provider-design.md`: owner sign-off 미완료
- `docs/brand-assets.md`: hero.png/character.png → jawcode-logo.png

→ `devlog/_plan/260615_developer_docs/100_contradictions.md`에 기록
