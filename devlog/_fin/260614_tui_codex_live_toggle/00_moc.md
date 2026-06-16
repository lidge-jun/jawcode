# 260614 — jwc TUI Codex식 live-only 출력 토글

> 상태: 🟡 결정/실행계획 기록
> 배경: jwc TUI에서 `ctrl+o`/`ctrl+t`로 펼친 과거 출력이 commit render lane scrollback에 열린 픽셀로 굳어, 다시 닫아도 현재 턴만 닫히는 문제.
> 사용자 결정: Codex식으로 정렬한다. `ctrl+t` thinking 매핑은 없애고, 현재 thinking/tool은 모두 `ctrl+o`로만 연다. `ctrl+t` full transcript overlay/screen은 후속 phase로 남긴다.

## 1. 문제 요약

현재 jwc TUI는 다음 구조를 동시에 갖고 있다.

1. `ctrl+o` / `ctrl+t`는 TUI component 객체의 expanded 상태를 토글한다.
2. commit render lane은 완료된 과거 component를 `commitLines()`로 terminal scrollback에 직접 찍고 `child.committed = true`로 표시한다.
3. `Container.render()`는 committed child를 render tree에서 skip한다.

따라서 이미 scrollback에 찍힌 과거 구간은 더 이상 TUI component render 대상이 아니다. 그 결과:

- `ctrl+o`로 전체 tool/thinking을 펼친다.
- 새 prompt를 보내 턴 경계를 넘는다.
- 펼친 상태의 출력이 scrollback에 immutable pixel로 굳는다.
- 다시 `ctrl+o`/`ctrl+t`로 닫아도 현재 live/미커밋 구간만 닫히고 위쪽 과거는 열린 채 남는다.

이건 단순 누락 버그가 아니라 “scrollback immutable append”와 “전역 가역 접기 토글” UX의 설계 충돌이다.

## 2. jwc 코드 근거

핫키/토글:

- `packages/coding-agent/src/config/keybindings.ts`
  - `app.tools.expand` 기본키: `ctrl+o`
  - `app.thinking.toggle` 기본키: `ctrl+t`
- `packages/coding-agent/src/modes/controllers/input-controller.ts`
  - `toggleToolOutputExpansion()`은 `toolOutputExpanded`를 뒤집고 `thinkingExpanded`를 같은 값으로 맞춘 뒤 `setToolsExpanded(expanded)`를 호출한다.
  - `setToolsExpanded()`는 `chatContainer.children`와 `liveToolContainer.children`의 `setExpanded(expanded)`를 호출한다.
  - `toggleThinkingBlockVisibility()`는 `chatContainer.children` 중 `AssistantMessageComponent`에 `setThinkingExpanded(expanded)`를 호출한다.

commit lane:

- `packages/coding-agent/src/modes/utils/ui-helpers.ts`
  - `commitFinalizedBacklog()`가 완료된 `chatContainer.children` prefix를 `ctx.ui.commitLines(lines)`로 scrollback에 기록한다.
  - 성공하면 `child.committed = true`.
- `packages/tui/src/tui.ts`
  - `Container.render()`는 `child.committed`면 skip한다.
  - `commitLines()`는 finalized lines를 diff-rendered frame이 아닌 terminal scrollback에 직접 삽입한다.

결론: committed child의 객체 상태를 바꿔도 이미 찍힌 scrollback 픽셀은 바뀌지 않는다.

## 3. 비교 조사

### 3.1 Codex RS

조사 대상: `~/Developer/codex/openai-codex/codex-rs`

확인한 파일/동작:

- `codex-rs/tui/src/app/event_dispatch.rs`
  - `AppEvent::InsertHistoryCell`에서 `transcript_cells.push(cell.clone())` 후 `insert_history_cell_lines(...)`로 normal chat scrollback에 쓴다.
