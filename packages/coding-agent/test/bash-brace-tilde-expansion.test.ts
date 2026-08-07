/**
 * A tilde must expand in EVERY word a brace expansion produces.
 *
 * Brace expansion runs before tilde expansion, and the embedded shell joined
 * the generated words back into one string before parsing. Tilde expansion is
 * gated on being at word start, so only the leading result qualified:
 * `~/{alpha,beta}` produced `/home/u/alpha ~/beta`. Every subsequent path was
 * a literal `~`, which is not a path — so `cp ~/{a,b} dest` silently operated
 * on a directory named `~`.
 *
 * The oracle is the real shell: each case is compared against `/bin/bash`
 * rather than a hand-written expectation, so this cannot drift into asserting
 * our own bug back.
 */
import { describe, expect, it } from "bun:test";
import { executeBash } from "@jawcode-dev/coding-agent/exec/bash-executor";

/** What `/bin/bash` prints for the same command. */
function bashOracle(command: string): string {
	const result = Bun.spawnSync({ cmd: ["/bin/bash", "-c", command] });
	return new TextDecoder().decode(result.stdout).trim();
}

async function embeddedShell(command: string): Promise<string> {
	const result = await executeBash(command, { timeout: 10_000 });
	return result.output?.trim() ?? "";
}

async function expectMatchesBash(command: string): Promise<void> {
	expect(await embeddedShell(command)).toBe(bashOracle(command));
}

describe("brace expansion with tilde", () => {
	it("expands the tilde in every generated word", async () => {
		// The regression: the second word used to come back as a literal `~/beta`.
		await expectMatchesBash("echo ~/{alpha,beta}");
	}, 20_000);

	it("expands a named-user tilde in every generated word", async () => {
		await expectMatchesBash("echo ~root/{x,y}");
	}, 20_000);

	it("handles a tilde group alongside an ordinary group", async () => {
		await expectMatchesBash("echo a{b,c}d ~/{e,f}");
	}, 20_000);

	it("keeps quoted segments intact while expanding the tilde", async () => {
		await expectMatchesBash('echo ~/"a b"/{x,y}');
	}, 20_000);

	it("leaves a fully quoted brace-and-tilde word alone", async () => {
		// Quoting must still suppress both expansions.
		await expectMatchesBash('echo "~/{a,b}"');
	}, 20_000);

	it("does not change brace expansion without a tilde", async () => {
		await expectMatchesBash("echo {a,b}");
		await expectMatchesBash("echo pre{a,b}post");
		await expectMatchesBash("echo {1..3}");
	}, 30_000);
});
