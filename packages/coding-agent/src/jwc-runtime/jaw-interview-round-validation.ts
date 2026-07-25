import type { StateValidationResult } from "./state-validation";

/**
 * Adapted from GJC deep-interview "validate scored transitions before persisting"
 * (#606/#609). GJC enforces a trigger-based bidirectional invariant against a
 * recorder lifecycle that JWC does not have — JWC interview rounds are authored by
 * the host AI and persisted through `jwc state write`. So this validator is the JWC
 * adaptation: a fail-closed **shape/range** check on the persisted round metadata
 * that JWC's own HUD consumes (buildHudForMode "jaw-interview"). It refuses obviously
 * corrupt rounds at write time so the HUD cannot render NaN/out-of-range chips and a
 * malformed interview state cannot persist silently.
 *
 * Backward-compatible: only fields that are present are validated. Absent `rounds`
 * or `current_ambiguity`, and rounds without `ambiguity`/`dimensions`, all pass so
 * legacy/transcript-only writes and the seed `{ rounds: [], current_ambiguity: 1.0 }`
 * remain valid.
 */

const DIMENSION_KEYS = ["goal", "constraint", "success", "ontology"] as const;

function isPlainObject(value: unknown): value is Record<string, unknown> {
	return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function isAmbiguityInRange(value: number): boolean {
	return Number.isFinite(value) && value >= 0 && value <= 1;
}

function isDimensionScore(value: number): boolean {
	return Number.isInteger(value) && value >= 0 && value <= 3;
}

function readRounds(state: Record<string, unknown>): unknown {
	// JWC flattens `state.*` to top-level on write, but accept either shape.
	if ("rounds" in state) return state.rounds;
	const inner = state.state;
	if (isPlainObject(inner) && "rounds" in inner) return inner.rounds;
	return undefined;
}

function readCurrentAmbiguity(state: Record<string, unknown>): unknown {
	if ("current_ambiguity" in state) return state.current_ambiguity;
	const inner = state.state;
	if (isPlainObject(inner) && "current_ambiguity" in inner) return inner.current_ambiguity;
	return undefined;
}

/**
 * Validate the jaw-interview round-shape contract. Returns `{ valid: true }` when the
 * state carries no round metadata or the metadata is well-formed; otherwise returns a
 * descriptive error so the caller can fail the write closed.
 */
export function validateJawInterviewRounds(state: unknown): StateValidationResult {
	if (!isPlainObject(state)) return { valid: true };

	const currentAmbiguity = readCurrentAmbiguity(state);
	if (currentAmbiguity !== undefined) {
		if (typeof currentAmbiguity !== "number" || !isAmbiguityInRange(currentAmbiguity)) {
			return {
				valid: false,
				error: `jaw-interview current_ambiguity must be a number in [0,1], got ${JSON.stringify(currentAmbiguity)}`,
			};
		}
	}

	const rounds = readRounds(state);
	if (rounds === undefined) return { valid: true };
	if (!Array.isArray(rounds)) {
		return { valid: false, error: `jaw-interview rounds must be an array when present, got ${typeof rounds}` };
	}

	for (let index = 0; index < rounds.length; index++) {
		const round = rounds[index];
		// Free-form/transcript rows that are not objects are tolerated (legacy shape).
		if (!isPlainObject(round)) continue;

		if (round.ambiguity !== undefined) {
			if (typeof round.ambiguity !== "number" || !isAmbiguityInRange(round.ambiguity)) {
				return {
					valid: false,
					error: `jaw-interview rounds[${index}].ambiguity must be a number in [0,1], got ${JSON.stringify(
						round.ambiguity,
					)}`,
				};
			}
		}

		if (round.dimensions !== undefined) {
			if (!isPlainObject(round.dimensions)) {
				return {
					valid: false,
					error: `jaw-interview rounds[${index}].dimensions must be an object when present, got ${typeof round.dimensions}`,
				};
			}
			for (const key of DIMENSION_KEYS) {
				const score = round.dimensions[key];
				if (score === undefined) continue;
				if (typeof score !== "number" || !isDimensionScore(score)) {
					return {
						valid: false,
						error: `jaw-interview rounds[${index}].dimensions.${key} must be an integer in [0,3], got ${JSON.stringify(
							score,
						)}`,
					};
				}
			}
		}
	}

	return { valid: true };
}