- `codex-rs/tui/src/app/resize_reflow.rs`
  - app은 conversation history를 `HistoryCell` source로 저장하지만 finalized history를 terminal scrollback에도 쓴다.
  - resize/reflow 시 source `transcript_cells`를 다시 렌더하고 `clear_scrollback_and_visible_screen_ansi()` 후 재방출한다.
  - `reflow_transcript_now()`도 source-backed clear+rewrite 경로다.
- `codex-rs/tui/src/app/input.rs`
  - `ctrl+t`는 `Overlay::new_transcript(self.transcript_cells.clone(), ...)`로 alternate-screen transcript overlay를 연다.
  - `alt+r` raw output toggle은 `apply_raw_output_mode()` → `reflow_transcript_now()`로 전체 scrollback을 source에서 재작성한다.
- `codex-rs/tui/src/keymap.rs`
  - default `open_transcript = ctrl-t`
  - default `toggle_raw_output = alt-r`
  - snapshot상 `ctrl-o`는 copy-last-response다.

판정:

- Codex RS도 normal chat 과거는 scrollback append라 일반 사후 접기 토글 대상으로 삼지 않는다.
- full transcript는 `ctrl+t` overlay로 본다.
- 전체 재방출은 resize/raw-output 같은 특수 이벤트에서만 수행한다.
- 즉 “과거 scrollback을 일반 토글로 계속 가역 조작”하지 않는다.

### 3.2 Claude Code

조사 대상: `~/Developer/codex/claude_code/orideop_src`

확인한 파일/동작:

- `src/keybindings/defaultBindings.ts`
  - `ctrl+t`: `app:toggleTodos`
  - `ctrl+o`: `app:toggleTranscript`
- `src/hooks/useGlobalKeybindings.tsx`
  - `app:toggleTranscript`는 `setScreen(s => s === 'transcript' ? 'prompt' : 'transcript')`를 수행한다.
  - transcript 진입/종료 시 `setShowAllInTranscript(false)`로 transcript 전용 상태를 리셋한다.
  - transcript 전용 `ctrl+e`는 `showAllInTranscript`를 토글한다.
- `src/components/Messages.tsx`
  - `isTranscriptMode = screen === 'transcript'`.
  - transcript mode는 prompt mode의 brief/drop 필터를 우회한다.
  - fullscreen에서는 `expandedKeys`로 message별 verbose toggle을 관리하고 `MessageRow`에는 `verbose || isItemExpanded(...)`가 전달된다.
  - virtual scroll active 시 `VirtualMessageList`가 source messages 기반으로 전체 transcript를 렌더한다.
- `src/components/VirtualMessageList.tsx`
  - `onItemClick`, `isItemExpanded` props가 있고, 주석상 message click으로 verbose rendering을 토글한다.
- `src/components/messages/AssistantThinkingMessage.tsx`
  - `shouldShowFullThinking = isTranscriptMode || verbose`.
- `src/components/CtrlOToExpand.tsx`
  - `ctrl+o to expand` 힌트는 `app:toggleTranscript`로 transcript screen에 들어가라는 안내다. virtual list 내부에서는 숨긴다.

판정:

- Claude Code의 `ctrl+o`는 normal scrollback 픽셀 접기/펼치기가 아니라 prompt screen ↔ transcript screen 전환이다.
- transcript screen은 source messages 기반 virtual list라 닫으면 prompt screen으로 돌아갈 뿐, 과거 scrollback 픽셀을 펼친 상태로 굳히지 않는다.
- message별 펼침은 transcript screen 내부 상태다.

## 4. 결정

jwc는 이번 slice에서 **Codex식 live-only 출력 토글**로 정렬한다.

- normal prompt scrollback은 항상 canonical collapsed 상태로 커밋한다.
- `ctrl+o`는 현재 live / 미커밋 구간의 tool + thinking 전체 토글만 담당한다.
- `ctrl+t`의 thinking 전용 토글 매핑은 제거한다.
- `ctrl+t` full transcript overlay/screen은 후속 phase로 예약한다.
- 현재 jwc의 `alt+t` tool transcript overlay는 그대로 둔다. Codex RS의 `ctrl+t` full transcript overlay와 범위가 다르므로 즉시 매핑하지 않는다.

