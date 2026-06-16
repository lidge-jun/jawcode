import type { BackgroundRowView } from "./jobs-observer";

export function isBackgroundAttention(row: BackgroundRowView): boolean {
	return row.status === "failed" || row.status === "cancelled" || row.terminalLatched;
}

function backgroundStatusRank(row: BackgroundRowView): number {
	if (isBackgroundAttention(row)) return 0;
	if (row.status === "running" || row.status === "queued") return 1;
	if (row.status === "paused") return 2;
	return 3;
}

export function sortBackgroundRows(rows: BackgroundRowView[]): BackgroundRowView[] {
	const timeOf = (row: BackgroundRowView): number => row.startTime ?? row.nextFireAt ?? 0;
	return [...rows].sort((a, b) => backgroundStatusRank(a) - backgroundStatusRank(b) || timeOf(b) - timeOf(a));
}
