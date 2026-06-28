# 390 Phase 39 (stub) — daemon process spawn + reload/stop (closes 10.030)

> Slice 3 of card 10.030. Planned after phase 38 (engine).

Scope (to be planned in full at phase entry):
- spawn the daemon as a detached process (or hidden `jwc notify daemon-internal`),
- owner-scoped `reload`/`stop` control that waits for old pid death before spawning a fresh poller
  (no double-poller overlap, no clobbering a newer owner request),
- compiled-binary daemon smoke test,
- decide public `jwc daemon` CLI vs internal-only (open product decision from card 10.030).

Closes card 10.030 once the done-gate (one owner per token/chat, no live double-poller, owner-scoped
reload/stop, endpoint connect within scan interval, transient-error survival, no secret logs) is met.