## 5. 목표 UX

### Normal prompt screen

- 과거 턴:
  - tool output, read/search group, thinking block은 collapsed canonical 형태로 scrollback에 남는다.
  - 한 번 과거로 넘어간 구간은 `ctrl+o`로 다시 열거나 닫지 않는다.
- 현재 턴 / live zone / 아직 커밋되지 않은 마지막 턴:
  - `ctrl+o`: tool + thinking 전체 펼침/접힘.
  - 새 사용자 메시지 제출 시 해당 구간은 collapsed canonical 형태로 커밋된다.
- `ctrl+t`:
  - 이번 phase에서는 thinking toggle로 쓰지 않는다.
  - full transcript overlay/screen 후속 구현을 위해 예약하거나 unbound 처리한다.

### Full transcript 보기

- `alt+t`는 현행 tool transcript overlay로 유지한다.
- `ctrl+t`는 후속 phase에서 full conversation transcript overlay/screen 후보로 검토한다.
- 후속 구현은 Codex RS식 alternate screen 또는 Claude Code식 transcript screen 중 별도 결정한다.

## 6. 구현 범위

### 6.1 `ctrl+t` thinking toggle 제거

대상:

- `packages/coding-agent/src/config/keybindings.ts`
  - `app.thinking.toggle` 기본키 `ctrl+t` 제거 또는 unbound 처리.
  - 설명도 기본 hotkey 표면에서 thinking 전용 토글로 보이지 않게 조정.
- `packages/coding-agent/src/modes/components/custom-editor.ts`
  - default action key 목록에서 `app.thinking.toggle: ["ctrl+t"]` 제거.
- `packages/coding-agent/src/modes/controllers/input-controller.ts`
  - `onToggleThinking` 배선은 커스텀 keybinding 호환을 위해 당장 남길 수 있으나 기본키가 없어야 한다.
  - 장기적으로 `toggleThinkingBlockVisibility()`는 삭제 후보.
- `packages/coding-agent/src/modes/utils/hotkeys-markdown.ts`
  - hotkey 문서에 `ctrl+t` thinking toggle이 노출되지 않게 조정.

원칙:

- 기본 UX에서 `ctrl+t`가 thinking 전용 토글로 동작하면 안 된다.
- 커스텀 keybinding hard-delete 여부는 별도 선택이다. 기본 동작 제거가 필수다.

### 6.2 `ctrl+o`를 live-only tool + thinking toggle로 제한

현재 문제:

- `setToolsExpanded()`가 모든 `chatContainer.children`를 훑는다.
- committed child도 객체 상태는 변할 수 있지만 화면 픽셀은 바뀌지 않는다.
- 이 동작은 사용자에게 “전체가 닫힐 것”이라는 잘못된 모델을 준다.

수정 방향:

- `ctrl+o` 대상은 다음으로 제한한다.
  1. `liveToolContainer.children`
  2. `chatContainer.children` 중 `!child.committed`인 미커밋 컴포넌트
  3. `streamingComponent`
- thinking도 같은 live-only 규칙을 따른다.
- status 문구는 “current turn” 또는 “live output” 범위를 드러낸다.

예상 형태:

```ts
for (const child of this.ctx.chatContainer.children) {
	if (child.committed) continue;
	if (isExpandable(child)) child.setExpanded(expanded);
}
for (const child of this.ctx.liveToolContainer.children) {
	if (isExpandable(child)) child.setExpanded(expanded);
}
this.ctx.streamingComponent?.setThinkingExpanded(expanded);
```

### 6.3 commit 시 canonical collapsed 강제

문제:

