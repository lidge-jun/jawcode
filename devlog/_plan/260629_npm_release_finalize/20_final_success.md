# Phase 3: OIDC Release Success (1.1.2)

## Timeline
- 1.1.0: bootstrap publish (manual OTP, 8 packages)
- 1.1.1: first OIDC attempt — natives ENEEDAUTH (Trusted Publisher missing for natives/jawcode)
- 1.1.2: full OIDC success after TP configured for all 10 packages

## Root Causes Fixed
1. **E422 (provenance)**: `repository.url` missing in jwc + cu-mcp-server manifests
2. **E404 (token shadow)**: `setup-node` registry-url writes `_authToken=${NODE_AUTH_TOKEN}` → scrub step added
3. **ENEEDAUTH**: Trusted Publisher not set on `@jawcode-dev/natives` + `jawcode` → user configured via npm web

## Final State
- Run: `28347414262` (success)
- Commit: `c963d5f` (main)
- All 10 packages: `@1.1.2` with `dist.attestations=true`
- Provenance: signed via GitHub Actions OIDC
- No token/OTP needed for future releases

## Packages Published
| Package | Version | Provenance |
|---------|---------|-----------|
| @jawcode-dev/utils | 1.1.2 | ✅ |
| @jawcode-dev/ai | 1.1.2 | ✅ |
| @jawcode-dev/natives | 1.1.2 | ✅ |
| @jawcode-dev/tui | 1.1.2 | ✅ |
| @jawcode-dev/stats | 1.1.2 | ✅ |
| @jawcode-dev/agent-core | 1.1.2 | ✅ |
| @jawcode-dev/coding-agent | 1.1.2 | ✅ |
| @jawcode-dev/bridge-client | 1.1.2 | ✅ |
| jawcode-cu-mcp-server | 1.1.2 | ✅ |
| jawcode | 1.1.2 | ✅ |
