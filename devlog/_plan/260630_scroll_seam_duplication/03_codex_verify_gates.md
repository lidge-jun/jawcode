# Codex 게이트 검증 기록

검증 일시: 2026-07-02
작업 디렉토리: `/Users/jun/Developer/new/700_projects/jawcode`

## 종합 판정

**GREEN with known pre-existing failures.**

스크롤 seam 중복 회귀 테스트와 관련 TUI/input-controller 집중 게이트는 통과했다. `packages/tui/` 전체 스위트는 522 pass / 6 fail로 종료했고, 실패는 요청서에 명시된 기존 render-goldens 6건(`layout-resize-rich-text`, `interactive-editor-overlay`, `transcript-shrink-clear`, `multiplexer-viewport-repaint`, `termux-height-diff`, `sixel-image-line-preservation`)에 국한된다. `commit-time-folding`도 요청서에 적힌 기존 `agent_end` 1건 실패와 일치한다.

루트 `bun run check`는 시도했으나 `check:rs`의 devlog vendored Rust scope allowlist 검사에서 실패했다. `check:ts`는 완료까지 통과했으며, 실패 경로가 `devlog/_gjc_chase/...` 및 `devlog/_omp_chase/...` 아래 vendored Rust 파일들이어서 이번 변경 파일(`packages/tui/src/tui.ts`, `packages/tui/test/*`, `packages/coding-agent/src/modes/controllers/input-controller.ts`)과 직접 관련이 없는 것으로 판정한다.

## 게이트별 결과

1. `TERM=xterm-256color bun test ./packages/tui/test/scroll-seam-duplication.test.ts`

   결과는 통과다. 5 pass / 0 fail, 18 expect 호출, 1개 파일 5개 테스트를 564ms에 실행했다. 요청서의 “5케이스 기대”와 일치한다.

2. `TERM=xterm-256color bun test packages/tui/`

   결과는 known pre-existing failures 포함 실패다. 522 pass / 6 fail, 1895 expect 호출, 45개 파일 528개 테스트를 48.78s에 실행했다.

   실패는 모두 `packages/tui/test/render-goldens.test.ts`의 render-goldens 케이스이며, 요청서의 기존 이슈 목록 6건과 일치한다.

   - `TUI render goldens > layout-resize-rich-text matches viewport, scrollback, and terminal byte log`
   - `TUI render goldens > interactive-editor-overlay matches viewport, scrollback, and terminal byte log`
   - `TUI render goldens > transcript-shrink-clear matches viewport, scrollback, and terminal byte log`
   - `TUI render goldens > multiplexer-viewport-repaint matches viewport, scrollback, and terminal byte log`
   - `TUI render goldens > termux-height-diff matches viewport, scrollback, and terminal byte log`
   - `TUI render goldens > sixel-image-line-preservation matches viewport, scrollback, and terminal byte log`

   대표 로그 발췌:

   ```text
   (fail) TUI render goldens > transcript-shrink-clear matches viewport, scrollback, and terminal byte log
   (fail) TUI render goldens > multiplexer-viewport-repaint matches viewport, scrollback, and terminal byte log
   (fail) TUI render goldens > termux-height-diff matches viewport, scrollback, and terminal byte log
   (fail) TUI render goldens > sixel-image-line-preservation matches viewport, scrollback, and terminal byte log

     522 pass
     6 fail
     1895 expect() calls
   Ran 528 tests across 45 files. [48.78s]
   ```

3. `TERM=xterm-256color bun test ./packages/coding-agent/test/commit-time-folding.test.ts`

   결과는 known pre-existing failure 포함 실패다. 4 pass / 1 fail, 23 expect 호출, 1개 파일 5개 테스트를 535ms에 실행했다. 실패는 요청서에 적힌 `agent_end` 1건과 일치한다.

   로그 발췌:

   ```text
   TypeError: this.ctx.sessionManager.getSessionId is not a function.
         at sendCompletionNotification (.../packages/coding-agent/src/modes/controllers/event-controller.ts:1139:39)
         at #handleAgentEnd (.../packages/coding-agent/src/modes/controllers/event-controller.ts:847:8)
   (fail) commit-time folding (99.20.04) > commit mode: agent_end commits any leftover live-zone tools (abort path)

     4 pass
     1 fail
     23 expect() calls
   Ran 5 tests across 1 file. [535.00ms]
   ```

4. `TERM=xterm-256color bun test ./packages/coding-agent/test/input-controller-keybindings.test.ts ./packages/coding-agent/test/interactive-mode-current-turn-boundary.test.ts ./packages/coding-agent/test/repro-issue-1020-ctx-shutdown.test.ts`

   결과는 통과다. 30 pass / 0 fail, 131 expect 호출, 3개 파일 30개 테스트를 938ms에 실행했다. 요청서의 “30 pass 기대”와 일치한다.

5. `TERM=xterm-256color bun biome check packages/tui/src/tui.ts packages/tui/test/scroll-seam-duplication.test.ts packages/tui/test/viewport-fill.test.ts packages/coding-agent/src/modes/controllers/input-controller.ts`

   결과는 통과다. 4개 파일을 41ms에 검사했고 “No fixes applied”로 종료했다.

6. `TERM=xterm-256color bunx tsc --noEmit` in `packages/tui`

   결과는 통과다. 출력 없이 exit code 0으로 종료했으며 소요는 약 0.88s였다.

7. `TERM=xterm-256color bunx tsc --noEmit` in `packages/coding-agent`

   결과는 통과다. 출력 없이 exit code 0으로 종료했으며 소요는 약 9.98s였다.

8. `TERM=xterm-256color bun run check`

   결과는 실패지만 이번 변경과 무관한 기존/외부 범위 실패로 판정한다. 전체 소요는 약 8.61s였다. 루트 스크립트는 `bun run --parallel check:ts check:rs`를 실행했고, `check:ts`는 완료까지 통과했다. 실패 지점은 `check:rs`의 Rust scope 검사로, `devlog/_gjc_chase/gajae-code/crates/...` 및 `devlog/_omp_chase/oh-my-pi/crates/vendor/...` 아래 vendored Rust 파일들이 허용 범위 밖이라고 보고했다.

   로그 발췌:

   ```text
   $ bun run --parallel check:ts check:rs
   check:rs | Rust scope check failed. Rust is limited to native/performance-critical parts:
   check:rs | - Rust source is outside allowed native/performance-critical directories: devlog/_gjc_chase/gajae-code/crates/brush-builtins-vendored/src/alias.rs
   check:rs | - Rust source is outside allowed native/performance-critical directories: devlog/_gjc_chase/gajae-code/crates/brush-core-vendored/src/lib.rs
   check:rs | - Rust source is outside allowed native/performance-critical directories: devlog/_omp_chase/oh-my-pi/crates/vendor/uu-find/src/find/matchers/access.rs
   check:rs | Update RUST_SCOPE_ALLOWLIST only when the new Rust surface has a native/performance rationale.
   check:rs | Exited with code 1
   check:ts | Done in 8.72s
   error: script "check" exited with code 1
   ```

## 기대와 다른 결과

요청서의 기대와 다른 새 실패는 없다. `packages/tui/`의 6건 실패는 요청서에 명시된 render-goldens 기존 이슈 목록과 일치했고, `commit-time-folding`의 1건 실패도 요청서에 명시된 `agent_end` 기존 이슈와 일치했다. 루트 `bun run check` 실패는 devlog chase/vendor Rust scope 검사에서 발생했으며, 이번 스크롤 seam 변경 파일들과 관련된 TUI 또는 coding-agent 타입/biome 게이트는 통과했다.
