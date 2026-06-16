# 60 — CU 리팩터링 계획: MCP Tax 제거 + cua-driver + cli-jaw 이식

> 상태: ✅ **Phase 1-3 구현 완료**.
> - Phase 1: `consolidated.ts` 구현 (`f63b0c50d`), Sonnet dev 검증 PASS, `CU_MCP_MODE=consolidated` 활성화
> - Phase 2: cua-driver 0.5.3 설치 (`~/.local/bin/cua-driver`, 36도구), 두 번째 MCP 서버로 등록
>   (Option B — 직접 노출, 어댑터 불필요). cu-mcp(포그라운드) + cua-driver(백그라운드) 양립.
> - Phase 3: `~/.jwc/agent/settings.json` 생성, `mcp.enableProjectConfig: true`. discoveryMode는
>   consolidated 1도구(~3K)로 충분해 기본 off — 필요 시 `mcp.discoveryMode: true`로 Tax 0 가능.
> - cli-jaw는 defer (`2e91473e` revert). jwc 안정화 후 재장착.

## 한 줄 결론

hermes의 **통합 도구 패턴**(29→1, ~91% 토큰 절감) + **cua-driver 백엔드**(백그라운드, element_index
클릭) + jwc **지연 로딩**(이미 구현된 `tools.discoveryMode`) 조합으로, MCP Tax 33K→0, 포그라운드→
백그라운드, 픽셀→요소 클릭을 달성한다.

---

## Phase 1: 통합 도구 (29→1) — MCP Tax 33K → ~3K

### 왜

cu-mcp 29개 도구의 JSON schema가 **매 요청 33K 토큰**을 먹음. CU 안 쓸 때도 AGENTS.md §7 "MCP Tax"에
해당. hermes는 **1개 `computer_use` 도구 + `action` discriminator**로 ~2.8K 토큰.

### 매핑 (29 도구 → 22 action)

| # | 현재 도구 | action | 비고 |
|---|---|---|---|
| 1 | `screenshot` | `capture` | `mode` 파라미터 추가 (screenshot/zoom) |
| 2 | `zoom` | `capture` + `region` | capture에 합침 |
| 3 | `switch_display` | `switch_display` | 그대로 |
| 4-8 | `left/double/triple/right/middle_click` | `click` | `button`+`count`로 통합 |
| 9 | `left_click_drag` | `drag` | 그대로 |
| 10 | `mouse_move` | `mouse_move` | 그대로 |
| 11-12 | `left_mouse_down/up` | `mouse_down`/`mouse_up` | 그대로 |
| 13 | `scroll` | `scroll` | 그대로 |
| 14 | `type` | `type` | 그대로 |
| 15 | `key` | `key` | 그대로 |
| 16 | `hold_key` | `hold_key` | 그대로 |
| 17 | `open_application` | `open_app` | 리네임 |
| 18 | `request_access` | `request_access` | 그대로 |
| 19 | `list_granted_applications` | `list_apps` | 리네임 |
| 20-21 | `read/write_clipboard` | `clipboard_read`/`clipboard_write` | 리네임 |
| 22 | `wait` | `wait` | 그대로 |
| 23 | `cursor_position` | `cursor_position` | 그대로 |
| 24 | `inspect` | `inspect` | 그대로 |
| 25 | `ax_press` | `ax_press` | 그대로 |
| 26 | `computer_batch` | `batch` | nested actions 배열 |
| 27-29 | `teach_*` (3종) | 삭제 | 항상 에러 반환 스텁 |

### 토큰 추정

| 모드 | 도구 수 | 토큰 |
|---|---|---|
| 현재 (29 개별) | 29 | **~33,000** |
| 통합 (1 도구) | 1 | **~2,800** |
| **절감** | | **~30,200 (91%)** |

### 구현 방식

`src/tools/computer_use.ts` 신규 — 1개 도구 등록 + action→handler dispatch (기존 핸들러 재활용).
`--consolidated` 플래그 또는 `CU_MCP_MODE=consolidated` env로 양립 가능.

```typescript
// 통합 스키마 (zod)
z.object({
  action: z.enum(["capture","click","drag","mouse_move",...]),
  coordinate: coordinateSchema().optional(),
  button: z.enum(["left","right","middle"]).optional(),
  count: z.union([z.literal(1),z.literal(2),z.literal(3)]).optional(),
  text: z.string().optional(),
  // ...모든 파라미터를 하나의 flat object에
})
```

