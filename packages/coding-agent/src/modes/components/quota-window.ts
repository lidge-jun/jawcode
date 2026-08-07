/**
 * Classify a usage limit into the two windows the status line shows.
 *
 * Providers do not agree on how a window identifies itself, so a bare
 * `windowId === "5h"` comparison silently drops rows it should have matched:
 *
 * - **Case.** The usage layer already compares defensively
 *   (`windowId?.toLowerCase()` in `usage/openai-codex.ts`); the status line did
 *   not, so a `5H` from any provider would miss.
 * - **Duration.** `openai-codex` derives its id from the reported window
 *   seconds, so a limit can be a five-hour window while calling itself `1h`.
 *   The usage layer already falls back to `durationMs`; this mirrors that.
 * - **Per-model rows.** Anthropic tags those with `tier` (`opus`, `sonnet`).
 *   openai-codex tags them with `modelId` while ALSO always setting `tier` to
 *   the plan slug — so filtering on `tier` alone rejected every codex limit.
 *   Callers filter on `modelId`; `tier` is only meaningful for providers that
 *   leave it unset on the account-wide row.
 */

const FIVE_HOURS_MS = 5 * 60 * 60 * 1000;
const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;
/** How far a reported duration may drift and still count as the same window. */
const DURATION_TOLERANCE_MS = 60_000;

export type QuotaWindowBucket = "5h" | "7d" | null;

function withinTolerance(durationMs: number | undefined, target: number): boolean {
	return (
		typeof durationMs === "number" &&
		Number.isFinite(durationMs) &&
		Math.abs(durationMs - target) <= DURATION_TOLERANCE_MS
	);
}

export function classifyQuotaWindow(
	windowId: string | undefined,
	durationMs?: number,
	tier?: string,
): QuotaWindowBucket {
	const id = windowId?.trim().toLowerCase();

	// Anthropic distinguishes its per-model rows with `tier` and leaves the
	// account-wide row without one. Providers that always set `tier` are handled
	// by the caller's `modelId` filter instead.
	const isAnthropicPerModelRow = tier === "opus" || tier === "sonnet";
	if (isAnthropicPerModelRow) return null;

	if (id === "5h" || withinTolerance(durationMs, FIVE_HOURS_MS)) return "5h";
	if (id === "7d" || withinTolerance(durationMs, SEVEN_DAYS_MS)) return "7d";
	return null;
}
