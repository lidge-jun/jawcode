import type { SelectItem } from "@jawcode-dev/tui";
import { KEYBINDINGS } from "../../config/keybindings";
import { isBackgroundAttention, sortBackgroundRows } from "../background-row-model";
import type { BackgroundRowView, BackgroundWorkKind, JobsSnapshot } from "../jobs-observer";
import { formatRelative } from "./jobs-overlay-model";

export interface BackgroundFooterRow {
	id: string;
	kind: BackgroundWorkKind;
	label: string;
	status: BackgroundRowView["status"];
	hint?: string;
	attention: boolean;
}

export interface BackgroundFooterModel {
	compactText: string | undefined;
	rows: BackgroundFooterRow[];
	attention: boolean;
	totalVisible: number;
}

const KIND_ORDER: BackgroundWorkKind[] = ["sub", "sh", "mon", "cron", "q"];

function countRows(rows: BackgroundRowView[]): Record<BackgroundWorkKind, { count: number; attention: boolean }> {
	const counts: Record<BackgroundWorkKind, { count: number; attention: boolean }> = {
		sub: { count: 0, attention: false },
		sh: { count: 0, attention: false },
		mon: { count: 0, attention: false },
		cron: { count: 0, attention: false },
		q: { count: 0, attention: false },
	};
	for (const row of rows) {
		counts[row.kind].count++;
		if (isBackgroundAttention(row)) counts[row.kind].attention = true;
	}
	return counts;
}

function buildCompactText(rows: BackgroundRowView[]): string | undefined {
	if (rows.length === 0) return undefined;
	const counts = countRows(rows);
	const parts = KIND_ORDER.flatMap(kind => {
		const entry = counts[kind];
		if (entry.count === 0) return [];
		return [`${entry.count}${kind}${entry.attention ? "!" : ""}`];
	});
	const keyHint = Array.isArray(KEYBINDINGS["app.background.expand"].defaultKeys)
		? KEYBINDINGS["app.background.expand"].defaultKeys[0]
		: KEYBINDINGS["app.background.expand"].defaultKeys;
	return parts.length === 0 ? undefined : `bg ${parts.join(" ")} · ${keyHint}`;
}

function rowHint(row: BackgroundRowView): string | undefined {
	if (row.status === "scheduled") return row.nextFireAt ? formatRelative(row.nextFireAt) : "scheduled";
	if (row.status === "failed" || row.status === "cancelled") return row.status;
	if (row.status === "queued" || row.status === "paused") return row.status;
	return row.startTime ? formatRelative(row.startTime) : row.status;
}

export function buildBackgroundFooterModel(snapshot: JobsSnapshot): BackgroundFooterModel {
	const sourceRows = sortBackgroundRows(snapshot.backgroundRows);
	const rows = sourceRows.map(row => ({
		id: row.id,
		kind: row.kind,
		label: row.label,
		status: row.status,
		hint: rowHint(row),
		attention: isBackgroundAttention(row),
	}));
	return {
		compactText: buildCompactText(sourceRows),
		rows,
		attention: rows.some(row => row.attention),
		totalVisible: rows.length,
	};
}

export function buildBackgroundDetailItems(snapshot: JobsSnapshot, rowId: string): SelectItem[] {
	const row = snapshot.backgroundRows.find(candidate => candidate.id === rowId);
	if (!row) return [{ value: "back", label: "Back", description: "Background row no longer exists" }];
	const items: SelectItem[] = [
		{ value: "noop:kind", label: "Kind", description: row.kind },
		{ value: "noop:label", label: "Label", description: row.label },
		{ value: "noop:status", label: "Status", description: row.status },
	];
	if (isBackgroundAttention(row)) items.push({ value: "noop:attention", label: "Attention", description: "required" });
	if (row.description) items.push({ value: "noop:description", label: "Description", description: row.description });
	if (row.startTime) items.push({ value: "noop:age", label: "Started", description: formatRelative(row.startTime) });
	if (row.nextFireAt) items.push({ value: "noop:next", label: "Next", description: formatRelative(row.nextFireAt) });
	if (row.outputPreview) items.push({ value: "noop:output", label: "Output", description: row.outputPreview });
	if (row.resultPreview) items.push({ value: "noop:result", label: "Result", description: row.resultPreview });
	if (row.errorPreview) items.push({ value: "noop:error", label: "Error", description: row.errorPreview });
	items.push({ value: "back", label: "Back" });
	return items;
}
