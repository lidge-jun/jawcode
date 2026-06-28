# 531 Phase 53 audit — media egress primitives (independent, read-only)

Auditor: independent CLI sub-agent (read-only), with live Telegram Bot API doc check.
Inputs: plan `530`, card `10.034`, `workspace-path-confinement.ts`, `telegram-api.ts`.

## Verdict: PASS — no changes required

(a) **Dead-code safety**: pass-1 multipart senders have no model-facing caller (no tool, render mapper,
or frame handler wires them yet); dead code cannot egress. Reachable only when phase 54 explicitly calls
them. No ambient trigger.

(b) **Size/MIME policy sound**: photo exts ≤ 10 MB → sendPhoto, oversize photo or other ≤ 50 MB →
sendDocument, > 50 MB → too_large — matches Bot API multipart caps. Extension-only classification is
acceptable for pass 1 (files are workspace-confined; mis-typed file fails at the API); declared MIME is
advisory only. MIME magic-byte/spoofing checks deferrable to the pass-2 tool layer.

(c) **Token-safety**: the multipart URL contains `/bot<token>/...`; any fetch error string carrying the
URL MUST be sanitized — the existing `text.split(token).join("***")` pattern handles it; token is not in
the form body. No extra pass-1 requirement.
