import { describe, expect, it } from "bun:test";
import type { Component } from "@gajae-code/tui";
import { Box } from "@gajae-code/tui/components/box";

type CountingChild = Component & {
	invalidateCount(): number;
	renderCount(): number;
};

function countingChild(lines: string[], committed = false): CountingChild {
	let renders = 0;
	let invalidates = 0;
	return {
		committed,
		render: () => {
			renders++;
			return lines;
		},
		invalidate: () => {
			invalidates++;
		},
		renderCount: () => renders,
		invalidateCount: () => invalidates,
	};
}

describe("Box committed child rendering", () => {
	it("does not render committed direct children", () => {
		const box = new Box(1, 0);
		const committed = countingChild(["hidden"], true);
		box.addChild(committed);

		expect(box.render(20)).toEqual([]);
		expect(committed.renderCount()).toBe(0);
	});

	it("renders live children while skipping committed siblings", () => {
		const box = new Box(1, 0);
		const committed = countingChild(["hidden"], true);
		const live = countingChild(["live"]);
		box.addChild(committed);
		box.addChild(live);

		const rendered = box.render(20).join("\n");

		expect(committed.renderCount()).toBe(0);
		expect(live.renderCount()).toBe(1);
		expect(rendered).toContain("live");
		expect(rendered).not.toContain("hidden");
	});

	it("returns empty output when every child is committed", () => {
		const box = new Box(1, 1);
		box.addChild(countingChild(["one"], true));
		box.addChild(countingChild(["two"], true));

		expect(box.render(20)).toEqual([]);
	});

	it("still invalidates committed children", () => {
		const box = new Box(1, 0);
		const committed = countingChild(["hidden"], true);
		box.addChild(committed);

		box.invalidate();

		expect(committed.invalidateCount()).toBe(1);
	});
});
