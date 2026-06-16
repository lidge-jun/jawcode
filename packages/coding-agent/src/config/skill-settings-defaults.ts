export interface SkillDiscoverySettings {
	enabled?: boolean;
	enableSkillCommands?: boolean;
	enableCodexUser?: boolean;
	enableClaudeUser?: boolean;
	enableClaudeProject?: boolean;
	enablePiUser?: boolean;
	enablePiProject?: boolean;
	customDirectories?: string[];
	ignoredSkills?: string[];
	includeSkills?: string[];
}

export const DEFAULT_SKILL_DISCOVERY_SETTINGS: SkillDiscoverySettings = {
	enabled: true,
	enableSkillCommands: true,
	enableCodexUser: false,
	enableClaudeUser: false,
	enableClaudeProject: false,
	enablePiUser: false,
	enablePiProject: false,
	customDirectories: [],
	ignoredSkills: [],
	includeSkills: [],
};

export const DEFAULT_DISABLED_EXTENSIONS: string[] = [];

/**
 * Providers disabled out of the box (99.30.04 S9). The plain `google`
 * (Gemini API) provider lights up from a stray GEMINI_API_KEY/GOOGLE_API_KEY
 * env var even when the user never added it — common when the key exists for
 * unrelated tooling. Explicit opt-in via `/provider enable google`.
 */
export const DEFAULT_DISABLED_PROVIDERS: string[] = ["google"];
