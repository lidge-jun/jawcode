import { APP_NAME } from "@jawcode-dev/utils";
import { Command } from "@jawcode-dev/utils/cli";
import { runJwcNativeSkillHookCli } from "../hooks/native-skill-hook";

export default class CodexNativeHook extends Command {
	static description = `Run ${APP_NAME.toUpperCase()} native UserPromptSubmit/Stop skill-state hook`;
	static strict = false;

	async run(): Promise<void> {
		await runJwcNativeSkillHookCli();
	}
}
