---
kind: "skill-fragment"
name: catalog-discovery-axes
description: "Design/UX-first 7-axis option ontology for Catalog Discovery pre-topology mode. Port from pabcd_initiative canonical (adapted, not blind-copied). Loaded by jaw-interview Phase 1.5."
---

# Catalog Discovery — Option Ontology (design/UX-first)

Port from `pabcd_initiative/skills/dev-pabcd/references/catalog-discovery.yaml`.
Adapted to jawcode `.md` skill-fragment convention (no `.yaml` in skills/).

## Load-bearing invariant

Design/UX LEADS. `axis_order` is ascending by stage; Stage 1 (design) is asked FIRST,
Stage 2 (domain) second, Stage 3 (feature/data/security/ops/cost) entries DERIVE from
Stage 1+2 answers. A conforming consumer MUST NOT present a stage until every `required`
entry of all earlier stages is answered.

## Design methodology

Primary: **Product-Personality-Selection** (dev-uiux-design §1).
Followups: Korean-adjective→token (§3), Reference Discovery (§1 Step 6), Design Read (§2).

## Axis order

| Stage | Axis | Label (ko) | Derived? |
|---|---|---|---|
| 1 | design | 디자인/UX | No — asked FIRST |
| 2 | domain | 앱 유형 | No |
| 3 | feature | 기능 | Yes |
| 3 | data | 데이터 | Yes |
| 3 | security | 보안/개인정보 | Yes |
| 3 | ops | 운영/자동화 | Yes |
| 3 | cost | 비용/복잡도 | Yes |

## Stage 1 — Design dials (all required)

### design.mood (분위기)
First impression and emotional temperature.
Options:
- **friendly** (친근하고 따뜻한) — 접근성↑ 신뢰감은 별도 장치 필요 → warm palette / rounded
- **refined** (세련되고 프리미엄) — 고급감↑ 캐주얼한 친밀감↓ → muted palette / sharp
- **mystical** (신비롭고 몰입적) — 테마 몰입↑ 정보 명료성 주의 → dark cosmic palette

### design.lightness (밝기)
Base tone: light (paper book in daylight) vs dark (neon at night).
Options:
- **light** (밝은 모드) — 가독성·정돈감↑ → bg-white / text-gray-900
- **dark** (어두운 모드) — 몰입·피로도↓, 대비 설계 필요 → bg-gray-950 / text-gray-100

### design.density (정보 밀도)
How much fits on one screen: museum (spacious) vs cockpit (dense).
Options:
- **spacious** (여유롭게) — 초보 친화↑ 스크롤↑ → py-8 / gap-8 (D1-D3)
- **dense** (정보 밀집) — 숙련자 효율↑ 첫인상 복잡 → py-1 / gap-1 (D4-D8)

### design.shape (모서리 곡률)
Corner roundness: sharp (structural) vs soft (friendly).
Options:
- **rounded** (둥근 형태) — 친근함↑ → rounded-2xl (16px+)
- **sharp** (각진 형태) — 정밀·기술감↑ → rounded-none/md (0-6px)

### design.typography (글꼴 스타일)
Typeface character: serif (literary depth) vs sans (reliable legibility).
Options:
- **serif** (명조/서예체) — 감성·깊이↑ 좁은 화면 가독성 주의 → Serif display
- **sans** (고딕체) — 가독성 안정↑ 전통미↓ → Pretendard/sans

### design.motion (인터랙션 감도)
Motion feel: spring (premium) vs instant (fast/clear).
Options:
- **spring** (부드러운 스프링) — 고급감↑ 체감 속도↓ → spring easing
- **instant** (즉각 반응) — 속도·명료성↑ 감성↓ → instant/linear

## Stage 2 — Domain types

| id | Label (ko) | implies |
|---|---|---|
| domain.content_service | 콘텐츠 서비스 | (none) |
| domain.marketplace | 마켓플레이스 | feature.payments, security.auth |
| domain.dashboard | 대시보드 | security.auth |
| domain.booking | 예약 | feature.notifications, ops.scheduled_jobs |
| domain.community | 커뮤니티 | data.user_generated, ops.admin_review, security.auth |
| domain.ai_agent | AI 에이전트 | cost.infra_complexity |
| domain.internal_tool | 내부 도구 | security.auth |

## Stage 3 — Derived entries

Each carries `derived_from` (stage 1/2 ids) and optional `auto_activate_rules` (keywords
scanned against the user's initial idea text).

| id | axis | derived_from | auto_activate_rules | risk | cost |
|---|---|---|---|---|---|
| security.pii_protection | security | domain.content_service | 생년월일, birth, 사주, personal | high | 2 |
| security.auth | security | marketplace, dashboard, booking, community, internal_tool | 로그인, 회원, login | medium | 2 |
| data.retention_policy | data | security.pii_protection | 탈퇴, 파기, retention | high | 1 |
| data.user_generated | data | domain.community | 게시판, 리뷰, 댓글 | medium | 2 |
| feature.payments | feature | domain.marketplace | 결제, 구매, payment | high | 3 |
| feature.notifications | feature | domain.booking, domain.content_service | 알림, notification | low | 2 |
| ops.scheduled_jobs | ops | feature.notifications, data.retention_policy | cron, 매일, 정기 | low | 2 |
| ops.task_queues | ops | ops.scheduled_jobs | — | low | 2 |
| ops.admin_review | ops | data.user_generated, domain.community | — | medium | 2 |
| cost.infra_complexity | cost | domain.ai_agent, feature.payments, ops.scheduled_jobs | — | medium | 3 |
