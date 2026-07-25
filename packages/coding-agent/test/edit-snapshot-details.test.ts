import { describe, expect, test } from "bun:test";
import type { EditToolDetails, EditToolPerFileResult } from "@jawcode-dev/coding-agent/edit";
import { MAX_EDIT_SNAPSHOT_TEXT_CHARS, pruneOversizedEditSnapshots } from "@jawcode-dev/coding-agent/edit";

const big = (n: number) => "x".repeat(n);

describe("pruneOversizedEditSnapshots", () => {
	test("passes small single-edit snapshots through unchanged", () => {
		const details: EditToolDetails = {
			diff: "d",
			path: "/a.ts",
			firstChangedLine: 1,
			op: "update",
			oldText: big(10),
			newText: big(10),
		};
		const out = pruneOversizedEditSnapshots(details);
		expect(out.oldText).toBe(big(10));
		expect(out.newText).toBe(big(10));
		expect(out.diff).toBe("d");
		expect(out.path).toBe("/a.ts");
	});

	test("drops oversized single-edit snapshots but keeps metadata", () => {
		const details: EditToolDetails = {
			diff: "d",
			path: "/a.ts",
			firstChangedLine: 7,
			op: "update",
			move: "/b.ts",
			oldText: big(MAX_EDIT_SNAPSHOT_TEXT_CHARS),
			newText: big(MAX_EDIT_SNAPSHOT_TEXT_CHARS),
		};
		const out = pruneOversizedEditSnapshots(details);
		expect(out.oldText).toBeUndefined();
		expect(out.newText).toBeUndefined();
		expect(out.diff).toBe("d");
		expect(out.path).toBe("/a.ts");
		expect(out.firstChangedLine).toBe(7);
		expect(out.op).toBe("update");
		expect(out.move).toBe("/b.ts");
	});

	test("keeps a snapshot exactly at the budget boundary", () => {
		const details: EditToolDetails = {
			diff: "d",
			oldText: big(MAX_EDIT_SNAPSHOT_TEXT_CHARS),
		};
		const out = pruneOversizedEditSnapshots(details);
		expect(out.oldText).toBe(big(MAX_EDIT_SNAPSHOT_TEXT_CHARS));
	});

	test("shares one aggregate budget across perFileResults", () => {
		const half = Math.floor(MAX_EDIT_SNAPSHOT_TEXT_CHARS / 2) - 1;
		const entry = (p: string): EditToolPerFileResult => ({
			path: p,
			diff: "d",
			oldText: big(half),
			newText: big(0),
		});
		const details: EditToolDetails = {
			diff: "agg",
			perFileResults: [entry("/1"), entry("/2"), entry("/3"), entry("/4"), entry("/5")],
		};
		const out = pruneOversizedEditSnapshots(details);
		const files = out.perFileResults ?? [];
		expect(files.length).toBe(5);
		// First two fit cumulatively (2 * (~half) <= cap); the rest bust the aggregate.
		expect(files[0]?.oldText).toBe(big(half));
		expect(files[1]?.oldText).toBe(big(half));
		expect(files[2]?.oldText).toBeUndefined();
		expect(files[2]?.snapshotsPruned).toBe(true);
		expect(files[3]?.snapshotsPruned).toBe(true);
		expect(files[4]?.snapshotsPruned).toBe(true);
		// Diff/path metadata always preserved.
		for (const f of files) {
			expect(f.diff).toBe("d");
			expect(f.path).toBeDefined();
		}
	});

	test("per-entry oversized snapshot is pruned even within budget headroom", () => {
		const details: EditToolDetails = {
			diff: "agg",
			perFileResults: [{ path: "/big", diff: "d", oldText: big(MAX_EDIT_SNAPSHOT_TEXT_CHARS + 1) }],
		};
		const out = pruneOversizedEditSnapshots(details);
		const f = out.perFileResults?.[0];
		expect(f?.oldText).toBeUndefined();
		expect(f?.diff).toBe("d");
	});

	test("does not stamp snapshotsPruned on entries without snapshots", () => {
		const details: EditToolDetails = {
			diff: "agg",
			perFileResults: [{ path: "/none", diff: "d" }],
		};
		const out = pruneOversizedEditSnapshots(details);
		expect(out.perFileResults?.[0]?.snapshotsPruned).toBeUndefined();
	});
});
