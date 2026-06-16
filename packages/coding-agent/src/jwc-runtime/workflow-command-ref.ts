import type { CanonicalJwcWorkflowSkill } from "../skill-state/active-state";
import { CANONICAL_JWC_WORKFLOW_SKILLS } from "../skill-state/active-state";
import { normalizeWorkflowSkillSlug } from "./state-schema";

export type CommandRefVisibility = "public" | "hidden" | "planned";
export type CommandRefIncludeWhen = "implemented-only" | "planned";

export interface CommandRefCommand {
	tokens: string[];
	rendered: string;
	visibility: CommandRefVisibility;
	includeWhen: CommandRefIncludeWhen;
	note?: string;
}

export interface CommandRefExample {
	label?: string;
	bytes: string;
}

export interface CommandRefBridge {
	from: string;
	to: string;
	rendered: string;
}

export interface CommandRefBlock {
	skill: CanonicalJwcWorkflowSkill;
	blockId: string;
	sourcePath: string;
	renderOrder: number;
	markers: {
		start: string;
		end: string;
	};
	commands: CommandRefCommand[];
	examples: CommandRefExample[];
	aliasesAndBridges: CommandRefBridge[];
	notes: string[];
}

export interface RenderedCommandRefBlock {
	skill: CanonicalJwcWorkflowSkill;
	blockId: string;
	markers: CommandRefBlock["markers"];
	bytes: string;
}

const skillPath = (skill: CanonicalJwcWorkflowSkill): string =>
	`packages/coding-agent/src/defaults/jwc/skills/${skill}/SKILL.md`;

const stateWrite = (skill: CanonicalJwcWorkflowSkill): CommandRefCommand => ({
	tokens: ["jwc", "state", skill, "write", "--input", `'{"current_phase":"handoff"}'`, "--json"],
	rendered: `jwc state ${skill} write --input '{"current_phase":"handoff"}' --json`,
	visibility: "public",
	includeWhen: "implemented-only",
	note: "Marks the workflow ready for the skill-tool chain guard.",
});

const stateHandoff = (
	skill: CanonicalJwcWorkflowSkill,
	targets: readonly CanonicalJwcWorkflowSkill[],
): CommandRefCommand => ({
	tokens: ["jwc", "state", skill, "handoff", "--to", `<${targets.join("|")}>`, "--json"],
	rendered: `jwc state ${skill} handoff --to <${targets.join("|")}> --json`,
	visibility: "public",
	includeWhen: "implemented-only",
	note: "Bridge command run in-process by the skill tool after slash-skill dispatch.",
});

