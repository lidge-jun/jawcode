import { APP_NAME } from "@jawcode-dev/utils";
import { Command } from "@jawcode-dev/utils/cli";
import { runNativePlanWriterCommand } from "../jwc-runtime/plan-writer";

export default class Ralplan extends Command {
	static description =
		`Deprecated compatibility alias: use ${APP_NAME} orchestrate p for planning or ${APP_NAME} planphase --write for P-stage artifacts`;
	static strict = false;
	static examples = [`$ ${APP_NAME} planphase --write --stage planner --stage_n 1 --artifact "<markdown or path>"`];

	async run(): Promise<void> {
		if (!this.argv.includes("--write")) {
			process.stderr.write(
				`jwc ralplan is deprecated. Use \`${APP_NAME} orchestrate p\` for planning or \`${APP_NAME} planphase --write ...\` for artifact persistence.\n`,
			);
			process.exitCode = 2;
			return;
		}
		process.stderr.write(`jwc ralplan --write is deprecated; use \`${APP_NAME} planphase --write ...\`.\n`);
		const result = await runNativePlanWriterCommand(this.argv, process.cwd());
		if (result.stdout) process.stdout.write(result.stdout);
		if (result.stderr) process.stderr.write(result.stderr);
		process.exitCode = result.status;
	}
}
