import type { AppKeybinding, KeybindingsManager } from "../../config/keybindings";

/** Minimal command shape — the autocomplete list and the builtin defs both satisfy it. */
export interface HelpCommandEntry {
	name: string;
	description?: string;
}

export interface HelpMarkdownInputs {
	commands: ReadonlyArray<HelpCommandEntry>;
	keybindings: Pick<KeybindingsManager, "getDisplayString">;
}

function appKey(inputs: HelpMarkdownInputs, action: AppKeybinding): string {
	return inputs.keybindings.getDisplayString(action) || "Disabled";
}

/**
 * /help panel body (devlog 99.20.08): a short "getting around" primer plus the
 * full command catalog — the same combined list the autocomplete advertises
 * (builtin + hooks + custom + skills + file commands), so the two surfaces can
 * never drift apart.
 */
export function buildHelpMarkdown(inputs: HelpMarkdownInputs): string {
	const seen = new Set<string>();
	const commands = inputs.commands
		.filter(cmd => {
			if (seen.has(cmd.name)) return false;
			seen.add(cmd.name);
			return true;
		})
		.sort((a, b) => a.name.localeCompare(b.name));

	const lines = [
		"**Getting around**",
		"| Input | What it does |",
		"|-------|--------------|",
		"| `Enter` | Send your message to the agent |",
		"| `!command` | Run a shell command directly (bash mode) |",
		"| `/command` | Run a slash command — full catalog below |",
		"| `?` (empty editor) or `/hotkeys` | Show all keyboard shortcuts |",
		`| \`${appKey(inputs, "app.clear")}\` ×2 / \`esc esc\` | Exit |`,
		"",
		`**Commands** (${commands.length})`,
		"| Command | Description |",
		"|---------|-------------|",
		...commands.map(cmd => `| \`/${cmd.name}\` | ${(cmd.description ?? "").replace(/\|/g, "\\|")} |`),
	];
	return lines.join("\n");
}
