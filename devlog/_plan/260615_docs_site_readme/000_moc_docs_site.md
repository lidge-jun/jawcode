# Jawcode Docs Site + README Overhaul

## 배경

Jawcode의 공개 배포 준비를 위해 README 보강, GitHub Pages 사이트, 개발자 문서를 구축한다.
cli-jaw의 `public/` 프론트엔드(React manager, oklch 디자인 시스템, 4언어 i18n)를 벤치마크로 참조.

## 참조 소스

| 참조 | 위치 | 참조 대상 |
|---|---|---|
| cli-jaw CSS | `~/Developer/new/700_projects/cli-jaw/public/css/variables.css` | oklch 색상, spacing, typography, transition presets |
| cli-jaw index | `~/Developer/new/700_projects/cli-jaw/public/index.html` | 레이아웃 패턴 |
| cli-jaw shark.svg | `~/Developer/new/700_projects/cli-jaw/public/assets/shark.svg` | 로고 SVG |
| Claude Code | `code.claude.com` | 미니멀 다크 랜딩 |
| Codex CLI | `github.com/openai/codex` README | 개발자 README 패턴 |

## 인터뷰 결과

| 항목 | 결정 |
|---|---|
| GitHub Pages 범위 | 랜딩 + 다중 페이지 문서 (설치, 워크플로우, 도구, 설정, lineage) |
| TUI 시각 자료 | **조합**: 랜딩 히어로는 welcome.ts gradient+sweep HTML/CSS 재현, 데모는 asciinema 임베드 |
| README 데모 | SVG 터미널 렌더 (asciinema + svg-term-cli → 정적 SVG) |
| 설치 절차 | npm + bun + 소스 빌드 세 경로 |
| npm 배포 | main 머지 시 자동 publish — 이 작업이 배포 전 마지막 폴리싱 |
| 사이트 소스 | gh-pages 브랜치에 정적 HTML |
| 배포 방식 | GitHub Actions 자동 |
| 디자인 참조 | cli-jaw oklch 디자인 시스템 + Claude Code 미니멀 다크 + Codex README |
| 테마 | **네온 블루 + 블랙** — abyss-bite 테마 일관. oklch accent hue 200 |
| 언어 | 영어 메인 + JS 토글 한국어 (단일 페이지, JSON locale) |
| 콘텐츠 우선순위 | 랜딩 → 설치 → 워크플로우 → 도구 (전체 동시) |
| 커스텀 도메인 | 초기 GitHub 기본, 안정화 후 결정 |
| Welcome banner | welcome.ts gradient + sweep를 HTML/CSS 재현 → 사이트 히어로 |
| 네비게이션 | 랜딩은 단일 페이지 스크롤, 문서는 사이드바 네비 |
| dev-frontend skill | `anti-slop.md`, `aesthetics.md`, `layout-discipline.md`, `responsive-viewport.md` 참조 |
| dev-uiux-design skill | `design-isms.md`, `product-personalities.md`, `color-system.md`, `favicon-logo.md` 참조 |
| k-writing | `ux-writing-ko.md` (dev-frontend) + cli-jaw AGENTS.md §Korean intent guard. 한국어 번역 시 직역에 가깝되 자연스럽게. 관료적 한자어 회피, 사용자 행동 중심 카피, 도메인별 톤 적용 |
| cli-jaw 런타임 참조 | `~/.cli-jaw-3463/AGENTS.md`, `~/.cli-jaw-3463/skills/dev/SKILL.md`. 실제 운영 중인 에이전트 인스턴스의 라이팅 규칙 |

## 사이트 구조

```
docs-site/
├── index.html              # 랜딩 페이지
├── install.html             # 설치 가이드 (npm/bun/source)
├── workflow.html            # IPABCD 워크플로우 가이드
├── tools.html               # 40+ 도구 레퍼런스
├── lineage.html             # 업스트림 히스토리
├── assets/
│   ├── style.css            # 네온 블루 + 블랙 테마
│   ├── tui-mockup.css       # TUI HTML 목업 스타일
│   ├── jawcode-logo.png     # 상어 jaw 로고
│   └── demo.cast            # asciinema 녹화
├── ko/                      # 한국어 번역
│   ├── index.html
│   ├── install.html
│   └── ...
└── CNAME                    # 커스텀 도메인 (향후)
```

## 랜딩 페이지 구성

### 히어로 섹션
- 로고 (네온 블루 상어 jaw)
- "Encode intention. Decode software."
- 설치 원라이너: `npm install -g jawcode`
- HTML 목업: TUI 터미널 창 + 타이핑 애니메이션 (IPABCD 진행 시연)

### IPABCD 파이프라인 섹션
- 인터랙티브 다이어그램 (I → P → A → B → C → D)
- 각 단계 hover/클릭 시 설명 표시
- CSS 트랜지션으로 데이터 흐름 시각화

### 도구 갤러리
- 14 Essential + 22 Discoverable 도구 카드
- 카테고리별 필터 (search, edit, automation, debugging)

