# Jawcode Design Language — "Abyss Bite"

## Essence

**Deep-ocean predator UI.** 순수 블랙 심해에서 네온 시안 글로우가 떠오르고, 바이트 오렌지가 액센트로 물든다. 터미널 네이티브 코딩 에이전트의 정밀함과 상어의 날카로움이 결합.

Product personality 기준: **Linear DNA + Vercel의 모노크롬 절제 + 고유한 cyan glow 시그니처**.

```yaml
essence: "Abyss precision — deep-ocean dark, cyan-glow accented, bite-orange as danger/action"
design_ism: "Dark Swiss + Terminal Native"
density: developer-console
motion: feedback-only (no cinematic)
asset_need: SVG terminal renders, logo, IPABCD diagrams
soft_3d_gate: not-allowed
```

## Color Palette

### Primary — abyss-bite 테마 직역

```css
:root {
  /* ── Abyss depths ── */
  --ink:            #0a0d12;    /* 가장 깊은 배경 */
  --mantle:         #0e131b;    /* 카드/패널 배경 */
  --surface:        #14202c;    /* 활성 영역 */
  --surface-bright: #1b2c3c;    /* hover/selected */

  /* ── Cyan glow spectrum ── */
  --accent:         #00d1da;    /* 주 액센트 — claw */
  --glow:           #00e5f2;    /* 하이라이트/네온 */
  --coral:          #2fc4ce;    /* 세컨더리 시안 */
  --seafoam:        #7de0d3;    /* 디에셋 시안 */

  /* ── Bite orange ── */
  --bite:           #ff5a2e;    /* CTA/위험/브랜드 레드 */
  --sand:           #ffd7a8;    /* 따뜻한 하이라이트 */

  /* ── Text ── */
  --text:           #dfeef2;    /* foam — 메인 텍스트 */
  --text-muted:     #8fa6b2;    /* 서브 텍스트 */
  --text-dim:       #54707e;    /* 비활성 */

  /* ── Semantic ── */
  --success:        #6ee7b7;    /* kelp */
  --error:          #ff4d5e;    /* danger red */
  --warning:        #ffd34d;    /* amber */

  /* ── Border ── */
  --border:         #14405e;    /* deep teal border */
  --border-accent:  #ff5a2e;    /* bite border */
  --border-muted:   #54707e;    /* dim border */
}
```

### Welcome Banner Gradient (CSS 재현)

TUI `welcome.ts`의 JAW_GRADIENT_STOPS를 CSS로:

```css
.jaw-gradient {
  background: linear-gradient(
    135deg,
    #0f2a43 0%,      /* abyss navy */
    #13647f 25%,     /* deep teal */
    #00b6be 50%,     /* cyan glow */
    #00d1da 70%,     /* bright cyan */
    #ff6a3d 100%     /* bite orange tip */
  );
}

/* Sweep/shine animation */
@keyframes jaw-sweep {
  0%   { background-position: 200% 0; }
  100% { background-position: -200% 0; }
}
.jaw-gradient-animated {
  background-size: 200% 100%;
  animation: jaw-sweep 3s ease-in-out infinite;
}

/* Neon glow effect (로고 주변) */
.neon-glow {
  filter: drop-shadow(0 0 20px rgba(0, 209, 218, 0.4))
          drop-shadow(0 0 60px rgba(0, 209, 218, 0.15));
}
```

## Typography

```css
:root {
  /* Display — 랜딩 히어로 */
  --font-display: 'Chakra Petch', 'Outfit', system-ui, sans-serif;

  /* UI body */
  --font-ui: 'Outfit', 'Pretendard', 'Noto Sans KR', system-ui, sans-serif;

  /* Code */
  --font-mono: 'JetBrains Mono', 'SF Mono', 'Fira Code', monospace;
}

/* Scale */
--text-xs:  11px;
--text-sm:  13px;
--text-base: 16px;
--text-lg:  19px;
--text-xl:  22px;
--text-2xl: 26px;
--text-3xl: 34px;
--text-4xl: 48px;   /* hero only */
--text-5xl: 64px;   /* hero only, desktop */
```

cli-jaw와 동일한 폰트 스택. `Chakra Petch`는 display 전용 — 기하학적, 테크 느낌, 상어 이빨 날카로움.

## Spacing

```css
/* 4px base scale (cli-jaw 동일) */
--space-1: 4px;   --space-2: 8px;   --space-3: 12px;
--space-4: 16px;  --space-5: 20px;  --space-6: 24px;
--space-8: 32px;  --space-10: 40px; --space-12: 48px;
```

## Radius

```css
--radius-sm: 4px;     /* 버튼, 인풋 */
--radius-md: 8px;     /* 카드 */
--radius-lg: 12px;    /* 패널, 모달 */
--radius-xl: 16px;    /* 히어로 TUI 목업 */
```

## Transitions

