# Evidence Receipt: TUI Patch A/B/C Verification

Date: 2026-07-09
Workspace: `/Users/jun/Developer/new/700_projects/jawcode`

## Scope

Applied three TUI patches:
- Patch A: split UTF-8 stdin decoding fix in `packages/tui/src/stdin-buffer.ts`
- Patch B: preserve input before bracketed paste in `packages/tui/src/stdin-buffer.ts` and `packages/tui/test/stdin-buffer.test.ts`
- Patch C: ghost undo snapshot fix in `packages/tui/src/components/editor.ts`

## Commands Run

### `bun build --no-bundle packages/tui/src/stdin-buffer.ts 2>&1 | head -3`

Output:

```text
import { StringDecoder } from "node:string_decoder";
import { EventEmitter } from "events";
const ESC = "\x1B";
```

Judgement: Passed. The build command emitted compiled output and no error text in the requested first three lines.

### `bun build --no-bundle packages/tui/src/components/editor.ts 2>&1 | head -3`

Output:

```text
import { getProjectDir, logger } from "@jawcode-dev/utils";
import { BracketedPasteHandler } from "../bracketed-paste";
import { getKeybindings } from "../keybindings";
```

Judgement: Passed. The build command emitted compiled output and no error text in the requested first three lines.

### `bun test packages/tui/test/stdin-buffer.test.ts 2>&1 | tail -10`

Output:

```text
(pass) StdinBuffer > UTF-8 multi-byte decoding (issue #454) > resets decoder state on clear() so a stale prefix cannot complete [0.02ms]
(pass) StdinBuffer > UTF-8 multi-byte decoding (issue #454) > resets decoder state on destroy() so a stale prefix cannot complete [0.01ms]
(pass) StdinBuffer > UTF-8 multi-byte decoding (issue #454) > preserves pending single-byte UTF-8 lead as meta before ASCII input [0.02ms]
(pass) StdinBuffer > UTF-8 multi-byte decoding (issue #454) > preserves pending single-byte UTF-8 lead as meta before control input [0.02ms]
(pass) StdinBuffer > UTF-8 multi-byte decoding (issue #454) > preserves legacy invalid single-high-byte meta conversion (ESC + byte-128)

 46 pass
 0 fail
 93 expect() calls
Ran 46 tests across 1 file. [109.00ms]
```

Judgement: Passed. The focused stdin-buffer test suite reports 46 passing tests, 0 failures, and 93 expectations.

## Final Judgement

All requested verification commands passed after applying the patches.
