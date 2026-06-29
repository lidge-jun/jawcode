# B3 fix — tool_stop must target the open tool (PABCD check finding)

Found by the gpt-5.5 PABCD check reviewer (Hegel) reviewing B3.

## Bug

The `tool_stop` handler ignored `event.toolUseId`: any stop frame validated/finalized whatever
tool was currently open. With parallel/interleaved tools, a DELAYED stop for an earlier tool —
already finalized by the interleaving recovery in `tool_start`/`tool_input` — could arrive while a
DIFFERENT tool was still open. That stale stop would finalize the open tool early, or worse,
false-trigger the new B3 incomplete-JSON fail-closed check against the still-streaming tool's
partial buffer, turning a legitimate parallel stream into a spurious truncation error.

Sequence: `t1 start`, `t1 input`, `t2 start` (t1 finalized), `t2 input(partial)`, `t1 stop`(stale),
`t2 input(rest)`, `t2 stop`.

## Fix

`tool_stop` now ignores a stop whose `toolUseId` does not match the currently open tool (and a stop
with no open tool). Only a stop for the open tool runs the incomplete-JSON guard + finalize. This
keeps the fail-closed truncation behavior for the real open tool while not disturbing parallel
interleaving.

## Test

- `kiro-stream-integration.test.ts`: "a delayed stop for an already-finalized tool does not disturb
  the open tool" — t2 stays partial across t1's stale stop and completes correctly.

## Verify

- `bun test` kiro stream/payload/truncation suites — green. `check:types` clean; biome clean.
