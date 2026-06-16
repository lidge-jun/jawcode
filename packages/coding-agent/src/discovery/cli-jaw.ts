/**
 * cli-jaw Provider
 *
 * Loads skills from the cli-jaw global skills directory (~/.cli-jaw/skills)
 * when running under a jaw brand (the `jwc` bin). Under the jawcode
 * substitution model this directory replaces the native user-level skill
 * root; when it is absent the native user root remains active as fallback
 * (see extensibility/skills.ts isSourceEnabled).
 */
import * as path from "node:path";
import { registerProvider } from "../capability";
import { type Skill, skillCapability } from "../capability/skill";
import type { LoadContext, LoadResult } from "../capability/types";
import { resolveCliJawHome } from "../jwc-runtime/cli-jaw-home";
import { isJawBrand, scanSkillsFromDir } from "./helpers";

const PROVIDER_ID = "cli-jaw";
// Above native (100): first-wins dedup gives the global root precedence on
// name collisions (D5: global beats project-level copies).
const PRIORITY = 110;

async function loadSkills(ctx: LoadContext): Promise<LoadResult<Skill>> {
	if (!isJawBrand()) {
		return { items: [], warnings: [] };
	}
	const dir = path.join(resolveCliJawHome(process.env, ctx.home), "skills");
	return scanSkillsFromDir(ctx, { dir, providerId: PROVIDER_ID, level: "user", requireDescription: true });
}

registerProvider<Skill>(skillCapability.id, {
	id: PROVIDER_ID,
	displayName: "cli-jaw",
	description: "Load skills from the cli-jaw global skills directory (~/.cli-jaw/skills) under jaw brands",
	priority: PRIORITY,
	load: loadSkills,
});
