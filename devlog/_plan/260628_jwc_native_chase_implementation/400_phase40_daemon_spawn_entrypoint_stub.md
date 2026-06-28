# 400 Phase 40 (stub) — daemon spawn entrypoint + smoke (closes 10.030)

> Final slice of card 10.030. Planned after phase 39 (control + loop). The behavioral core
> (owner-claim, engine tick, control, loop) is complete and tested across phases 2/37/38/39.

Scope (to be planned at phase entry):
- A runnable entrypoint that wires `runDaemonLoop` to real I/O: `readDaemonControl`/`readTransportOwner`/
  `clearDaemonControl`, real `setTimeout` sleep, `runDaemonTick`, and `markTransportOwnerStopped` onStop.
- Launch mechanism: hidden `jwc notify daemon-internal` (or public `jwc daemon`) — resolve the open
  product decision (public CLI vs internal-only).
- A compiled/integration daemon smoke equivalent to the upstream `g005-daemon-smoke.ts` /
  `g011-daemon-path-smoke.ts` (mocked Telegram fetch; assert one owner + bounded poll + clean stop).
- Closes card 10.030 once the smoke + entrypoint exist and the 6 behavioral done-gates are demonstrated
  end-to-end.
