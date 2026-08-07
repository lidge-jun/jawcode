# 072 — wp3 cycle 5 closeout: catalog discovery, selection, credential ranking

Outcome: **DONE** (10 anchors implemented; 4 needs-redesign deferred; 1 needs-decision escalated; 1 credential-identity slice escalated to its own C4 unit).

| phase | evidence |
|---|---|
| P | `070_wp3_c5_catalog_registry.md` — Linnaeus per-anchor stale check on the post-cycle-4 tree (12 import / 4 needs-redesign / 1 needs-decision) |
| A | Ampere GO-WITH-FIXES (5 blockers, 1 Critical) → `071` synthesis: workspace-scoped Codex identity REMOVED (JWC login soft-deletes all provider credentials before OAuth succeeds — real credential-loss risk), quarantine vs transient split, gateway resolver + alias window, selection precedence, offline refresh bounds |
| B | Fermat (Q1 discovery), Feynman (Q2 selection/gateway), Mendel (Q3 ranking + stats, with an approved session-pin timestamp expansion); Q1 type errors returned and properly fixed (SnapshotCredential union narrowing, `FetchImpl` instead of `typeof fetch`); commits `938bec2`, `3563001` |
| C | Herschel — **four rounds**: GO-WITH-FIXES ×3 then PASS. Each round reproduced a real bypass of the credential-quarantine classifier |

## The C-review chain (worth recording)

| round | reviewer finding | fix |
|---|---|---|
| 1 | any error text containing `401`/`403` was "definitive" → a proxy/WAF response permanently soft-deletes a working credential (no re-enable path) | require a structured OAuth terminal code (`a8ae137`) |
| 2 | the structured check was a REGEX over exception text → `<script>{"error":"invalid_grant"}</script>` and truncated JSON still quarantined | typed `OpenAICodexTerminalOAuthError`, thrown only from parsed JSON (`63fbfbc`) |
| 3 | every non-OK status was parsed → a WAF `502` with a valid JSON body still quarantined, contradicting our own 5xx-is-transient contract | gate on HTTP `400` only; 403/429/5xx categorically transient (`f39cb8b`) |
| 4 | discovery was hardened but request-time `getApiKey()` selection AND the background broker refresher still string-classified | typed-error gate on all three paths + full disable-call-site audit (`c16c416`) |

The worker's honesty mattered here: it reported the third path (`auth-broker/refresher.ts`) as outside its write set rather than claiming the guarantee, and scope was expanded to close it.

## Delivered

- Codex discovery unions every configured OAuth account with id dedupe; a partial union never replaces the effective catalog; transient refresh failure aborts authoritative replacement while a definitive credential is quarantined so healthy accounts keep refreshing; runtime/env token retained as fallback; caller fetch threaded with forced per-account refresh, a 10s abort that now reaches the underlying refresh, zero refresh attempts offline, non-blocking startup refresh; GPT-5.6 missing-window fallback pinned to 372K.
- CLI resolution prefers an authenticated provider for unqualified/flat ids only — explicit `--provider`, `provider/model` pins and configured bindings always win, with a diagnostic on reroute.
- Auth gateway advertises canonical `provider/model` ids AND resolves requests by them; unambiguous bare ids remain aliases, ambiguous ones return an explicit ambiguity error; docs and contract test updated.
- Anthropic-only 1h idle credential rerank (Codex stickiness intact) via new session-pin `lastUsedAtMs`.
- Stats overview total reconciles input + output + cache read/write.

## Residual (card 20.081)

- `91061fe82` / `2a0d819e7` workspace-scoped Codex credential identity — **own C4 unit**: needs login-atomicity repair first (Codex login removes all provider credentials before OAuth succeeds), plus legacy-row claim migration, per-workspace deletion/recovery, and rollback safety.
- `5b798685e` opaque gateway ids — needs a JWC-native catalog identity/reference boundary.
- `40ea23181` / `bab156183` / `63cac8dfd` — need LiteLLM rich-metadata discovery architecture first.
- `c98b1b83d` Moonshot K3 pricing/capability — **user decision** (monetary + capability claims shown to users).
- No re-enable/inspect CLI exists for a soft-disabled credential; recovery is re-login. Worth a follow-up.
