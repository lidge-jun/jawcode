# 12 Phase 1 continuation audit — notification session registry

## Audit record

| Auditor | Scope | Verdict | Evidence |
|---|---|---|---|
| Backend/security | API signatures, token rejection, frame mapping, stale cleanup, no-network scope | NEEDS_FIX then PASS | Initial audit required removing/defering `close()`, specifying `markStaleNotificationDiscoveryRecord(stateRoot, sessionId, now?)`, mapping `resolveRemote()` accepted/rejected frames, persisting action context, pinning `hello.version`, and clarifying token leak boundaries. The plan was fixed and re-audited PASS. |
| Docs | numbering, card references, JWC naming, chase update posture | PASS | Verified `11-14` numbering, references to `10.028`/`10.030`/`10.032`, naming boundary via JWC-first wording, and conservative `10.028` evidence plan. |

## Applied plan fixes

- Removed `close()` from this slice and explicitly deferred shutdown metadata until a real endpoint/lifecycle owner exists.
- Added full stale-marker signature and behavior.
- Added accepted/rejected remote frame mapping and accepted context persistence.
- Required authorized `hello` to use `NOTIFICATION_PROTOCOL_VERSION`.
- Clarified that wire/connect/reject/resolve JSON cannot include the connect token, while discovery persistence may contain it only in `0600` endpoint records.
