# Implementation Plan — Docs Site + README Overhaul

## Scope

4개 작업 스트림을 병렬 서브에이전트로 실행:

### Stream 1: docs-site/ 랜딩 페이지 (NEW)
- `docs-site/index.html` — 전체 랜딩 페이지
- `docs-site/assets/style.css` — Abyss Bite 디자인 시스템 CSS (010_design_language.md 기반)
- `docs-site/assets/i18n.js` — EN/KO 토글 로직
- `docs-site/locales/en.json` — 영어 locale
- `docs-site/locales/ko.json` — 한국어 locale

**index.html 섹션 구성:**
1. Nav — 로고 + Install | Workflow | Tools | Settings | Lineage + EN/KO 토글
2. Hero — jaw-gradient 배경 + 로고(네온 글로우) + "Encode intention. Decode software." + `npm install -g jawcode` 복사 버튼 + TUI mockup (welcome.ts gradient+sweep CSS 재현)
3. IPABCD Pipeline — 6단계 인터랙티브 다이어그램 (hover 시 설명 표시)
4. Tool Gallery — 5 카테고리(Search/Edit/Execute/Orchestrate/Observe) 카드
5. Install — 3탭 (npm/bun/source) 코드 블록 + 복사 버튼
6. Demo — SVG placeholder ("▶ Watch demo" 링크)
7. Lineage — gajae-code 계보 다이어그램
8. Footer — MIT License + GitHub 링크

### Stream 2: docs-site/ 서브페이지 (NEW)
- `docs-site/install.html`
- `docs-site/workflow.html`
- `docs-site/tools.html`
- `docs-site/settings.html` — Configuration guide (config.yml 예시, retry 설정, theme 선택)
- `docs-site/lineage.html`

각 페이지는 `style.css` 공유, 사이드바 네비게이션 포함.
콘텐츠 스펙: devlog `000_moc_docs_site.md` §페이지별 콘텐츠 스펙 참조.
i18n: `i18n.js` + `locales/*.json` (Stream 1에서 생성) 공유.

### Stream 3: README.md 개선 (MODIFY)
- SVG 데모 placeholder: "▶ Watch demo" 배지 → GitHub Pages 링크
- 설치 가이드: 현재 1줄 → `<details>` 접이식 3경로 (npm/bun/source)
- Tool inventory: 현재 2 테이블(Essential/Discoverable) → 5 카테고리 그룹핑
- IPABCD: 각 단계 한 줄 설명 추가
- GitHub Pages 링크: 상단 배지

### Stream 4: 배포 인프라 (NEW)
- `.github/workflows/deploy-docs.yml` — GitHub Actions: push to dev/main → build docs-site → deploy to gh-pages
- OG image: 1200x630 (`docs-site/assets/og-image.png`)
- Favicon: 32/192/512px (`docs-site/assets/favicon-32.png`, etc.)

## 파일 목록

### NEW (16 files)
```
docs-site/index.html
docs-site/install.html
docs-site/workflow.html
docs-site/tools.html
docs-site/settings.html
docs-site/lineage.html
docs-site/assets/style.css          (tui-mockup CSS 포함)
docs-site/assets/i18n.js
docs-site/assets/jawcode-logo.png   (cp artifacts/logos/jawcode-logo.png)
docs-site/locales/en.json
docs-site/locales/ko.json           (ux-writing-ko.md 규칙 적용)
docs-site/assets/og-image.png
docs-site/assets/favicon-32.png
docs-site/assets/favicon-192.png
docs-site/assets/favicon-512.png
.github/workflows/deploy-docs.yml
```

### MODIFY (1 file)
```
README.md — SVG demo badge, 3-path install, 5-cat tools, IPABCD descriptions, Pages badge
```

## 서브에이전트 할당

| Agent | Stream | Files | 의존성 |
|---|---|---|---|
| executor #1 | Stream 1 | index.html, style.css, i18n.js, locales/*.json, jawcode-logo.png | 없음 |
| executor #2 | Stream 2 | install.html, workflow.html, tools.html, settings.html, lineage.html | style.css + i18n.js + locales (Stream 1) |
| executor #3 | Stream 3 | README.md | 없음 |
| executor #4 | Stream 4 | deploy-docs.yml, favicon, OG | 없음 |

Stream 2는 Stream 1의 style.css + i18n.js + locales에 의존. Stream 4 assets는 결정적 경로로 참조 — 병렬 가능.
Tool list source: `README.md` tool inventory + `packages/coding-agent/src/tools/index.ts` BUILTIN_TOOLS. 5-category mapping: Search/Edit/Execute/Orchestrate/Observe (MOC §Tool Gallery).

## 검증

- [ ] `docs-site/index.html` 브라우저에서 열어서 렌더 확인
- [ ] 반응형: 1024px / 768px / 375px 에서 레이아웃 확인
- [ ] EN/KO 토글 동작
- [ ] install tabs 전환
- [ ] IPABCD hover 동작
- [ ] GitHub Actions workflow 문법 검증 (`actionlint` 또는 dry-run)
- [ ] README.md `<details>` 렌더 확인

## 수용 기준

1. `docs-site/index.html`이 abyss-bite 테마로 렌더되고, TUI mockup에 jaw-gradient sweep 애니메이션이 동작
2. 6개 서브페이지(install/workflow/tools/settings/lineage) 모두 사이드바 네비로 연결
3. EN/KO 토글이 모든 `data-i18n` 요소를 교체
4. README에 Pages 링크 배지, 3경로 설치 가이드, 5카테고리 도구 목록이 포함
5. `.github/workflows/deploy-docs.yml`이 유효한 Actions workflow (trigger: push main/dev, publish: docs-site/)
6. OG image + favicon 파일 존재, `<head>`에 링크
7. 반응형 1024/768/375px 레이아웃 깨지지 않음
8. tools.html 도구 수 = README 도구 수
9. ko.json 키 수 = en.json 키 수, k-writing 규칙 적용
10. settings.html에 config.yml 예시 포함