### 데모 섹션
- asciinema player 임베드
- 실제 jaw-interview → plan → build 세션 녹화

### 설치 섹션
- 3 탭: npm / bun / source
- 각 탭에 코드 블록 + 복사 버튼

### Lineage
- gajae-code → oh-my-pi → oh-my-codex → oh-my-claudecode 계보 다이어그램

## 디자인 시스템

**→ `010_design_language.md`가 유일한 권위 (Abyss Bite).** 이 섹션의 이전 색상/타이포/TUI 목업 정의는 삭제 — 010과 충돌했음.

## 기술 결정

| 결정 | 선택 | 근거 |
|---|---|---|
| CSS | Vanilla CSS + Custom Properties | 010에 정의된 토큰 직접 사용. Tailwind 불필요 |
| JS | Vanilla `<script>` | 번들러 불필요. i18n 토글 + tab 전환 정도 |
| 폰트 로딩 | Google Fonts CDN (display=swap) | Chakra Petch + Outfit + JetBrains Mono |
| Astro | **보류** — 초기 정적 HTML. 10+ 페이지 넘으면 Starlight 검토 |
| SVG 데모 | `asciinema rec` → `svg-term-cli` → `artifacts/demos/*.svg` |

## 페이지별 콘텐츠 스펙

### index.html (랜딩)
1. **Hero**: jaw-gradient + 로고(네온 글로우) + "Encode intention. Decode software." + 설치 원라이너 + TUI mockup(welcome banner CSS 재현)
2. **IPABCD Pipeline**: hover 시 각 단계 설명:
   - I: "Socratic requirements gathering with ambiguity scoring"
   - P: "Consensus planning with critic revision loop"
   - A: "Independent planner + architect audit"
   - B: "Direct implementation with adversarial verifier"
   - C: "Mechanical gates + adversarial review + 3-way reject"
   - D: "Summary, WONDER+REFLECT, cycle close"
3. **Tool Gallery**: 5 카테고리(Search/Edit/Execute/Orchestrate/Observe) 카드
4. **Demo**: SVG 임베드 또는 asciinema player
5. **Install**: 3탭 (npm/bun/source)
6. **Lineage**: gajae-code → oh-my-pi/codex/claudecode 가계도

### install.html
- npm: `npm install -g jawcode` + Node ≥18
- bun: `bun packages/jwc/bin/jwc.js`
- source: `git clone` → `bun install` → `bun run install:defaults`
- 검증: `jwc --version`, `jwc --smoke-test`

### workflow.html
- IPABCD 6단계 상세 (목적, 입출력, 게이트 조건, 예시 명령)
- HITL vs HOTL 설명
- 워크플로우 라우팅 테이블

### tools.html
- 40+ 도구를 5 카테고리로 (Search/Edit/Execute/Orchestrate/Observe)
- 각: 이름, 설명, essential/discoverable, 예시 1개

### lineage.html
- 업스트림 가계도 타임라인
- @gajae-code/* 네임스페이스 설명

## 반응형 스펙

| 컴포넌트 | Desktop (≥1024) | Tablet (768-1023) | Mobile (<768) |
|---|---|---|---|
| Hero | 좌 텍스트 + 우 mockup | 스택 | 스택, text-3xl |
| IPABCD | 가로 6단계 | 2행 3열 | 세로 스택 |
| Tool cards | 3열 | 2열 | 1열 + Show more |
| Nav | 상단 고정 | 햄버거 | 햄버거 + 드로어 |

## i18n 스펙

- `locales/en.json`, `locales/ko.json` — 키: `hero.title`, `nav.install`, `ipabcd.i.desc` 등
- 토글: 상단 nav 우측 EN/KO 버튼
- `data-i18n` 속성 → JS fetch + DOM 교체
- 코드 블록은 번역 안 함

## OG/Meta/Favicon

- Favicon: 32/192/512px
- OG: 1200x630, 로고 + 태그라인, 검정 배경
- Meta description: "Jawcode — encode intention, decode software."

## README 변경 사항

1. SVG 터미널 데모 (Phase 50 전에는 "▶ Watch demo" 링크)
2. 설치 가이드 3경로 `<details>` 접이식
3. GitHub Pages 링크 배지
4. Tool inventory 5 카테고리 그룹핑
5. IPABCD 각 단계 한 줄 설명 추가

## Phase

- [x] 10: 인터뷰/요구사항 확정
- [x] 11: 디자인 언어 (010_design_language.md)
- [x] 12: 서브에이전트 감사 + BLOCK 해소
- [ ] 20: README 개선
- [ ] 30: 랜딩 페이지 HTML/CSS
- [ ] 40: 서브페이지 (install/workflow/tools/lineage)
- [ ] 50: asciinema 데모 + svg-term
- [ ] 60: 한국어 번역
- [ ] 70: gh-pages + GitHub Actions
- [ ] 80: OG image + favicon + meta