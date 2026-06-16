import { beforeAll, describe, expect, it } from "bun:test";
import * as fs from "node:fs/promises";
import * as path from "node:path";

/**
 * 040 band policy markers — the merged jaw-interview SKILL.md must carry the
 * dual-audit contract decided in devlog/_plan/260612_jawcode_fork/042 (D040-2..10).
 * These are content gates: if a rebase or edit drops a policy line, this fails.
 */

const skillPath = path.resolve(import.meta.dir, "../src/defaults/jwc/skills/jaw-interview/SKILL.md");

let skill = "";

beforeAll(async () => {
	skill = await fs.readFile(skillPath, "utf-8");
});

describe("jaw-interview SKILL.md policy markers (042)", () => {
	it("allows 1-3 independent questions per round (D040-2)", () => {
		expect(skill).toContain("Ask 1-3 questions per round");
		expect(skill).not.toContain("Ask ONE question at a time");
	});

	it("carries the internal-audit tracker and negativity bias rules (D040-4, D041-C)", () => {
		expect(skill).toContain("Internal audit every round");
		expect(skill).toContain("known/unknown tracker");
		expect(skill).toContain("Negativity bias: treat every answer as a claim to pressure-test");
		expect(skill).toContain("Never raise a score to close the interview faster");
	});

	it("maps ontology to the tracker display only (D040-5)", () => {
		expect(skill).toContain("stability_ratio mapped to the tracker (display only)");
	});

	it("runs the external audit at checkpoints with mandatory pre-skip/pre-crystallization calls (D040-6)", () => {
		expect(skill).toContain("External audit (the mathematical scoring call) runs at CHECKPOINTS only");
		expect(skill).toMatch(/pre-skip and pre-crystallization external audits are (MANDATORY|mandatory)/);
		expect(skill).toContain("cacheIdentity");
	});

	it("permits explicit early exit from Round 1 with the early-exit spec status (D040-7)", () => {
		expect(skill).toContain("**Round 1+**: Allow explicit early exit at ANY round");
		expect(skill).toContain("BELOW_THRESHOLD_EARLY_EXIT");
	});

	it("hands off specs at the jaw-interview path and consults legacy artifacts (D040-9)", () => {
		expect(skill).toContain("handoff: .jwc/specs/jaw-interview-{slug}.md");
		expect(skill).toContain("`.jwc/specs/jaw-interview-*.md`");
		expect(skill).toContain("`.jwc/specs/deep-*.md` (legacy artifacts)");
	});

	it("displays dual score notation with the 5-level quantization (D040-10)", () => {
		expect(skill).toContain("<0.3 low / <0.5 medium / <0.7 high / <0.9 xhigh / >=0.9 max");
	});

	it("replaces the text-header protocol with structured ask meta (D041-A)", () => {
		expect(skill).toContain('"meta": {');
		expect(skill).toContain("Do NOT prepend a `Round N | Component:");
		expect(skill).not.toMatch(/^Round \{n\} \| Component:.*\| Ambiguity: \{score\}%$/m);
	});

	it("uses native/state threshold resolution instead of direct optional settings reads", () => {
		expect(skill).toContain("Resolve threshold from active jaw-interview state");
		expect(skill).toContain("native `jwc jaw-interview` activation owns settings/config precedence");
		expect(skill).toContain("threshold was resolved from native/state or default");
		expect(skill).not.toContain("Read threshold settings in precedence order");
		expect(skill).not.toContain("settings files were read");
	});

	it("allows markdown/mockup interview documents and prompts mockup viewing", () => {
		expect(skill).toContain("static mockup `.html` files");
		expect(skill).toContain('"목업으로 보기" / "View mockup"');
		expect(skill).toContain("non-markdown/non-mockup product/source edits");
		expect(skill).toContain("hashline `§path`");
		expect(skill).toContain("Do not emit target-less edit payloads");
	});
});