- 사용자가 `ctrl+o`로 펼친 상태에서 새 prompt를 보내면 `commitFinalizedBacklog()`가 펼친 렌더 결과를 `commitLines()`에 넘길 수 있다.
- 그러면 과거 scrollback이 열린 상태로 굳는다.

수정 방향:

- `commitFinalizedBacklog()`는 화면의 live expanded 상태와 무관하게 collapsed canonical lines를 생성해야 한다.

후보:

#### A. 일시 상태 전환

- expandable child의 상태를 false로 바꾸고 render한 뒤 원복한다.
- 단순하지만 getter/상태복원 protocol이 부족하고 부작용 위험이 있다.

#### B. `renderCommitted(width)` protocol 추가 — 권장

- 커밋 가능한 component에 optional method를 추가한다.
- `commitFinalizedBacklog()`는 `renderCommitted?.(width) ?? render(width)`를 사용한다.
- 각 component가 자기 canonical collapsed 렌더를 책임진다.

예상 guard:

```ts
function hasCommittedRenderer(obj: unknown): obj is { renderCommitted(width: number): string[] } {
	return typeof obj === "object" && obj !== null && "renderCommitted" in obj && typeof obj.renderCommitted === "function";
}
```

대상 후보:

- `ToolExecutionComponent`
- `ReadToolGroupComponent`
- `AssistantMessageComponent` thinking summary
- `CustomMessageComponent` / `SkillMessageComponent` 등 expandable류
- `BashExecutionComponent` / `EvalExecutionComponent`는 083.10 잔여 셀 타입 커밋과 연결해 확인

## 7. Full transcript overlay 후속 phase

이번 slice 비목표다. 별도 phase에서 아래를 다룬다.

- `ctrl+t`를 full transcript overlay/screen으로 재사용할지 결정.
- 현행 `alt+t` tool transcript overlay와 통합/대체 여부 설계.
- Codex RS식 alternate-screen transcript overlay 후보:
  - committed session messages + active live tail
  - tool output full text
  - thinking full text
  - search/scroll support
- Claude Code식 screen 전환 후보:
  - prompt screen과 transcript screen 상태 분리
  - source messages 기반 virtual render
  - per-message expanded keys

## 8. 비목표

- 이번 phase에서 full transcript overlay를 만들지 않는다.
- 이번 phase에서 terminal scrollback을 일반 `ctrl+o`로 clear+rewrite하지 않는다.
- 이번 phase에서 visual banner/scroll model을 단순화하지 않는다.
- 이번 phase에서 `alt+t` tool transcript overlay를 제거하지 않는다.

## 9. 테스트 계획

### Unit/headless

1. `ctrl+o` live-only 대상 테스트
   - committed child + uncommitted child + liveTool child fixture 구성.
   - toggle 후 committed child에는 `setExpanded`가 호출되지 않아야 한다.
   - uncommitted/live child에는 호출되어야 한다.

2. commit canonical collapsed 테스트
   - `toolOutputExpanded=true` 또는 component expanded 상태에서 `commitFinalizedBacklog()` 실행.
   - fake `ui.commitLines(lines)`에 들어간 lines가 collapsed height/summary인지 검증.

3. thinking canonical collapsed 테스트
   - `thinkingExpanded=true` 상태의 assistant thinking message를 commit.
   - commit lines가 full thinking trace가 아니라 summary인지 검증.

4. keybinding 테스트
   - `ctrl+t`가 기본 `app.thinking.toggle`에 묶이지 않는지 검증.
   - hotkey markdown/help에 thinking toggle 기본키가 사라졌는지 검증.

### Manual / 실기기

1. 긴 세션에서 도구/thinking 출력 생성.
2. `ctrl+o`로 현재 턴 펼침.
3. 새 prompt 제출.
4. 이전 턴이 collapsed summary로 scrollback에 고정되는지 확인.
5. 다시 `ctrl+o`를 눌렀을 때 현재 live/mutable 구간만 변하고 과거 scrollback이 열린 상태로 남지 않는지 확인.
6. `ctrl+t`가 thinking toggle로 동작하지 않는지 확인.
7. `alt+t` tool transcript overlay가 기존대로 동작하는지 확인.

