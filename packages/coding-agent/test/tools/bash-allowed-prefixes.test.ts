import { describe, expect, it } from "bun:test";
import { checkBashAllowedPrefixes } from "../../src/tools/bash-allowed-prefixes";

const ROLE_AGENT_PREFIXES = ["jwc ralplan --write", "jwc state"] as const;

describe("checkBashAllowedPrefixes", () => {
	it("allows ralplan artifact writes for role agents", () => {
		expect(
			checkBashAllowedPrefixes(
				"jwc ralplan --write --stage architect --stage_n 1 --artifact 'Architect verdict'",
				ROLE_AGENT_PREFIXES,
			),
		).toEqual({ allowed: true });
	});

	it("blocks non-write ralplan commands", () => {
		const result = checkBashAllowedPrefixes("jwc ralplan --consensus 'task'", ROLE_AGENT_PREFIXES);

		expect(result.allowed).toBe(false);
		expect(result.reason).toContain("jwc ralplan --write");
	});

	it("allows GJC state writes through the sanctioned workflow CLI", () => {
		expect(
			checkBashAllowedPrefixes(
				'jwc state ralplan write --input \'{"current_phase":"handoff"}\' --json',
				ROLE_AGENT_PREFIXES,
			),
		).toEqual({ allowed: true });
	});

	it("blocks destructive state clears", () => {
		const result = checkBashAllowedPrefixes("jwc state ralplan clear --json", ROLE_AGENT_PREFIXES);

		expect(result.allowed).toBe(false);
		expect(result.reason).toContain("jwc state clear");
	});

	it("blocks direct GJC state handoffs", () => {
		const result = checkBashAllowedPrefixes("jwc state ralplan handoff --to team --json", ROLE_AGENT_PREFIXES);

		expect(result.allowed).toBe(false);
		expect(result.reason).toContain("jwc state handoff");
	});

	it("blocks shell expansion that could synthesize a state action", () => {
		const result = checkBashAllowedPrefixes("jwc state ralplan $ACTION --json", ROLE_AGENT_PREFIXES);

		expect(result.allowed).toBe(false);
		expect(result.reason).toContain("shell expansion character");
	});

	it("blocks double-quoted shell expansion that could synthesize a state action", () => {
		const dollar = "$";
		const result = checkBashAllowedPrefixes(
			`jwc state "${dollar}{X:-handoff}" --mode ralplan --to team`,
			ROLE_AGENT_PREFIXES,
		);

		expect(result.allowed).toBe(false);
		expect(result.reason).toContain("shell expansion character");
	});

	it("blocks backslash escape smuggling", () => {
		const result = checkBashAllowedPrefixes("jwc state ralplan\\ clear --json", ROLE_AGENT_PREFIXES);

		expect(result.allowed).toBe(false);
		expect(result.reason).toContain("backslash escapes");
	});

	it("blocks malformed or unknown state action shapes", () => {
		const result = checkBashAllowedPrefixes("jwc state ralplan nope --json", ROLE_AGENT_PREFIXES);

		expect(result.allowed).toBe(false);
		expect(result.reason).toContain("documented `jwc state` action shapes");
	});

	it("blocks shell chaining that could smuggle destructive commands", () => {
		const result = checkBashAllowedPrefixes(
			"jwc ralplan --write --stage critic --artifact ok; rm -rf .jwc",
			ROLE_AGENT_PREFIXES,
		);

		expect(result.allowed).toBe(false);
		expect(result.reason).toContain("shell control operator");
	});

	it("blocks ordinary shell commands for restricted role agents", () => {
		const result = checkBashAllowedPrefixes("echo verdict", ROLE_AGENT_PREFIXES);

		expect(result.allowed).toBe(false);
		expect(result.reason).toContain("restricted role-agent bash only allows commands starting with");
	});
});
