# 370 Phase 37 plan — Telegram poll/send client + daemon owner-claim (10.030 slice 1)

> Card `10.030` (managed Telegram daemon) is large: a long-lived process owning the Telegram
> `getUpdates` long-poll, a session scanner, owner singleton + reload/stop. Phase 2 already shipped
> the transport-state owner/roots/heartbeat/fingerprint foundation and the transport-shell scanner.
> This card needs MULTIPLE work-phases; this slice does the testable network + ownership cores.
> Risk class: **C3** (network boundary + process ownership) — token-safe, fetch-injected, unit-tested.

## Work-phase slice map (10.030)
- **Phase 37 (this)** — Telegram API client (`getUpdates` poll w/ offset+timeout, `sendMessage`,
  retry/backoff classification, token-safe) + daemon **owner-claim decision** (who may own the poll).
  Pure/fetch-based, fully unit-tested. Does NOT spawn a process.
- **Phase 38** — managed daemon engine: scan registered roots → connect endpoints, drive the poll
  loop via the client, apply owner-claim; in-process (testable with fake client/clock), no OS spawn.
- **Phase 39** — process spawn + `reload`/`stop` owner-scoped control + compiled daemon smoke; closes 10.030.

## Part 1 — plain explanation (this slice)
A daemon will eventually run one Telegram poll loop shared by all local sessions. Before building the
long-lived process, this phase lands its two testable cores: a token-safe Telegram API client (poll for
updates, send a message, classify errors as retryable/fatal with backoff) and the pure decision that
picks exactly one owner for the poll (so two sessions never both poll and trigger Telegram's 409).

## Part 2 — diff-level plan

### 1. NEW `packages/coding-agent/src/notifications/telegram-api.ts` (~110 lines, unit-tested)
```ts
export interface TelegramUpdate { update_id: number; /* opaque passthrough */ [k: string]: unknown; }
export type TelegramCallOutcome<T> =
  | { ok: true; result: T }
  | { ok: false; retryable: boolean; status?: number; retryAfterMs?: number; reason: string };
export async function getTelegramUpdates(opts: {
  token: string; offset?: number; timeoutSec?: number; fetchImpl?: typeof fetch; signal?: AbortSignal;
}): Promise<TelegramCallOutcome<TelegramUpdate[]>>;
export async function sendTelegramMessage(opts: {
  token: string; chatId: string; text: string; fetchImpl?: typeof fetch;
}): Promise<TelegramCallOutcome<{ message_id: number }>>;
export function classifyTelegramError(status: number | undefined, body: { description?: string;
  parameters?: { retry_after?: number } } | undefined): { retryable: boolean; retryAfterMs?: number; reason: string };
export function nextBackoffMs(attempt: number, base?: number, cap?: number): number; // exp backoff + cap
```
- Token kept out of all `reason`/log text (sanitized like `telegram-pairing.ts`).
- `getUpdates`: `?offset=&timeout=` long-poll; 409 → `retryable:false, reason:"conflict"` (another owner);
  429 → retryable with `retry_after`; 5xx/network → retryable; 401/400 → fatal.
- `nextBackoffMs`: `min(cap, base * 2^attempt)` with default base 500ms, cap 30s.

### 2. NEW `packages/coding-agent/src/notifications/daemon-owner.ts` (~50 lines, unit-tested)
```ts
export type OwnerClaimDecision =
  | { action: "claim"; reason: "no-owner" | "stale-owner" }
  | { action: "defer"; reason: "live-owner" }
  | { action: "keep"; reason: "self-owner" };
export function decideOwnerClaim(input: {
  current: TransportOwnerState | null; candidate: TransportIdentity & { pid: number }; now: number;
  heartbeatTtlMs?: number; pidAlive?: (pid: number) => boolean;
}): OwnerClaimDecision;
```
Reuses `isFreshLiveTransportOwner`/`sameTransportIdentity`/`defaultPidAlive` from transport-state:
no owner → claim; same identity+pid → keep (self); fresh-live different owner → defer; stale/dead → claim.

### 3. MODIFY `packages/coding-agent/src/notifications/index.ts` — export both modules.

### Tests
- NEW `test/notifications-telegram-api.test.ts`: getUpdates ok (offset/timeout in URL); 409→fatal
  conflict; 429→retryable with retryAfterMs; 5xx/throw→retryable; 401→fatal; sendMessage ok + masks
  token; `classifyTelegramError` branches; `nextBackoffMs` exp+cap. (fake fetch)
- NEW `test/notifications-daemon-owner.test.ts`: no-owner→claim; self→keep; live-different→defer;
  stale (heartbeat expired) → claim; dead-pid → claim. (injected clock + pidAlive)

### NEW devlog `371_audit`, `372_build`, `373_check`. Pre-scaffold `380_phase38_*`, `390_phase39_*` stubs.

## PABCD
- **A**: independent audit — TransportOwnerState/TransportIdentity field names, fingerprint reuse, no
  token in logs, Telegram error-code mapping correctness, fetch injection testability.
- **B**: Boss writes both modules + tests; re-read transport-state signatures first.
- **C**: both suites + full notifications regression + `check:types` + biome + diff-check.
- **D**: commit; record that 10.030 stays OPEN (daemon engine = phase 38, process/reload = phase 39).

## Constraints
- Token never logged or in `reason`. `.jwc` roots. ES modules; files ≤400 lines. No OS process spawn
  this slice. Do NOT close 10.030.