## 10. 수용 기준

- 사용자가 `ctrl+o`로 펼친 상태에서 턴을 넘겨도 과거 scrollback에 full tool/thinking이 굳지 않는다.
- `ctrl+o`는 현재 미커밋/live 출력에 대해서만 열고 닫는다.
- `ctrl+t`는 더 이상 thinking toggle 기본키가 아니다.
- full transcript는 후속 phase로 명시 보류되어 있다.
- “닫을 수 없는 과거 픽셀” 문제가 UX상 재발하지 않는다.

## 11. 하드닝 메모 — 외부 문서/기준 repo 재검증

### 11.1 Terminal scrollback 전제

외부 문서 기준으로도 이번 결정은 맞다.

- OpenTUI renderer docs는 기본 `"alternate-screen"`을 “full-screen TUI 표준”으로 설명하고, `"split-footer"`를 terminal main screen 위쪽 normal output + 아래 footer region 구조로 설명한다. 특히 split-footer는 scrollback writer/captured stdout을 footer 위로 publish하는 별도 모델을 둔다. 즉 transcript와 live footer를 분리하는 구조가 canonical이다.
  - 출처: https://opentui.com/docs/core-concepts/renderer/
- Terminal Guide의 alternate screen 설명도 primary buffer가 보통 scrollback을 지원하고 alternate buffer는 full-screen app용이며, xterm 계열에서 alternate buffer scrollout이 primary scrollback을 수정하지 않는다고 정리한다. 즉 full-screen/overlay와 scrollback transcript는 같은 surface가 아니다.
  - 출처: https://terminalguide.namepad.de/mode/p47/
- ncurses `clear(1)` 문서는 `clear`가 terminfo `E3` capability가 있으면 screen뿐 아니라 scrollback buffer까지 지울 수 있고, `-x`가 scrollback clear를 막는 옵션이라고 설명한다. 즉 “과거 scrollback을 고치기 위해 전체 clear/rewrite”는 terminal별 destructive 동작을 끌어들인다.
  - 출처: https://manpages.ubuntu.com/manpages/noble/man1/clear.1.html

판정:

- normal prompt screen은 append-only/canonical collapsed commit lane으로 유지한다.
- 이미 commit된 terminal scrollback을 일반 hotkey로 가역 편집하는 설계는 피한다.
- 전체 재구성이 필요한 화면은 별도 source-backed transcript screen/overlay에서 한다.
- `CSI 3 J`, `clear`, full reset 같은 scrollback destructive sequence는 이번 phase의 해결책이 아니다.

### 11.2 Codex RS/Claude Code 기준 repo 재확인

기준 repo 비교도 같은 결론이다.

Codex RS (`~/Developer/codex/openai-codex/codex-rs`):

- normal chat은 history cell을 source `transcript_cells`에 저장하면서 terminal history/scrollback으로 append한다.
- `ctrl+t`는 source `transcript_cells` clone으로 transcript overlay를 연다.
- raw-output/resize 같은 특수 경로만 source-backed clear+rewrite/reflow를 수행한다.
- 일반 “과거 output 접기/펼치기 hotkey”로 scrollback을 계속 수정하지 않는다.

Claude Code (`~/Developer/codex/claude_code/orideop_src`):

- `ctrl+o`는 prompt screen의 scrollback mutation이 아니라 transcript screen 전환이다.
- transcript mode는 source messages 기반 virtual list이며, thinking full display도 transcript mode/verbose state에서 처리한다.
- message별 expansion은 transcript screen 내부 상태다.

판정:

