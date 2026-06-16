import type { CanonicalJwcWorkflowSkill } from "../../skill-state/active-state";
import { CANONICAL_JWC_WORKFLOW_SKILLS } from "../../skill-state/active-state";

export const GJC_PLUGIN_MANIFEST_FILENAME = "gajae-plugin.json";
export const GJC_PLUGIN_KIND = "jawcode-plugin";

export const GJC_SUBSKILL_PARENT_SKILLS = CANONICAL_JWC_WORKFLOW_SKILLS;
export type JwcSubskillParentSkill = CanonicalJwcWorkflowSkill;

export const GJC_SUBSKILL_PARENT_AGENTS = ["executor", "architect", "planner", "critic"] as const;
export type JwcSubskillParentAgent = (typeof GJC_SUBSKILL_PARENT_AGENTS)[number];

export type JwcSubskillParent = JwcSubskillParentSkill | JwcSubskillParentAgent;

export const GJC_AGENT_SUBSKILL_PHASES: Record<JwcSubskillParentAgent, string[]> = {
	executor: ["prompt"],
	architect: ["prompt"],
	planner: ["prompt"],
	critic: ["prompt"],
};

export interface JwcPluginManifest {
	name: string;
	version: string;
	kind: "jawcode-plugin";
	subskills: string[];
	tools: string[];
}

export interface SubskillFrontmatter {
	name: string;
	binds_to: string;
	phase: string;
	activation_arg: string;
	description: string;
}

export interface LoadedSubskillBinding {
	plugin: string;
	subskillName: string;
	parent: string;
	bindsTo: string;
	phase: string;
	activationArg: string;
	description: string;
	filePath: string;
	body: string;
	toolPaths: string[];
}

export interface LoadedSubskillActivation {
	activationArg: string;
	plugin: string;
	subskillName: string;
	parent: string;
	bindsTo: string;
	phase: string;
	filePath: string;
	toolPaths: string[];
}

export interface PhaseScopedToolBinding {
	plugin: string;
	parent: string;
	phase: string;
	toolPath: string;
}

export interface LoadedJwcPlugin {
	name: string;
	version: string;
	root: string;
	manifestPath: string;
	bindings: LoadedSubskillBinding[];
	toolBindings: PhaseScopedToolBinding[];
}

export type JwcPluginLoadErrorCode =
	| "forbidden_surface"
	| "invalid_manifest"
	| "invalid_frontmatter"
	| "invalid_parent"
	| "invalid_phase"
	| "duplicate_arg"
	| "duplicate_parent_phase"
	| "missing_file"
	| "invalid_kind";

export class JwcPluginLoadError extends Error {
	readonly code: JwcPluginLoadErrorCode;

	constructor(code: JwcPluginLoadErrorCode, message: string, options?: ErrorOptions) {
		super(message, options);
		this.name = "JwcPluginLoadError";
		this.code = code;
	}
}
