# 051 — wp3 cycle 3 A-stage synthesis

Auditor: Avicenna (019f9a49-16d9-7aa1-8dbe-e9841777436d), verdict **GO-WITH-FIXES (blockers=7)**.
Main judgment: **near-pass → A>B** — all 7 folded into 050 amendments, no open residuals.

| # | severity | disposition |
|---|---|---|
| 1 W1 scope too narrow | High | folded — reworded "validated Anthropic web-search history preservation"; write set expanded (types.ts, replay/transform, snapshot owner) |
| 2 W1→compaction ordering | High | folded — types/wire → parser/stream/replay → compaction |
| 3 leaked-thinking oversize | High | folded — minimal JWC-native projector in openai-responses; no full module port |
| 4 idle sentinel misdirect | High | folded — shared normalizer untouched; OpenAI-specific resolver preserves 0; compat wiring + precedence tests |
| 5 cache semantics contradiction | Critical | folded — FINAL upstream state: cache payload has NO headers; live headers reconstituted from static config/AuthStorage; A3 reworded |
| 6 refresh call sites | High | folded — selector-controller.ts + command-dispatch.ts added to W3 write set |
| 7 rate-limit owner wrong | High | folded — owner is rate-limit-utils.ts; A4 = 3 concrete cases |
