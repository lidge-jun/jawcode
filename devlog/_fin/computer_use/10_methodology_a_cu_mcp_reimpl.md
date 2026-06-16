# 10 — 방법론 A: cu-mcp 재구현 (좌표/스크린샷 기반)

> 상태: ✅ **jawcode에서 엔드투엔드 작동 확인** (grok-4.3, 260613).

## 정체

`~/developer/codex/23_computer_use/src/`의 **Sky 기술 재구현**. OpenAI 정품이 아니라 같은 목적
(macOS 데스크톱 제어)을 **좌표/스크린샷 기반**으로 다시 구현한 것 — Anthropic/Claude computer-use
도구 스타일에 가깝다(스크린샷 픽셀 좌표로 클릭).

- `cu-mcp-server/` — TypeScript MCP stdio 서버(`@modelcontextprotocol/sdk`), `dist/index.js` 빌드됨,
  `node dist/index.js`로 실행. 29 도구 등록(mouse 9·keyboard 3·screenshot 3·scroll 1·app 3·
  clipboard 2·batch 1·utility 2·teach 3·inspect 2).
- `cu-native/` — Swift 네이티브 제어층(`SwiftPM`). MCP 서버의 `native.js`가
  `.build/release/cu-native`를 `execFile`로 호출해 실제 마우스/키보드/스크린샷 수행.
- 머신 단위 락 `~/.claude/computer-use.lock` (동시 1세션).

## 도구 (29종)

`left_click`·`double_click`·`triple_click`·`right_click`·`middle_click`·`left_click_drag`·
`mouse_move`·`left_mouse_down`·`left_mouse_up`·`type`·`key`·`hold_key`·`screenshot`·`zoom`·
`switch_display`·`scroll`·`open_application`·`request_access`·`list_granted_applications`·
`read_clipboard`·`write_clipboard`·`computer_batch`·`wait`·`cursor_position`·`request_teach_access`·
`teach_step`·`teach_batch`·`inspect`·`ax_press`.

## jawcode 등록

`~/.jwc/agent/mcp.json` (user 스코프 — builtin discovery가 `~/.jwc/agent/{mcp.json,.mcp.json}` 스캔):

```json
{ "mcpServers": { "computer-use": {
  "transport": "stdio",
  "command": "/Users/jun/.nvm/versions/node/v24.14.1/bin/node",
  "args": ["/Users/jun/developer/codex/23_computer_use/src/cu-mcp-server/dist/index.js"],
  "env": { "CU_TIER_OVERRIDE": "full" }
} } }
```

> ⚠️ `command`는 **node 절대경로**. jwc는 bun으로 도는데 nvm node가 PATH에 없어 `"node"`만 쓰면
> spawn ENOENT 가능. node 스크립트라 spawn+연결이 250ms startup 윈도(방법론 B 블로커 참조) 안에
> 들어와 jawcode가 정상 로드한다.

## full-tier 오버라이드 (jwc 개인 사용) ✅ 적용·검증

cu-mcp는 기본적으로 **결정론적 tier**를 서버에서 강제한다(브라우저=read, 터미널/IDE=click, trading=read,
media=차단, 그 외=full — `safety/tiers.ts` `categoryToTier`). env·옵션 오버라이드는 원래 **없었다**.

개인 머신의 jwc는 한계 없이 전부 full이 필요하므로 **env 게이트**를 추가:

- `safety/tiers.ts`에 `isFullTierOverride()`(= `process.env.CU_TIER_OVERRIDE === "full"`) 신설.
  `categoryToTier` 맨 앞에서 true면 **모든 카테고리(미디어 포함) → "full"** 반환. 단일 지점이라
  request_access 부여(`app.ts:96`)와 매 액션 `enforcePreAction`/`enforcePointUnderClick`이 동시에 풀린다.
- `app.ts`의 `tierGuidance` 응답도 오버라이드 시 메시지 전환.
- **시스템 키콤보(⌘Q·⌘Tab·Spotlight·강제종료·잠금)는 별개** — `isSystemKeyCombo`로 여전히 차단되며
  `request_access`의 `systemKeyCombos` 그랜트로만 풀림(tier와 무관).

**왜 글로벌 패치가 아니라 env 게이트인가**: 기본값(env 미설정)은 안전 tier를 유지해 cli-jaw 멀티-프로바이더
호스트가 **safe-by-construction**으로 남는다([50](./50_two_tier_routing_synctoall.md)). jwc만
`~/.jwc/agent/mcp.json`의 `env`로 켠다.

**검증(A/B, 260613)**: Safari(브라우저)에 `request_access` —
- `CU_TIER_OVERRIDE=full` → `tier:"full"` (+ guidance "all apps granted full tier")
- env 없음 → `tier:"read"`

## 선결 수정 2건

1. **스키마 `$ref` 버그 (provider 400)** — `cu-mcp-server/src/tools/mouse.ts`의 `coordinateSchema`
   zod 튜플 인스턴스를 `coordinate`·`start_coordinate` 두 속성이 **공유** → JSON Schema 직렬화 시
   두 번째가 `$ref:"#/properties/coordinate/items/0"`로 디둡되는데, `coordinate`는 `prefixItems`
   (튜플)라 `items`가 없어 **해석 불가** → OpenAI·xAI 둘 다 `400 Schema validation failed`로
   전체 도구 요청 거부. **수정**: `coordinateSchema`를 const → **팩토리 함수**(`() => z.tuple(...)`)로
   바꿔 속성마다 독립 인스턴스 → `$ref` 미발생. `npm run build`로 dist 갱신.
2. **cu-native release 바이너리 부재** — `native.js`가 `.build/release/cu-native`를 하드코딩하는데
   debug만 빌드돼 있어 `spawn ENOENT`. macOS CLT의 `swift build -c release`가 깨져(BuildServerProtocol
   누락) release 빌드 불가 → **debug 바이너리를 release 경로로 복사**(`cp .build/debug/cu-native
   .build/release/cu-native`). 동일 arm64 Mach-O, 동작 동일(최적화만 차이).

## 실증 (grok-4.3, 헤드리스)

```
jwc -p --model xai/grok-4.3 "Call ONLY 'cursor_position' once and report x,y verbatim."
→ 264.2421875 25.49609375    # 실제 macOS 커서 좌표
```

전체 체인: grok-4.3 → jawcode 세션 → `mcp__computer-use_cursor_position` → cu-mcp-server →
cu-native Swift → 실제 커서 → grok 보고. `list_granted_applications`는 `0`(접근권한 부여 앱 없음 —
정상 상태). 400 스키마 에러 해소 후 도구 호출 성공.

## 평가

- 장점: jawcode에서 **지금 작동**. 비전 가능한 모델이면 모델 무관.
- 단점: OpenAI 정품 아님(재구현). 좌표 기반이라 AX-트리 기반(`get_app_state`)보다 정밀도·견고성
  낮을 수 있음. macOS Accessibility/Screen Recording 권한 필요(앱별 1회 부여).