hermes 참조: `~/Developer/codex/hermes-agent/tools/computer_use/schema.py`

### element 클릭 (SoM 준비)

통합 도구에 `element: number` 파라미터를 추가해두면 Phase 2에서 cua-driver 연결 시 바로 활용 가능.
Phase 1에서는 element 클릭이 아직 불가(cu-native는 AX element_index 미지원)하므로 coordinate 기반 유지.

---

## Phase 2: cua-driver 백엔드 — 포그라운드 → 백그라운드

### 왜

| | cu-native (현재) | cua-driver |
|---|---|---|
| 제어 | **포그라운드** — CGEvent, 커서/포커스 빼앗음 | **백그라운드** — SkyLight SPI, 커서 안 건드림 |
| 클릭 | 픽셀 좌표 전용 | `element_index` + 픽셀 좌표 양립 |
| 멀티모니터 | 복잡한 디스플레이 감지 필요 (우리가 3커밋 패치) | `window_id` 기반, 디스플레이 무관 |
| AX 트리 | `inspect` 단일 포인트 hit-test만 | `get_window_state` → 전체 AX 트리 + element 목록 |
| SoM | 없음 | 프론트엔드에서 element 목록으로 구현 가능 |

### cua-driver란

**trycua/cua** 프로젝트의 `cua-driver` — **OpenAI Sky와 동일한 SkyLight private SPI 기반** 백그라운드
데스크톱 제어. Sky와의 차이: **parent 코드서명 attestation 없음** (codex 트리 밖에서도 실행 가능).

- 설치: `/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/trycua/cua/main/libs/cua-driver/scripts/install.sh)"`
- 실행: `cua-driver mcp` (MCP stdio)
- SkyLight SPI 8종: `SLEventPostToPid`, `SLPSSetFrontProcessWithOptions`, `SLPSPostEventRecordTo`,
  `_AXObserverAddNotificationAndCheckRemote` 등. macOS 업데이트에 깨질 수 있음 → 버전 고정 권장.

hermes 참조: `~/Developer/codex/hermes-agent/tools/computer_use/cua_backend.py`

### SoM (Set-of-Mark) 흐름

1. `get_window_state(pid, window_id)` → AX 트리 마크다운(element [N] 태그) + JPEG 스크린샷
2. hermes가 `_parse_elements_from_tree()`로 UIElement 목록 추출
3. 모델에 이미지 + element 목록 반환 → 모델이 번호 지정
4. `click(pid, element_index=N, window_id)` → cua-driver가 내부적으로 AX 트리 재탐색 → 좌표 계산 → SkyLight 클릭

**cua-driver는 시각적 번호 오버레이를 그리지 않음** — element 번호는 AX 트리 텍스트의 인덱스.
hermes의 "SoM"은 개념적으로 AX 트리 인덱스 = 마크.

### 교체 전략

**Option A (권장) — adapter 레이어**: cu-mcp의 도구 API(통합 도구) 유지, `native.ts`만 cua-driver
MCP 클라이언트로 교체. safety/tier/enforcement 레이어 유지.

**Option B — cua-driver 직접 노출**: `cua-driver mcp`를 직접 MCP 서버로 등록. cu-mcp 불필요.
단 safety/tier/enforcement가 없어짐.

### SkyLight SPI 안정성

| SPI | 위험도 | 비고 |
|---|---|---|
| `SLEventPostToPid` | 낮음 | macOS 10.6+, 안정 |
| `SLPSSetFrontProcessWithOptions` | 낮음 | 10.x-15.x 안정 |
| `SLPSPostEventRecordTo` | **높음** | 248바이트 구조체, 문서화 안 됨 |
| `_AXObserverAddNotificationAndCheckRemote` | **높음** | `_` prefix, 메이저 업데이트에 깨질 수 있음 |

완화: `HERMES_CUA_DRIVER_VERSION=0.5.0` 고정 + OS 업데이트 후 `cua-driver check_permissions` 검증.

---

## Phase 3: jwc 지연 로딩 — MCP Tax 3K → 0

### 왜

Phase 1로 33K→3K가 됐어도, CU 안 쓸 때 3K도 낭비. **CU 요청 시에만 도구 활성화**하면 Tax 0.

### 이미 구현된 메커니즘 (jawcode)

**`tools.discoveryMode = "mcp-only"`** — jawcode에 이미 있음:

