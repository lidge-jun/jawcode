# 020_omp_D08_tui_render_streaming

> Range: `7aa1d581c..b0d04e517` (subset)
> Cluster: D08 — TUI render/streaming stability
> Sol priority: P2
> Model-related: no
> Card target: 20.059_tui_render_streaming
> Worker: OW5

## 커밋 전수 테이블

| # | hash | summary | JWC impact area |
|---|---|---|---|
| 1 | `8570d80f2` | preserve streamed table coordinates | `packages/tui/src/components/markdown.ts` |
| 2 | `f9459bf46` | stabilize streamed table scrollback | `packages/tui/src/{components/markdown.ts,tui.ts}` |
| 3 | `ebaed59dd` | preserve deferred alternate exit | `packages/tui/src/tui.ts`; selector controllers |
| 4 | `217678bfd` | discard deferred output after session changes | `packages/coding-agent/src/modes/interactive-mode.ts` |
| 5 | `68f84d7c2` | prevent stale-buffer flicker | `packages/tui/src/{tui.ts,terminal.ts}` |
| 6 | `cf6d25f1b` | preserve blank streamed diff rows | `packages/tui/src/components/markdown.ts` |
| 7 | `936e83e3d` | highlight closed streamed diff tails | `packages/tui/src/components/markdown.ts` |
| 8 | `e41b32c87` | highlight streamed diff scrollback rows | `packages/tui/src/components/markdown.ts` |
| 9 | `411600aa2` | display cursor final answers after tools | `packages/coding-agent/src/modes/controllers/event-controller.ts` |
| 10 | `d3f4830ce` | defer command output during streaming | command/event controllers; `interactive-mode.ts` |
| 11 | `fe08c9758` | preserve cached leading diff blanks | `packages/tui/src/components/markdown.ts` |
| 12 | `896c4bb17` | cap expanded streaming diff previews to a viewport tail | `packages/coding-agent/src/edit/renderer.ts` |
| 13 | `485d207a7` | prevent destructive replay during viewport resize | `packages/tui/src/tui.ts` |
| 14 | `8ff98674e` | bound replay-safe transcript retention | TUI transcript/markdown owners |
| 15 | `3be56229a` | route terminal notifications through cmux | `packages/tui/src/terminal-capabilities.ts` |
| 16 | `cf4f55af3` | restore modifyOtherKeys fallback in tmux | `packages/tui/src/terminal.ts` |
| 17 | `34b459891` | render keyed hook statuses separately | status-line component |

## 주제 분석

이 클러스터는 스트리밍 중인 내용을 화면에 그리는 순간부터 영구 scrollback으로 넘기는 순간까지의 경계를 다룬다. 표 좌표와 diff의 빈 줄·강조 상태를 보존하고, 세션 전환이나 viewport resize 때 지연 출력이 새 화면을 오염시키지 않도록 한다. 도구 실행 뒤의 최종 답변과 hook 상태도 올바른 렌더 lane에 남긴다.

JWC에는 OMP보다 강한 자체 viewport/scrollback 계약이 있다. 따라서 개별 컴포넌트를 그대로 옮기기보다 “동일 프레임의 좌표 안정성”, “완료된 행의 단 한 번 커밋”, “세션 경계를 넘는 지연 출력 폐기”, “resize 뒤 과거 scrollback 비파괴”를 회귀 조건으로 추출해야 한다. cmux와 tmux 입력 보정은 렌더러와 분리된 terminal capability 계약으로 대조한다.

## Worktree 대조

JWC에는 `packages/tui/src/tui.ts`의 `commitLines()`, `replayTranscript()`, `viewportRepaint`와 다수의 scrollback/resize 회귀 테스트가 존재한다. `packages/tui/src/terminal.ts`에도 modifyOtherKeys 상태 관리가 있다. 반면 OMP의 `transcript-container.ts`와 `chat-transcript-builder.ts`는 JWC에 없고, JWC는 `event-controller.ts`와 자체 TUI commit lane이 해당 책임을 나눠 가진다. 이 클러스터는 파일 동형성이 아니라 기존 JWC B2-lite viewport 규칙과 diff/streaming 불변식의 의미 대조가 필요하다.

