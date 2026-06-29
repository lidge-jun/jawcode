/**
 * Truncation detection for the Kiro / CodeWhisperer stream.
 *
 * CodeWhisperer can cut a response short (token/length limits, upstream incidents) and signal it
 * via a finish/stop-reason field or a `truncated` flag, or simply by ending the stream mid tool
 * call. Without detection the partial output looks like a normal completion and the malformed tool
 * call surfaces downstream as a confusing `REQUEST_BODY_INVALID` on the *next* turn. Surfacing a
 * fail-closed error here lets the caller retry cleanly. Parity with opencodex `kiro-truncation.ts`.
 */

import { redactSecretString } from "./kiro-errors";

const REASON_KEYS = ["finish_reason", "finishReason", "stop_reason", "stopReason", "completionReason", "reason"];
const TRUNCATION_PATTERN = /length|max[_-]?tokens?|truncat|incomplete|context_length/i;

function safeString(value: unknown): string | undefined {
	return typeof value === "string" && value.trim().length > 0 ? value.trim() : undefined;
}

/**
 * Inspect a parsed Kiro event object for a truncation signal. Returns the reason string when the
 * event carries an explicit `truncated: true` flag or a finish/stop-reason that matches a known
 * truncation pattern (length / max_tokens / truncated / incomplete / context_length); otherwise
 * undefined.
 */
export function kiroTruncationReason(parsed: Record<string, unknown>): string | undefined {
	if (parsed.truncated === true) return "truncated";
	for (const key of REASON_KEYS) {
		const value = safeString(parsed[key]);
		if (value && TRUNCATION_PATTERN.test(value)) return value;
	}
	return undefined;
}

/**
 * A finished tool-call argument buffer is "complete" only if it is empty (no args) or parses to a
 * JSON object. A non-empty buffer that fails to parse means the stream was cut mid-JSON.
 */
export function isCompleteKiroToolInput(input: string): boolean {
	const trimmed = input.trim();
	if (!trimmed) return true;
	try {
		const parsed = JSON.parse(trimmed) as unknown;
		return parsed !== null && typeof parsed === "object";
	} catch {
		return false;
	}
}

/** Stable, redacted, fail-closed error message for a truncated Kiro response. */
export function kiroTruncationErrorMessage(reason?: string): string {
	const suffix = reason ? ` (${redactSecretString(reason).slice(0, 160)})` : "";
	return `Kiro response truncated upstream before the tool call completed${suffix}`;
}
