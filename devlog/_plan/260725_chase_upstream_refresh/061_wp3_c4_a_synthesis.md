# 061 — wp3 cycle 4 A-stage synthesis

Auditor: Franklin (019f9cd2-b998-7533-a0e6-2c8d437d1198), verdict **GO-WITH-FIXES (blockers=6)**.
Main judgment: **near-pass → A>B** — all folded into 060; no open residuals.

| # | severity | disposition |
|---|---|---|
| 1 Cursor `turnEnded` compatibility | High | folded — DEScoped to the evidenced half (settle at protocol end); strict rejection becomes a residual needing production stream capture; characterization test pins current success path |
| 2 Anthropic compat field outside write set | High | folded — `types.ts` added to P3; new `allowAnthropicHeaderOverrides`; allowlist-only overrides; redirect-leak test required |
| 3 Kimi mandatory-reasoning metadata absent | High | folded — enumerated K3 predicate this cycle (models named in code + tests); data-driven `ThinkingConfig` field recorded as residual; no `mapOptionsForApi` rerouting |
| 4 `3f5fec0c0` under-scoped | High | folded — Bedrock added to P3, Cursor slice added to P2; Azure/Codex/Responses call sites explicitly deferred with reason |
| 5 Claude identity fallback risk | Medium | folded — explicit precedence (payload account/user → credential.accountId → profile), org only in `metadata.orgId`, undefined-accountId guard + 3 test cases |
| 6 Google failover structural | Medium | folded — P1 requires hoisted endpoint iteration with 5 named invariants |
| 7 P3 test-file ownership | (warning) | folded — P3 assigned to ONE worker; shared `openai-completions-compat.test.ts` noted |

Scope effect: 7 import anchors remain in scope, but `4a9eaf63b` lands partially (safe half) and `3f5fec0c0` widens to 3 call sites.