export const WORKFLOW_COMMAND_REF_BLOCKS: readonly CommandRefBlock[] = [
	{
		skill: "jaw-interview",
		blockId: "state",
		sourcePath: skillPath("jaw-interview"),
		renderOrder: 10,
		markers: {
			start: "<!-- gjc:cmdref:start state -->",
			end: "<!-- gjc:cmdref:end state -->",
		},
		commands: [
			stateWrite("jaw-interview"),
			{
				tokens: [
					"jwc",
					"jaw-interview",
					"--write",
					"--stage",
					"final",
					"--slug",
					"{slug}",
					"--spec",
					"<markdown-or-path>",
					"--deliberate",
					"--json",
				],
				rendered:
					"jwc jaw-interview --write --stage final --slug {slug} --spec <markdown-or-path> --deliberate --json",
				visibility: "public",
				includeWhen: "implemented-only",
				note: "Sanctioned deliberate jaw-interview to plan bridge.",
			},
		],
		examples: [
			{
				label: "handoff state write",
				bytes: '```\njwc state jaw-interview write --input \'{"current_phase":"handoff"}\' --json\n```',
			},
			{
				label: "deliberate bridge",
				bytes: "```\njwc \\\njaw-interview --write --stage final --slug {slug} --spec <markdown-or-path> --deliberate --json\n```",
			},
		],
		aliasesAndBridges: [
			{
				from: "jaw-interview",
				to: "plan",
				rendered:
					"jwc jaw-interview --write --stage final --slug {slug} --spec <markdown-or-path> --deliberate --json",
			},
		],
		notes: [
			"Before invoking `/skill:plan`, `/skill:team`, or `/skill:goal`, persist the final spec and mark jaw-interview ready for handoff.",
		],
	},
	{
		skill: "plan",
		blockId: "state",
		sourcePath: skillPath("plan"),
		renderOrder: 10,
		markers: { start: "<!-- gjc:cmdref:start state -->", end: "<!-- gjc:cmdref:end state -->" },
		commands: [stateWrite("plan"), stateHandoff("plan", ["team", "goal"])],
		examples: [
			{
				label: "handoff state write",
				bytes: '```\njwc state plan write --input \'{"current_phase":"handoff"}\' --json\n```',
			},
		],
		aliasesAndBridges: [
			{ from: "plan", to: "team|goal", rendered: "jwc state plan handoff --to <team|goal> --json" },
		],
		notes: [
			"Before invoking `/skill:team` or `/skill:goal`, mark plan ready for handoff so the skill tool's chain guard permits the transition.",
		],
	},
	{
		skill: "goal",
		blockId: "state",
		sourcePath: skillPath("goal"),
		renderOrder: 10,
		markers: { start: "<!-- gjc:cmdref:start state -->", end: "<!-- gjc:cmdref:end state -->" },
		commands: [stateWrite("goal"), stateHandoff("goal", ["plan", "jaw-interview"])],
		examples: [
			{
				label: "handoff state write",
				bytes: '```\njwc state goal write --input \'{"current_phase":"handoff"}\' --json\n```',
			},
		],
		aliasesAndBridges: [
			{
				from: "goal",
				to: "plan|jaw-interview",
				rendered: "jwc state goal handoff --to <plan|jaw-interview> --json",
			},
		],
		notes: [
			"When the aggregate goal is complete OR the user requests return to planning/clarification, mark goal ready for handoff.",
		],
	},
	{
		skill: "team",
		blockId: "state",
		sourcePath: skillPath("team"),
		renderOrder: 10,
		markers: { start: "<!-- gjc:cmdref:start state -->", end: "<!-- gjc:cmdref:end state -->" },
		commands: [stateWrite("team"), stateHandoff("team", ["plan", "jaw-interview", "goal"])],
		examples: [
			{
				label: "handoff state write",
				bytes: '```\njwc state team write --input \'{"current_phase":"handoff"}\' --json\n```',
			},
		],
		aliasesAndBridges: [
			{
				from: "team",
				to: "plan|jaw-interview|goal",
				rendered: "jwc state team handoff --to <plan|jaw-interview|goal> --json",
			},
		],
		notes: [
			"When the team task-set completes OR the user requests return to planning/persistence, mark team ready for handoff.",
		],
	},
] as const;

export function listCommandRefBlocks(skill?: CanonicalJwcWorkflowSkill): CommandRefBlock[] {
	const blocks =
		skill === undefined
			? WORKFLOW_COMMAND_REF_BLOCKS
			: WORKFLOW_COMMAND_REF_BLOCKS.filter(block => block.skill === skill);
	return [...blocks].sort(
		(a, b) => a.skill.localeCompare(b.skill) || a.renderOrder - b.renderOrder || a.blockId.localeCompare(b.blockId),
	);
}

export function renderCommandRefBlock(skill: CanonicalJwcWorkflowSkill, blockId = "state"): RenderedCommandRefBlock {
	const block = WORKFLOW_COMMAND_REF_BLOCKS.find(item => item.skill === skill && item.blockId === blockId);
	if (block === undefined) throw new Error(`Unknown command-reference block: ${skill}/${blockId}`);

	const lines: string[] = [];
	lines.push(block.markers.start);
	lines.push(`### Generated command reference: ${block.blockId}`);
	lines.push("");
	for (const note of block.notes) lines.push(note);
	lines.push("");
	lines.push("Commands:");
	for (const command of block.commands.filter(
		item => item.visibility === "public" && item.includeWhen === "implemented-only",
	)) {
		lines.push(`- \`${command.rendered}\``);
		if (command.note !== undefined) lines.push(`  - ${command.note}`);
	}
	lines.push("");
	lines.push("Examples:");
	for (const example of block.examples) {
		if (example.label !== undefined) lines.push(`- ${example.label}:`);
		lines.push(example.bytes);
	}
	lines.push("");
	lines.push("Aliases and bridges:");
	for (const bridge of block.aliasesAndBridges) lines.push(`- ${bridge.from} -> ${bridge.to}: \`${bridge.rendered}\``);
	lines.push(block.markers.end);
	lines.push("");

	return { skill, blockId: block.blockId, markers: block.markers, bytes: lines.join("\n") };
}

export function isCanonicalJwcWorkflowSkill(value: string): value is CanonicalJwcWorkflowSkill {
	return (CANONICAL_JWC_WORKFLOW_SKILLS as readonly string[]).includes(normalizeWorkflowSkillSlug(value));
}