- jwc의 `ctrl+o`를 normal prompt screen live-only toggle로 좁히는 것은 Codex식과 충돌하지 않는다.
- `ctrl+t` full transcript overlay/screen은 `ctrl+o` live toggle과 별도 surface로 구현해야 한다.
- Claude식으로 가더라도 핵심은 “source messages 기반 transcript screen”이지 “과거 scrollback 픽셀을 mutate”가 아니다.

## 12. Compaction 이후 과거 대화내역이 화면에서 사라지는 문제

### 12.1 정정된 문제 정의

사용자가 말한 문제는 “compaction 이후 이전 raw message가 LLM context에 다시 hydrate된다”가 아니라 반대다.

- `/compact` 또는 auto-compaction 이후 **TUI의 이전 대화내역이 싹 사라진다.**
- 모델 context를 줄이는 것은 맞지만, 사용자가 보는 session transcript/history까지 compacted context로만 재렌더되어 과거 대화가 없어지는 UX가 문제다.
- 즉 핵심은 **LLM context compaction**과 **operator-visible transcript rendering**을 분리하지 않은 것이다.

### 12.2 현재 원인

현재 compaction 성공 경로:

- `packages/coding-agent/src/modes/controllers/command-controller.ts`
  - `executeCompaction()` 성공 후 `ctx.rebuildChatFromMessages()` 호출.
- `packages/coding-agent/src/modes/interactive-mode.ts`
  - `rebuildChatFromMessages()`는 `chatContainer.clear()` 후 `session.buildDisplaySessionContext()`를 render한다.
- `packages/coding-agent/src/session/agent-session.ts`
  - `buildDisplaySessionContext()`가 `sessionManager.buildSessionContext()`를 그대로 사용한다.
- `packages/coding-agent/src/session/session-manager.ts`
  - `buildSessionContext()`는 LLM input용 compacted context다.
  - latest compaction summary를 넣고, `firstKeptEntryId` 이후 kept messages와 post-compaction messages만 반환한다.
  - compaction으로 요약된 old raw messages는 의도적으로 제외된다.
- `packages/coding-agent/src/modes/utils/ui-helpers.ts`
  - `renderSessionContext()`는 전달받은 `sessionContext.messages`만 렌더한다.

따라서 compaction 후 UI rebuild가 발생하면:

```text
full visible transcript
  ↓ compact()
chatContainer.clear()
  ↓ buildDisplaySessionContext() == buildSessionContext()
compaction summary + kept/later messages only
```

이 되어 operator-visible 과거 대화가 사라진다.

### 12.3 이미 존재하는 별도 방어 — LLM context hydrate

LLM context 쪽은 별도 문제이며 이미 방어 코드가 있다.

- `buildSessionContext()`는 active path의 latest compaction만 사용한다.
- `remoteReplacementHistory`가 없을 때 kept messages 검색 시작점을 직전 compaction 이후로 clamp한다.
- 코드 주석: “prevent stale firstKeptEntryId from hydrating old messages.”
- `packages/coding-agent/test/session-manager/build-context.test.ts`
  - `stale firstKeptEntryId before previous compaction does not hydrate old messages`

이 방어는 유지해야 한다. display 문제를 고친다고 해서 LLM context가 old raw messages를 다시 받으면 안 된다.

### 12.4 수정 방향 — display context와 LLM context 분리

필요한 구조:

1. **LLM context**
   - 계속 `buildSessionContext()` 사용.
   - compaction summary + kept/later messages만 모델로 전달.
   - stale `firstKeptEntryId` 방어 유지.

2. **Visible transcript context**
   - active branch의 raw `SessionEntry` path를 source로 사용.
   - compaction entry는 `[compaction]` marker/summary component로 렌더하되, 그 이전/이후 raw message entries는 operator transcript에서 유지한다.
   - 단, tool/thinking full 출력은 canonical collapsed commit 정책을 따른다.
   - transcript display는 “모델에 보내는 context”가 아니라 “사용자에게 보이는 세션 기록”이다.

