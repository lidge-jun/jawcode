import { APP_NAME } from "@jawcode-dev/utils";
import { Command } from "@jawcode-dev/utils/cli";
import { runNativePlanWriterCommand } from "../jwc-runtime/plan-writer";

export default class Planphase extends Command {
	static description = `Persist ${APP_NAME.toUpperCase()} orchestrate plan-phase artifacts`;
	static strict = false;
	static examples = [
		`$ ${APP_NAME} planphase --write --stage planner --stage_n 1 --artifact "<markdown or path>"`,
		`$ ${APP_NAME} planphase --write --stage final --stage_n 3 --artifact "<markdown>" --json`,
	];

	async run(): Promise<void> {
		const result = await runNativePlanWriterCommand(this.argv, process.cwd());
		if (result.stdout) process.stdout.write(result.stdout);
		if (result.stderr) process.stderr.write(result.stderr);
		process.exitCode = result.status;
	}
}