## 누락 커밋 보완 (2026-07-17)

범위 전체와 기존 분류 파일의 정확한 해시 차집합에서 확인한 누락 커밋을 추가한다.

| # | hash | git one-line summary | classification |
|---|---|---|---|
| 1 | `09429fe4e` | fix(tui): cached loader layout across shimmer frames | TUI/render/streaming |
| 2 | `09d2d2db3` | fix(export): rendered inline markdown in list items | TUI/render/streaming |
| 3 | `0eda288b9` | fix(tui): updated nerd session icon codepoint | TUI/render/streaming |
| 4 | `1eab12e28` | feat(tui): constrained mid-prompt skill completion matching | TUI/render/streaming |
| 5 | `26792f7b5` | fix(tui): skip sparse compacted segments in isBlockUncommitted | TUI/render/streaming |
| 6 | `276092eac` | fix(tui): reduced idle loader render work | TUI/render/streaming |
| 7 | `32665a4af` | fix(tui): kept tmux keyboard input in legacy mode | TUI/render/streaming |
| 8 | `369a0d879` | feat(coding-agent/modes): displayed session title in pause screen | TUI/render/streaming |
| 9 | `37cf23eb6` | fix(tui): sanitize remaining task renderer fields | TUI/render/streaming |
| 10 | `3abade725` | fix(tui): trigger internal-url autocomplete inside slash args | TUI/render/streaming |
| 11 | `3fa5ffd0b` | fix(tui): handled Kitty vim navigation sequences | TUI/render/streaming |
| 12 | `43a89d20b` | fix(editor): accepted upstream-pi editor constructor in CustomEditor | TUI/render/streaming |
| 13 | `52f9e4130` | fix(tui): hand editor tap state to agent hub on double-left open | TUI/render/streaming |
| 14 | `5a32d79d8` | fix(tui): stop PageUp/PageDown stepping prompt history at idle | TUI/render/streaming |
| 15 | `62172339b` | fix(tui): preserved loader stub compatibility | TUI/render/streaming |
| 16 | `71aaad50e` | fix(coding-agent): flush throttled output tails | TUI/render/streaming |
| 17 | `79ce2de8a` | fix(tui): restored windows terminal appearance polling | TUI/render/streaming |
| 18 | `83ed5eef1` | fix(tui): guarded DynamicBorder against uninitialized module-level theme | TUI/render/streaming |
| 19 | `aa52fa423` | feat(session): enabled visibility for elided tool calls in transcripts | TUI/render/streaming |
| 20 | `b35e4c413` | fix(tui): honored move overlay width | TUI/render/streaming |
| 21 | `c22d5dffb` | fix(tui): allowed anchored loader direct writes | TUI/render/streaming |
| 22 | `d1bcd5812` | fix(tui): anchored kitty images through tmux | TUI/render/streaming |
| 23 | `d1c88dd89` | fix(tui): reserve mixed assistant segments safely | TUI/render/streaming |
| 24 | `d1c98e960` | fix(tui): protected editor border from IME preedit | TUI/render/streaming |
| 25 | `d39b9fc1c` | feat(tui): added LaTeX under/over brace labels and script-word block rendering | TUI/render/streaming |
| 26 | `d4ffb4b64` | feat(coding-agent/tools): updated status event rendering to show tail window | TUI/render/streaming |
| 27 | `e770cdc4d` | fix(coding-agent): unified tool renderer and clarified launch diagnostics | TUI/render/streaming |
| 28 | `e9dc1616b` | fix(tui): anchored IME cursors in interactive inputs | TUI/render/streaming |
| 29 | `f3aad14ee` | fix(tui): restored compact editor border by default | TUI/render/streaming |
