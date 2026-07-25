# 030 — WP3: Auth/Transport

2 cards: 20.047, 20.079

## 20.047 — xAI device flow
- MODIFY: `packages/ai/src/utils/oauth/` (device flow implementation)
- MODIFY: `packages/ai/src/providers/xai.ts` (credit-exhaustion rotation)
- MODIFY: `packages/ai/src/providers/` (capability-gated replay reshaping)
- VERIFY: device flow login test, rotation test

## 20.079 — Codex Lite
- MODIFY: `packages/ai/src/providers/codex.ts` (responsesLite branch)
- MODIFY: tool-choice shaping (hosted→auto downgrade)
- NEW: OTLP log/metric export alongside traces
- MODIFY: image generation (per-request provider selection)
- VERIFY: Lite tool-choice constraint test, OTLP signal test
