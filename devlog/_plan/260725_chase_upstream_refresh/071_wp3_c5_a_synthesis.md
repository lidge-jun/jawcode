# 071 — wp3 cycle 5 A-stage synthesis

Auditor: Ampere (019f9cea-f60a-7050-97b8-fe8e8eb47a68), verdict **GO-WITH-FIXES (blockers=5, one Critical)**.
Main judgment: **near-pass → A>B** — all folded into 070; scope reduced from 12 to 10 anchors.

| # | severity | disposition |
|---|---|---|
| 1 Codex login destroys credentials before OAuth succeeds | Critical | **accepted, scope removed** — `91061fe82`/`2a0d819e7` escalated to a dedicated C4 unit. `remove(provider)` runs before login completes (`auth-storage.ts:1419-1429` → `:1235-1245` → `:4070-4075`), so an identity-key change layered on that path can lose real user credentials. Not an autonomous chase import. |
| 2 old/new/mixed identity consumer + deletion matrix incomplete | High | folded via #1 — the whole identity slice leaves this cycle; the requirement list is recorded in the residual for the future unit |
| 3 one dead credential blocks all catalog refresh (self-DoS) | High | folded — transient failure aborts replacement (upstream-faithful), definitive `invalid_grant`/revoked is quarantined and excluded with a per-account warning; network/timeout never disables or deletes |
| 4 qualified `/v1/models` ids unusable in requests | High | folded — resolver changes with the response, canonical `provider/model` resolution + unambiguous bare-id aliases + explicit ambiguity error; `auth-gateway-cli.ts` and `docs/auth-broker-gateway.md` added to Q2 |
| 5 authenticated preference silently reroutes bare selectors | High | folded — explicit `--provider` / `provider/model` / configured binding always win; only unqualified+flat ids consult the authenticated subset; diagnostic on reroute |

Non-blocking notes adopted: offline requirements for `5ec402fc1` (zero refresh offline, bounded foreground refresh, non-blocking background); stats split into its own commit; the four needs-redesign deferrals confirmed honest.

Scope effect: **10 anchors** implemented this cycle (Q1 six, Q2 three, Q3 one) plus the stats commit; identity slice deferred.
