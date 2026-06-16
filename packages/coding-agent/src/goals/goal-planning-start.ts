export const GOAL_PLAN_PENDING_BRIEF = "(AI-driven goal planning pending refinement)";

export interface GoalPlanningStart {
	brief: string;
	hint: string;
	prompt: string;
}

export function buildGoalPlanningStart(rawHint: string | undefined): GoalPlanningStart {
	const hint = rawHint?.trim() ?? "";
	const brief = hint ? `${GOAL_PLAN_PENDING_BRIEF}\nhint: ${hint}` : GOAL_PLAN_PENDING_BRIEF;
	const prompt = [
		"AI-driven goal planning is active.",
		"The user hint below is directional context, not the final objective.",
		hint ? `Hint: ${hint}` : "Hint: (none)",
		"Infer the concrete goal from the conversation and repo context.",
		'If needed, refine the active goal with `jwc goal refine "<specific objective>"` before completing execution.',
		"Then execute the refined goal with verification.",
	].join("\n");
	return { brief, hint, prompt };
}