1. MCP 도구가 `#discoverableMCPTools` 풀에 들어감 (경량 메타: name/label/description/schemaKeys)
2. 모델에는 `search_tool_bm25` 1개만 노출 (~수백 토큰)
3. 모델이 "screenshot" 검색 → `activateDiscoveredMCPTools(toolNames)` → `setActiveToolsByName()` → 시스템 프롬프트에 도구 스키마 주입
4. 그 턴부터 CU 도구 사용 가능

핵심 파일:
- `packages/coding-agent/src/session/agent-session.ts:3551-3569` — `activateDiscoveredMCPTools`
- `packages/coding-agent/src/tools/search-tool-bm25.ts` — 검색 도구
- `packages/coding-agent/src/runtime-mcp/types.ts:404` — `TOOLS_LIST_CHANGED` notification

### codex-rs 패턴 (참조)

`codex-rs/core/src/mcp_tool_exposure.rs`:
- `DIRECT_MCP_TOOL_EXPOSURE_THRESHOLD = 100` — MCP 도구 100개 이상이면 전부 deferred
- `ToolExposure::Deferred` — 도구 이름만 라우터에 등록, 스키마는 `model_visible_specs`에서 제외
- `ToolSearchHandler` 자동 추가 — deferred 도구 검색/활성화

### per-server 세분화 (선택)

현재 `discoveryMode`는 ALL-or-NOTHING (모든 MCP 도구 또는 전부 활성). computer-use 서버만
deferred하려면:

- `~/.jwc/agent/mcp.json`에 `"discoverable": true` 필드 추가
- `manager.ts` `connectServers` 경로에서 `discoverable` 서버 도구를 `#discoverableMCPTools`로 분류
- 다른 MCP 서버(context7 등)는 즉시 활성

또는 Phase 1 통합 도구(1개)면 3K라 발동 조건에 안 걸릴 수도 — `discoveryMode` 없이도 충분히 저렴.

### 위험

1. **활성화 지연**: `search_tool_bm25` → 검색 → 활성화 → 다음 턴에서 사용 = **1턴 지연**. 급한 CU 요청에 1턴 더 걸림.
2. **캐시 무효화**: 활성화 시 프롬프트 캐시 브레이크포인트 변경 → 해당 턴 캐시 미스. 불가피.
3. **재연결**: MCP 서버가 타임아웃/disconnect 후 활성화 시도 → `DeferredMCPTool` reconnect 경로 필요.

---

## cli-jaw 이식 (Phase 4, defer)

cli-jaw CU 관련 변경은 **전부 revert**함 (`2e91473e`). 프롬프트는 codex-only 게이트로 원복.
syncToAll의 kiro 타깃 + claude 경로 수정은 CU 무관 인프라 개선으로 유지.

**재장착 조건**: jwc에서 Phase 1+2가 안정화된 후:
1. cu-mcp 통합 도구 + cua-driver 백엔드가 jwc에서 안정적으로 작동
2. 프롬프트 2-tier(Tier1=cu-mcp self-serve / Tier2=codex Sky dispatch) 재작성
3. `syncToAll`에 computer-use 등록 + codex 타깃 제외(`filterServers`) 재적용
4. cli-jaw 빌드 + 매니저 재시작

---

## 참조

| 참조 | 위치 |
|---|---|
| hermes 통합 스키마 | `~/Developer/codex/hermes-agent/tools/computer_use/schema.py` |
| hermes cua-driver 백엔드 | `~/Developer/codex/hermes-agent/tools/computer_use/cua_backend.py` |
| hermes vision routing | `~/Developer/codex/hermes-agent/tools/computer_use/vision_routing.py` |
| codex-rs deferred tools | `~/Developer/codex/00_overview/00_co_overview.md:948` |
| codex-rs ToolExposure | `codex-rs/core/src/mcp_tool_exposure.rs` |
| openclaw CU plugin glue | `/tmp/openclaw/extensions/codex/src/app-server/computer-use.ts` |
| jwc discoveryMode | `jawcode/packages/coding-agent/src/session/agent-session.ts:3551` |
| jwc search_tool_bm25 | `jawcode/packages/coding-agent/src/tools/search-tool-bm25.ts` |
| cu-mcp 현재 도구 | `~/developer/codex/23_computer_use/src/cu-mcp-server/src/tools/*.ts` |
| cua-driver 설치 | `https://github.com/trycua/cua` (설치 스크립트) |
| cli-jaw CU revert | `cli-jaw 2e91473e` |
