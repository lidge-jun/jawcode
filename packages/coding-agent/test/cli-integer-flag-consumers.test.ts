/**
 * Tightening `Flags.integer` must not narrow any command's accepted range.
 *
 * The validation added upstream of this covers TOKEN shape only. These are the
 * real registered commands, so if the shared parser ever starts rejecting
 * values a command legitimately accepts, this fails rather than the change
 * being discovered by a user.
 */
import { describe, expect, it } from "bun:test";
import GrepCmd from "../src/commands/grep";
import MapCmd from "../src/commands/map";
import ShellCmd from "../src/commands/shell";
import StatsCmd from "../src/commands/stats";

describe("integer flag consumers keep their accepted values", () => {
	it("grep limit/context", async () => {
		const p = await new GrepCmd(["--limit", "5", "-C", "1", "x"]).parse(GrepCmd);
		expect([p.flags.limit, p.flags.context]).toEqual([5, 1]);
	});
	it("stats port 0 stays an ephemeral request", async () => {
		// This is why the fix does not add a `min: 1`: 0 asks the OS to assign a port.
		expect((await new StatsCmd(["--port", "0"]).parse(StatsCmd)).flags.port).toBe(0);
	});
	it("stats port default", async () => {
		expect((await new StatsCmd([]).parse(StatsCmd)).flags.port).toBe(3847);
	});
	it("map budget default", async () => {
		expect((await new MapCmd(["."]).parse(MapCmd)).flags.budget).toBe(4096);
	});
	it("shell timeout", async () => {
		expect((await new ShellCmd(["-t", "3000", "ls"]).parse(ShellCmd)).flags.timeout).toBe(3000);
	});
});
