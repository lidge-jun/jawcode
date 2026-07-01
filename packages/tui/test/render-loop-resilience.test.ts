import { describe, expect, it } from "bun:test";
import { type Component, Container } from "@jawcode-dev/tui";

class ThrowingComponent implements Component {
	invalidate(): void {}

	render(_width: number): string[] {
		const value = undefined as unknown as string;
		return [value.trim()];
	}
}

class FixedLines implements Component {
	#lines: string[];

	constructor(lines: string[]) {
		this.#lines = lines;
	}

	invalidate(): void {}

	render(_width: number): string[] {
		return this.#lines;
	}
}

describe("render loop resilience", () => {
	it("isolates a throwing child and keeps rendering siblings", () => {
		const container = new Container();
		container.addChild(new FixedLines(["before"]));
		container.addChild(new ThrowingComponent());
		container.addChild(new FixedLines(["after"]));

		let output: string[] = [];
		expect(() => {
			output = container.render(80);
		}).not.toThrow();

		expect(output).toContain("before");
		expect(output).toContain("after");
		expect(output.some(line => line.includes("render error"))).toBe(true);
	});

	it("survives a throwing child nested inside another container", () => {
		const inner = new Container();
		inner.addChild(new ThrowingComponent());
		inner.addChild(new FixedLines(["inner-tail"]));

		const outer = new Container();
		outer.addChild(new FixedLines(["outer-head"]));
		outer.addChild(inner);

		let output: string[] = [];
		expect(() => {
			output = outer.render(80);
		}).not.toThrow();

		expect(output).toContain("outer-head");
		expect(output).toContain("inner-tail");
		expect(output.some(line => line.includes("render error"))).toBe(true);
	});
});
