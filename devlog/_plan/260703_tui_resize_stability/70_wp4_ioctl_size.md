# 70 — WP4: kernel-truth terminal size (ioctl TIOCGWINSZ)

## Loop continuity / order rationale

Runs in PARALLEL with WP3b-min's fable review (user directive: keep cycling). Pulled
ahead of WP6a-B/WP6b/WP5 deliberately: those touch event-controller/tool components the
fable reviewer is actively tracing, while WP4 touches only `terminal.ts` + a NEW natives
module — zero collision. GPT Pro round-2/round-5 both endorsed the slice ("the current
process.stdout.columns getter remains a stale-size race until this lands").

## What (Part 1)

`process.stdout.columns` updates only after Node processes SIGWINCH — a render that
fires in that gap writes lines sized for the OLD width (R2, the resize-race corruption).
Reading the size straight from the kernel (`ioctl(1, TIOCGWINSZ)`) at render time closes
the race at the source: `#doRender` always sees the true PTY size, so `widthChanged`
trips on the very first post-resize render and takes the absolute-repaint path. The
flip-back detector (WP1) also starts comparing against kernel truth.

## Diff plan (Part 2)

### NEW crates/pi-natives/src/tty.rs (+ `pub mod tty;` in lib.rs)

```rust
#[napi(object)] pub struct TtyWinsize { pub rows: u32, pub cols: u32 }
#[napi] pub fn get_tty_winsize(fd: i32) -> Option<TtyWinsize>
```
unix: `libc::ioctl(fd, libc::TIOCGWINSZ as _, &mut winsize)`, Some only when rc==0 and
rows/cols > 0; non-unix: None. Rebuild committed binary (build regenerates exports).

### MODIFY packages/tui/src/terminal.ts

- `#kernelSize(): { rows, cols } | null` — try/catch around the native call (loader
  stub throws when the addon is missing → null → existing fallback chain).
- `get columns()` → `this.#kernelSize()?.cols || process.stdout.columns ||
  Number(process.env.COLUMNS) || 80`; `get rows()` analog.
- No mustAbsoluteNextFrame needed: with truth at render time, the stale-width render
  cannot exist — widthChanged handles the rest (existing absolute branches).

### NEW packages/natives/test/tty.test.ts

- non-TTY fd (pipe) → null; fd 1 under bun test (non-TTY) → null; when run on a real
  TTY locally the values are positive and match stdout.columns.

Cost: one ioctl per getter call (~µs), ~2 per render at 60fps — noise.