```css
--ease-out-expo: cubic-bezier(0.16, 1, 0.3, 1);
--ease-spring: cubic-bezier(0.34, 1.56, 0.64, 1);
--duration-fast: 150ms;
--duration-base: 250ms;
--duration-slow: 400ms;
```

## Component Signatures

### TUI Terminal Mockup

```css
.tui-mockup {
  background: var(--ink);
  border: 1px solid var(--border);
  border-radius: var(--radius-xl);
  box-shadow:
    0 0 30px rgba(0, 209, 218, 0.08),   /* subtle cyan ambient */
    0 4px 24px rgba(0, 0, 0, 0.6);       /* depth */
  font-family: var(--font-mono);
  font-size: var(--text-sm);
  line-height: 1.5;
  color: var(--text);
  padding: var(--space-6);
  position: relative;
  overflow: hidden;
}

/* Window dots */
.tui-mockup::before {
  content: '';
  display: flex;
  gap: 6px;
  margin-bottom: var(--space-4);
}
.tui-mockup .dot {
  width: 10px; height: 10px; border-radius: 50%;
}
.tui-mockup .dot-red    { background: #ff5f56; }
.tui-mockup .dot-yellow { background: #ffbd2e; }
.tui-mockup .dot-green  { background: #27c93f; }
```

### Code Block

```css
.code-block {
  background: var(--mantle);
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  padding: var(--space-4);
  font-family: var(--font-mono);
  font-size: var(--text-sm);
  color: var(--text);
  overflow-x: auto;
}
```

### Install Tab Button

```css
.tab-button {
  background: transparent;
  border: 1px solid var(--border-muted);
  border-radius: var(--radius-sm);
  color: var(--text-muted);
  padding: var(--space-2) var(--space-4);
  font-family: var(--font-mono);
  font-size: var(--text-sm);
  cursor: pointer;
  transition: all var(--duration-fast) var(--ease-out-expo);
}
.tab-button.active {
  background: var(--surface);
  border-color: var(--accent);
  color: var(--accent);
}
```

### CTA Button

```css
.cta-primary {
  background: var(--accent);
  color: var(--ink);
  border: none;
  border-radius: var(--radius-sm);
  padding: var(--space-3) var(--space-6);
  font-family: var(--font-ui);
  font-weight: 600;
  cursor: pointer;
  transition: all var(--duration-fast) var(--ease-out-expo);
}
.cta-primary:hover {
  background: var(--glow);
  box-shadow: 0 0 20px rgba(0, 229, 242, 0.3);
}
```

### IPABCD Step Badge

```css
.step-badge {
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-1) var(--space-3);
  border-radius: var(--radius-sm);
  font-family: var(--font-mono);
  font-size: var(--text-xs);
  font-weight: 600;
  text-transform: uppercase;
}
.step-i { background: #1a2a4a; color: #60a5fa; border: 1px solid #2a3a5a; }
.step-p { background: #2a1a3a; color: #a78bfa; border: 1px solid #3a2a4a; }
.step-a { background: #1a2a2a; color: #34d399; border: 1px solid #2a3a3a; }
.step-b { background: #2a2a1a; color: #fbbf24; border: 1px solid #3a3a2a; }
.step-c { background: #2a1a1a; color: #f87171; border: 1px solid #3a2a2a; }
.step-d { background: #1a2a3a; color: #38bdf8; border: 1px solid #2a3a4a; }
```

## Anti-Slop Checklist (dev-frontend 기반)

- [ ] 제네릭 gradient hero 없음 — jaw-gradient 사용
- [ ] 제네릭 stock illustration 없음 — TUI mockup + SVG diagram만
- [ ] 3-col 카드 반복 없음 — 섹션별 다른 레이아웃
- [ ] 과도한 emoji 없음
- [ ] "Learn more" 같은 제네릭 CTA 없음 — 구체적 행동 명시
- [ ] 모바일에서 hero 텍스트 3xl 초과 없음
- [ ] serif 폰트 사용 없음
- [ ] 단순 dark mode inversion 없음 — abyss-bite 전용 팔레트 사용

## Layout Rules

- Hero: jaw-gradient 배경 + 로고 + headline + 설치 원라이너 + TUI mockup
- 각 섹션 레이아웃 중복 금지 (layout-discipline.md §Section Layout Repetition Ban)
- zigzag 연속 2회 cap
- 페이지 containment: `max-w-[1400px] mx-auto`
- 반응형 필수: desktop(≥1024) / tablet(768-1023) / mobile(<768)

## Logo Usage

- 로고 파일: `artifacts/logos/jawcode-logo.png`
- 네온 블루 글로우 상어 jaw — 검정 배경 전용
- 밝은 배경 시 글로우 제거 or 단색 버전 필요
- 최소 크기: 32px (favicon), 권장: 64-200px
- 로고 주변 여백: 로고 높이의 25% 이상
