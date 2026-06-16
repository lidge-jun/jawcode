/**
 * cli-jaw dev-skill vocabulary map (055/056/057). Runtime substitution for
 * skill bodies loaded from `~/.cli-jaw/skills` — files jwc does not own and
 * must never edit. Bundled/native skill sources are already jwc-native
 * (085.5 hard edit) and bypass this module entirely.
 *
 * Contract (056 §4): preserve `~/.cli-jaw` path literals; commands are
 * matched only on the `cli-jaw ` word-boundary prefix; degraded surfaces get
 * an explicit `[jwc: unavailable — …]` note instead of silent deletion; role
 * vocabulary applies to prose only (never inside fenced code blocks).
 */

function degraded(alternative: string): string {
	return `[jwc: unavailable — ${alternative}]`;
}

type Rule = [RegExp, string | ((substring: string, ...args: string[]) => string)];

const COMMAND_RULES: readonly Rule[] = [
	[/\bcli-jaw orchestrate ([IPABCD])\b/g, (_m, stage) => `jwc orchestrate ${stage.toLowerCase()}`],
	[/\bcli-jaw orchestrate reset\b/g, "jwc orchestrate reset"],
	[/\bcli-jaw orchestrate\b/g, "jwc orchestrate"],
	[
		/\bcli-jaw dispatch[^\n`]*/g,
		degraded(
			"delegate via the task subagent tool (planner/architect/critic/executor); include the full plan text directly in the task prompt",
		),
	],
	[/\bcli-jaw bgtask[^\n`]*/g, degraded("no server-owned background tasks — poll locally or resume manually")],
	[/\bcli-jaw browser[^\n`]*/g, degraded("cli-jaw browser automation is not part of standalone jwc")],
	[/\bcli-jaw project[^\n`]*/g, degraded("the project root is provided by prompt injection")],
	[/\bcli-jaw task[^\n`]*/g, degraded("no server task board — use the local todo tooling")],
	[/\bcli-jaw (goal|memory|chat)\b/g, "jwc $1"],
];

const ROLE_RULES: readonly Rule[] = [
	[/\bBoss agent\b/g, "main session"],
	[/\bBoss\b/g, "main session"],
	[/\bemployees\b/g, "subagents"],
	[/\bemployee\b/g, "subagent"],
	[/직원/g, "subagent"],
];

function applyRules(text: string, rules: readonly Rule[]): string {
	let out = text;
	for (const [pattern, replacement] of rules) {
		out = typeof replacement === "string" ? out.replace(pattern, replacement) : out.replace(pattern, replacement);
	}
	return out;
}

/** Apply the dev vocabulary map to a cli-jaw provider skill body. */
export function applyCliJawDevVocabularyMap(body: string): string {
	// Split on fenced code blocks: command mapping applies everywhere, role
	// vocabulary only to prose segments (056 §4-1).
	const segments = body.split(/(```[\s\S]*?```)/);
	return segments
		.map(segment => {
			const mapped = applyRules(segment, COMMAND_RULES);
			if (segment.startsWith("```")) return mapped;
			return applyRules(mapped, ROLE_RULES);
		})
		.join("");
}

/** True when the skill file lives under the cli-jaw global skills root. */
export function isCliJawSkillPath(filePath: string): boolean {
	return filePath.includes("/.cli-jaw/skills/");
}
