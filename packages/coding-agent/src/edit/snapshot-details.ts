/**
 * Bound the size of the `oldText` / `newText` snapshots that edit-tool results
 * carry in `details`. These fields hold the full pre/post file content; for
 * large files they balloon the per-turn session JSONL line without paying for
 * any LLM context (provider serializers send only `content`, never `details`).
 *
 * The sole runtime consumer of the raw snapshots is the ACP event mapper, which
 * builds a `diff` ToolCallContent for ACP clients. When the snapshots are pruned
 * the mapper returns no diff for that file and the text content still flows —
 * diff visualization degrades gracefully for over-threshold edits.
 */

import type { EditToolDetails, EditToolPerFileResult } from "./renderer";

/**
 * Combined `oldText` + `newText` character budget for a single edit-tool
 * result. Applies both per-entry (one file at a time) and as an aggregate
 * across `perFileResults` (so a many-small-files batch can't accumulate
 * unbounded snapshot bytes).
 *
 * Picked so typical code-file edits keep ACP diff visualization while
 * pathological cases (large generated files, full-file rewrites, or many-file
 * batches) drop the raw snapshots before they hit the session JSONL.
 */
export const MAX_EDIT_SNAPSHOT_TEXT_CHARS = 32_768;

type WithSnapshot = { oldText?: string; newText?: string };

function snapshotLength(entry: WithSnapshot): number {
	return (entry.oldText?.length ?? 0) + (entry.newText?.length ?? 0);
}

function pruneSnapshot<T extends WithSnapshot>(details: T): T {
	if (snapshotLength(details) <= MAX_EDIT_SNAPSHOT_TEXT_CHARS) {
		return details;
	}
	const { oldText: _old, newText: _new, ...rest } = details;
	return rest as T;
}

/**
 * Cap per-file snapshots with a single shared aggregate budget. Each entry is
 * first pruned individually; if an entry's surviving bytes would push the
 * running aggregate past the cap, the entry is stripped and stamped
 * `snapshotsPruned: true`. Early entries keep their ACP diff visualization;
 * later over-budget entries degrade to text-only.
 */
function capPerFileSnapshots(entries: EditToolPerFileResult[]): EditToolPerFileResult[] {
	let remaining = MAX_EDIT_SNAPSHOT_TEXT_CHARS;
	return entries.map(entry => {
		const perEntry = pruneSnapshot(entry);
		const kept = snapshotLength(perEntry);
		if (kept === 0) return perEntry;
		if (kept <= remaining) {
			remaining -= kept;
			return perEntry;
		}
		const { oldText: _old, newText: _new, ...rest } = perEntry;
		return { ...rest, snapshotsPruned: true };
	});
}

/**
 * Prune oversized `oldText` / `newText` from an edit-tool details payload,
 * recursing into `perFileResults` when present. The per-file overload comes
 * first so the more specific shape (required `path`) wins overload resolution
 * at the per-file call sites.
 */
export function pruneOversizedEditSnapshots(details: EditToolPerFileResult): EditToolPerFileResult;
export function pruneOversizedEditSnapshots(details: EditToolDetails): EditToolDetails;
export function pruneOversizedEditSnapshots(
	details: EditToolDetails | EditToolPerFileResult,
): EditToolDetails | EditToolPerFileResult {
	const pruned = pruneSnapshot(details);
	if ("perFileResults" in pruned && pruned.perFileResults) {
		return { ...pruned, perFileResults: capPerFileSnapshots(pruned.perFileResults) };
	}
	return pruned;
}