권장 API 후보:

```ts
buildDisplaySessionContext(): SessionContext {
	return deobfuscateSessionContext(
		this.sessionManager.buildTranscriptDisplayContext(),
		this.#obfuscator,
	);
}
```

또는 이름을 더 명확히:

```ts
buildVisibleTranscriptContext()
buildModelSessionContext()
```

중요한 원칙:

- `agent.replaceMessages(...)` / model replay는 compacted `buildSessionContext()`를 써야 한다.
- `renderInitialMessages()` / `/resume` / compaction 후 UI rebuild는 visible transcript context를 써야 한다.
- source는 같은 session JSONL이지만 projection이 다르다.

### 12.5 Codex/Claude 기준과의 정렬

이 분리는 기준 repo와도 맞다.

- Codex RS는 `transcript_cells` source를 따로 유지하고, model context/reflow/overlay는 그 source projection으로 처리한다.
- Claude Code는 prompt screen과 transcript screen이 source messages 기반으로 분리되어 있고, `ctrl+o`는 transcript screen 전환이다.
- 둘 다 “모델 context를 줄였으니 사용자 transcript도 삭제”하는 UX가 아니다.

jwc도:

- compaction은 모델 context maintenance다.
- 사용자 transcript는 session history/audit surface다.
- 둘을 같은 `SessionContext.messages` projection 하나로 처리하면 지금처럼 과거 대화가 날아간다.

### 12.6 이번 live-only phase에서 같이 해결할 범위

이번 phase에 포함할 수 있는 것:

- compaction 성공 후 `rebuildChatFromMessages()`가 compacted LLM context가 아니라 visible transcript context를 렌더하도록 변경한다.
- visible transcript context는 compaction entry를 marker로 보여주면서도 이전 raw 대화내역을 유지한다.
- `ctrl+o` live-only 규칙은 visible transcript projection에도 동일하게 적용한다.
  - 과거 entries는 canonical collapsed 상태로 렌더/커밋.
  - 현재 live/uncommitted만 `ctrl+o`로 열고 닫는다.
- commit lane은 canonical collapsed renderer를 사용해 expanded full output이 과거 transcript에 굳지 않게 한다.

### 12.7 이번 phase에서 하지 않을 것

- 모델 context에 old raw messages를 다시 넣지 않는다.
- compaction summary를 제거하지 않는다.
- session JSONL raw entries를 삭제하지 않는다.
- terminal scrollback destructive clear/rewrite로 이미 찍힌 화면을 고치려 하지 않는다.
- full `ctrl+t` transcript overlay/screen은 후속 phase로 둔다.

### 12.8 테스트 항목 수정

추가/수정 테스트:

1. **Compaction 후 UI transcript 보존**
   - compaction 전 user/assistant/tool messages 여러 개를 만든다.
   - compaction entry를 추가한다.
   - UI display context/rebuild 결과에 pre-compaction visible messages가 남아 있는지 확인한다.
   - 같은 fixture에서 model context는 compacted summary + kept/later only인지 확인한다.

2. **Projection 분리**
   - `buildSessionContext()`는 old summarized messages를 제외한다.
   - `buildVisibleTranscriptContext()`는 old raw messages와 compaction marker를 모두 포함한다.

3. **Nested compaction**
   - 여러 compaction entry가 있는 branch에서 visible transcript는 raw branch history를 보존한다.
   - model context는 latest compaction 기준으로만 hydrate한다.

4. **Canonical collapsed display**
   - visible transcript projection으로 렌더된 과거 tool/thinking은 collapsed canonical 상태다.
   - `ctrl+o`는 committed/old visible transcript를 열지 않는다.

5. **Resume/branch reload**
   - `/resume`, `--resume`, tree/branch navigation 후에도 display는 visible transcript projection을 사용한다.
   - agent/model messages는 compacted model projection을 유지한다.
