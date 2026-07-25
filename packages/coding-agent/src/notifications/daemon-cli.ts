import * as fs from "node:fs/promises";
import * as path from "node:path";
import { Settings } from "../config/settings";
import { getNotificationConfig } from "./config";
import { type RunManagedDaemonOptions, runManagedDaemon } from "./daemon-runtime";
import { defaultPidAlive, transportPaths } from "./transport-state";

export interface ParsedDaemonInternalArgs {
	smoke: boolean;
	agentDir?: string;
	ownerId?: string;
	maxTicks?: number;
}

export interface NotifyDaemonInternalOptions {
	argv: string[];
	fetchImpl?: typeof fetch;
	now?: () => number;
	sleep?: (ms: number) => Promise<void>;
	pidAlive?: (pid: number) => boolean;
}

function flagValue(argv: string[], name: string): string | undefined {
	const prefix = `${name}=`;
	const inline = argv.find(arg => arg.startsWith(prefix));
	if (inline) return inline.slice(prefix.length);
	const index = argv.indexOf(name);
	return index >= 0 ? argv[index + 1] : undefined;
}

function parseOptionalInteger(value: string | undefined, name: string): number | undefined {
	if (value === undefined) return undefined;
	const parsed = Number.parseInt(value, 10);
	if (!Number.isSafeInteger(parsed) || parsed < 0) {
		throw new Error(`Invalid ${name}: ${value}. Use a non-negative integer.`);
	}
	return parsed;
}

export function parseDaemonInternalArgs(argv: string[]): ParsedDaemonInternalArgs {
	return {
		smoke: argv.includes("--smoke"),
		agentDir: flagValue(argv, "--agent-dir"),
		ownerId: flagValue(argv, "--owner-id"),
		maxTicks: parseOptionalInteger(flagValue(argv, "--max-ticks"), "--max-ticks"),
	};
}

export function ownerPidFromOwnerId(ownerId: string): number | undefined {
	const match = /^(\d+)(?:-|$)/.exec(ownerId);
	if (!match) return undefined;
	const pid = Number(match[1]);
	return Number.isSafeInteger(pid) && pid > 0 ? pid : undefined;
}

function ownerProcessIsAlive(ownerId: string, pidAlive: (pid: number) => boolean): boolean {
	const pid = ownerPidFromOwnerId(ownerId);
	return pid === undefined ? true : pidAlive(pid);
}

export async function runDaemonSmoke(options: { agentDir?: string } = {}): Promise<void> {
	const agentDir = options.agentDir ?? (await fs.mkdtemp(path.join(process.cwd(), ".jwc-telegram-daemon-smoke-")));
	const paths = transportPaths(agentDir);
	await fs.mkdir(paths.dir, { recursive: true, mode: 0o700 });
	if (process.platform !== "win32") {
		await fs.chmod(paths.dir, 0o700);
	}
	const smokeFile = path.join(paths.dir, `daemon-cli.smoke.${process.pid}`);
	const handle = await fs.open(smokeFile, "wx", 0o600);
	await handle.close();
	await fs.unlink(smokeFile);
}

export async function runDaemonInternal(options: NotifyDaemonInternalOptions): Promise<void> {
	const parsed = parseDaemonInternalArgs(options.argv);
	if (parsed.smoke) {
		await runDaemonSmoke({ agentDir: parsed.agentDir });
		return;
	}
	if (!parsed.ownerId) {
		throw new Error("missing --owner-id");
	}
	const pidAlive = options.pidAlive ?? defaultPidAlive;
	if (!ownerProcessIsAlive(parsed.ownerId, pidAlive)) {
		process.stderr.write(
			`JWC notify daemon exiting: owner process from --owner-id ${parsed.ownerId} is not alive.\n`,
		);
		return;
	}

	const settings = await Settings.init(parsed.agentDir ? { agentDir: parsed.agentDir } : {});
	const config = getNotificationConfig(settings);
	if (!config.enabled || !config.botToken || !config.chatId) {
		return;
	}

	const daemonOptions: RunManagedDaemonOptions = {
		agentDir: settings.getAgentDir(),
		token: config.botToken,
		chatId: config.chatId,
		ownerId: parsed.ownerId,
		pid: process.pid,
		pidAlive,
	};
	if (options.now) daemonOptions.now = options.now;
	if (options.sleep) daemonOptions.sleep = options.sleep;
	if (parsed.maxTicks !== undefined) daemonOptions.maxTicks = parsed.maxTicks;
	if (options.fetchImpl) daemonOptions.fetchImpl = options.fetchImpl;
	await runManagedDaemon(daemonOptions);
}
