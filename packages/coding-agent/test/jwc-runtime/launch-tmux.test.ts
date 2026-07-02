import { describe, expect, it } from "bun:test";
import { Buffer } from "node:buffer";
import type { Args } from "@jawcode-dev/coding-agent/cli/args";
import {
	applyJwcTmuxProfile,
	buildDefaultTmuxLaunchPlan,
	buildJwcTmuxProfileCommands,
	buildJwcTmuxWindowTitle,
	GJC_TMUX_LAUNCHED_ENV,
	GJC_TMUX_SESSION_PREFIX,
	launchDefaultTmuxIfNeeded,
	type TmuxSpawnOptions,
} from "@jawcode-dev/coding-agent/jwc-runtime/launch-tmux";

function args(overrides: Partial<Args> = {}): Args {
	return {
		messages: [],
		fileArgs: [],
		unknownFlags: new Map(),
		...overrides,
	};
}

const interactiveTty = { stdin: true, stdout: true };

describe("default GJC tmux launch", () => {
	it("builds sanitized JWC project and branch tmux window titles", () => {
		expect(buildJwcTmuxWindowTitle("/repo", "feature/demo")).toBe("JWC-repo-feature/demo");
		expect(buildJwcTmuxWindowTitle("/repo:backend", "release:main")).toBe("JWC-repo-backend-release-main");
		expect(buildJwcTmuxWindowTitle("/tmp/.jwc", null)).toBe("JWC-dot-jwc");
		expect(buildJwcTmuxWindowTitle("/tmp/...", "feature/demo")).toBe("JWC-jwc-feature/demo");
		const wide = buildJwcTmuxWindowTitle("/저장소", `feature/${"界".repeat(80)}끝`);
		expect(Bun.stringWidth(wide)).toBeLessThanOrEqual(48);
		expect(wide.startsWith("JWC-저장소-…")).toBe(true);
		expect(wide.endsWith("끝")).toBe(true);
	});

	it("does not plan tmux for interactive root launch without --tmux", () => {
		const plan = buildDefaultTmuxLaunchPlan({
			parsed: args({ messages: ["hello world"] }),
			rawArgs: ["hello world"],
			cwd: "/repo",
			env: {},
			argv: ["bun", "packages/coding-agent/src/cli.ts"],
			execPath: "/bin/bun",
			platform: "darwin",
			tty: interactiveTty,
			tmuxAvailable: true,
		});

		expect(plan).toBeUndefined();
	});

	it("plans an interactive --tmux root launch inside a new GJC tmux session", () => {
		const plan = buildDefaultTmuxLaunchPlan({
			parsed: args({ messages: ["hello world"], tmux: true }),
			rawArgs: ["--tmux", "hello world"],
			cwd: "/repo",
			env: {},
			argv: ["bun", "packages/coding-agent/src/cli.ts"],
			execPath: "/bin/bun",
			platform: "darwin",
			tty: interactiveTty,
			tmuxAvailable: true,
		});

		expect(plan).toBeDefined();
		if (!plan) throw new Error("expected tmux plan");

		expect(plan.sessionName.startsWith(GJC_TMUX_SESSION_PREFIX)).toBe(true);
		expect(plan.tmuxCommand).toBe("tmux");
		expect(plan.newSessionArgs.slice(0, 6)).toEqual(["new-session", "-d", "-s", plan.sessionName, "-c", "/repo"]);
		expect(plan?.innerCommand).toContain(`${GJC_TMUX_LAUNCHED_ENV}=1`);
		expect(plan?.innerCommand).toContain("'/bin/bun' '/repo/packages/coding-agent/src/cli.ts' 'hello world'");
		expect(plan?.innerCommand).not.toContain("'--tmux'");
	});

	it("sizes detached tmux new-session to the caller terminal when dimensions are known", () => {
		const plan = buildDefaultTmuxLaunchPlan({
			parsed: args({ messages: ["hello world"], tmux: true }),
			rawArgs: ["--tmux", "hello world"],
			cwd: "/repo",
			env: {},
			argv: ["bun", "packages/coding-agent/src/cli.ts"],
			execPath: "/bin/bun",
			platform: "darwin",
			tty: { stdin: true, stdout: true, columns: 178, rows: 35 },
			tmuxAvailable: true,
		});

		expect(plan).toBeDefined();
		if (!plan) throw new Error("expected tmux plan");
		expect(plan.initialSize).toEqual({ columns: 178, rows: 35 });
		expect(plan.newSessionArgs.slice(0, 10)).toEqual([
			"new-session",
			"-d",
			"-x",
			"178",
			"-y",
			"35",
			"-s",
			plan.sessionName,
			"-c",
			"/repo",
		]);
	});

	it("omits detached tmux sizing when caller dimensions are unknown", () => {
		const plan = buildDefaultTmuxLaunchPlan({
			parsed: args({ messages: ["hello world"], tmux: true }),
			rawArgs: ["--tmux", "hello world"],
			cwd: "/repo",
			env: {},
			argv: ["bun", "packages/coding-agent/src/cli.ts"],
			execPath: "/bin/bun",
			platform: "darwin",
			tty: interactiveTty,
			tmuxAvailable: true,
		});

		expect(plan).toBeDefined();
		if (!plan) throw new Error("expected tmux plan");
		expect(plan.initialSize).toBeUndefined();
		expect(plan.newSessionArgs).not.toContain("-x");
		expect(plan.newSessionArgs).not.toContain("-y");
		expect(plan.newSessionArgs.slice(0, 6)).toEqual(["new-session", "-d", "-s", plan.sessionName, "-c", "/repo"]);
	});

	it("does not plan managed tmux from a non-tty root launch", () => {
		const plan = buildDefaultTmuxLaunchPlan({
			parsed: args({ messages: ["hello world"], tmux: true }),
			rawArgs: ["--tmux", "hello world"],
			cwd: "/repo",
			env: {},
			argv: ["bun", "packages/coding-agent/src/cli.ts"],
			execPath: "/bin/bun",
			platform: "darwin",
			tty: { stdin: true, stdout: false, columns: 178, rows: 35 },
			tmuxAvailable: true,
		});

		expect(plan).toBeUndefined();
	});

	it("uses a host command for compiled Bun virtual entrypoints", () => {
		const plan = buildDefaultTmuxLaunchPlan({
			parsed: args({ messages: ["hello world"], tmux: true }),
			rawArgs: ["--tmux", "hello world"],
			cwd: "/repo",
			env: {},
			argv: ["gjc", "/$bunfs/root/gjc-linux-x64"],
			execPath: "/home/me/.local/bin/gjc",
			platform: "darwin",
			tty: interactiveTty,
			tmuxAvailable: true,
		});

		expect(plan).toBeDefined();
		if (!plan) throw new Error("expected tmux plan");

		expect(plan.innerCommand).not.toContain("$bunfs");
		expect(plan.innerCommand).toContain(`${GJC_TMUX_LAUNCHED_ENV}=1`);
		expect(plan.innerCommand).toContain("'/home/me/.local/bin/gjc' 'hello world'");
		expect(plan.innerCommand).not.toContain("'--tmux'");
	});

	it("falls back to jwc when compiled Bun virtual entrypoint has no host exec path", () => {
		const plan = buildDefaultTmuxLaunchPlan({
			parsed: args({ messages: ["hello world"], tmux: true }),
			rawArgs: ["--tmux"],
			cwd: "/repo",
			env: {},
			argv: ["gjc", "/$bunfs/root/gjc-linux-x64"],
			execPath: "/$bunfs/root/gjc-linux-x64",
			platform: "darwin",
			tty: interactiveTty,
			tmuxAvailable: true,
		});

		expect(plan?.innerCommand).not.toContain("$bunfs");
		expect(plan?.innerCommand).toContain("'jwc'");
		expect(plan?.innerCommand).not.toContain("'--tmux'");
	});

	it("renames managed tmux windows and configures the root terminal title", () => {
		const calls: { command: string; args: string[]; options: TmuxSpawnOptions }[] = [];
		const handled = launchDefaultTmuxIfNeeded({
			parsed: args({ messages: ["hello world"], tmux: true }),
			rawArgs: ["--tmux", "hello world"],
			cwd: "/repo",
			env: {},
			argv: ["bun", "packages/coding-agent/src/cli.ts"],
			execPath: "/bin/bun",
			platform: "darwin",
			tty: interactiveTty,
			tmuxAvailable: true,
			currentBranch: "feature/#S/demo",
			existingBranchSessionName: null,
			spawnSync: (command, spawnArgs, options) => {
				calls.push({ command, args: spawnArgs, options });
				return { exitCode: 0 };
			},
		});

		expect(handled).toBe(true);
		expect(calls.find(call => call.args[0] === "rename-window")?.args).toEqual([
			"rename-window",
			"-t",
			expect.stringMatching(/^=gajae_code_.*$/),
			"--",
			"JWC-repo-feature/#S/demo",
		]);
		expect(calls.find(call => call.args[3] === "set-titles-string")?.args.at(-1)).toBe("JWC: repo-feature/##S/demo");
		expect(calls.some(call => call.args[3] === "set-titles" && call.args[4] === "on")).toBe(true);
	});

	it("reasserts caller dimensions before attaching a newly created managed tmux session", () => {
		const calls: { command: string; args: string[]; options: TmuxSpawnOptions }[] = [];
		const handled = launchDefaultTmuxIfNeeded({
			parsed: args({ messages: ["hello world"], tmux: true }),
			rawArgs: ["--tmux", "hello world"],
			cwd: "/repo",
			env: {},
			argv: ["bun", "packages/coding-agent/src/cli.ts"],
			execPath: "/bin/bun",
			platform: "darwin",
			tty: { stdin: true, stdout: true, columns: 178, rows: 35 },
			tmuxAvailable: true,
			currentBranch: "feature/demo",
			existingBranchSessionName: null,
			spawnSync: (command, spawnArgs, options) => {
				calls.push({ command, args: spawnArgs, options });
				return { exitCode: 0 };
			},
		});

		expect(handled).toBe(true);
		const newSession = calls.find(call => call.args[0] === "new-session");
		const resizeIndex = calls.findIndex(call => call.args[0] === "resize-window");
		const attachIndex = calls.findIndex(call => call.args[0] === "attach-session");
		expect(newSession?.args).toContain("-x");
		expect(newSession?.args).toContain("178");
		expect(newSession?.args).toContain("-y");
		expect(newSession?.args).toContain("35");
		expect(resizeIndex).toBeGreaterThan(0);
		expect(resizeIndex).toBeLessThan(attachIndex);
		expect(calls[resizeIndex]?.args).toEqual([
			"resize-window",
			"-t",
			expect.stringMatching(/^=gajae_code_.*:$/),
			"-x",
			"178",
			"-y",
			"35",
		]);
	});

	it("emits a BOM-less PowerShell encoded command for native Windows --tmux plans", () => {
		const plan = buildDefaultTmuxLaunchPlan({
			parsed: args({ messages: ["hello world"], tmux: true }),
			rawArgs: ["--tmux", "hello world"],
			cwd: "C:\\repo",
			env: { JWC_TMUX_COMMAND: "psmux", JWC_PSMUX_COMMAND: "psmux", JWC_POWERSHELL_COMMAND: "powershell.exe" },
			argv: ["bun.exe", "packages\\coding-agent\\src\\cli.ts"],
			execPath: "C:\\Users\\jun\\.bun\\bin\\bun.exe",
			platform: "win32",
			tty: interactiveTty,
			tmuxAvailable: true,
		});

		expect(plan).toBeDefined();
		const encoded = plan?.innerCommand.match(/-EncodedCommand\s+([A-Za-z0-9+/=]+)/)?.[1];
		expect(encoded).toBeTruthy();
		if (!encoded) throw new Error("expected encoded command");
		const decoded = Buffer.from(encoded, "base64");
		expect(decoded[0]).not.toBe(0xff);
		expect(decoded[1]).not.toBe(0xfe);
		const script = decoded.toString("utf16le");
		expect(script[0]).toBe("$");
		expect(script).toContain("$env:GJC_TMUX_LAUNCHED = '1'");
		expect(script).toContain("& 'C:\\Users\\jun\\.bun\\bin\\bun.exe'");
		expect(script).toContain("'hello world'");
		expect(script).not.toContain("'--tmux'");
		expect(plan?.innerCommand.startsWith("powershell.exe ")).toBe(true);
	});

	it("attaches existing tagged session for matching worktree branch", () => {
		const calls: { command: string; args: string[]; options: TmuxSpawnOptions }[] = [];
		const handled = launchDefaultTmuxIfNeeded({
			parsed: args({ messages: ["hello world"], tmux: true }),
			rawArgs: ["--tmux", "hello world"],
			cwd: "/repo",
			env: {},
			argv: ["bun", "packages/coding-agent/src/cli.ts"],
			execPath: "/bin/bun",
			platform: "darwin",
			tty: interactiveTty,
			tmuxAvailable: true,
			worktreeBranch: "feature/demo",
			existingBranchSessionName: "gajae_code_feature",
			spawnSync: (command, spawnArgs, options) => {
				calls.push({ command, args: spawnArgs, options });
				return { exitCode: 0 };
			},
		});

		expect(handled).toBe(true);
		expect(calls.some(call => call.args[0] === "new-session")).toBe(false);
		expect(calls.at(-1)?.args).toEqual(["attach-session", "-t", "=gajae_code_feature"]);
	});

	it("does not reuse same-branch sessions from another project", () => {
		const plan = buildDefaultTmuxLaunchPlan({
			parsed: args({ messages: ["hello world"], tmux: true }),
			rawArgs: ["--tmux", "hello world"],
			cwd: "/repo-b/worktree",
			env: {},
			argv: ["bun", "packages/coding-agent/src/cli.ts"],
			execPath: "/bin/bun",
			platform: "darwin",
			tty: interactiveTty,
			tmuxAvailable: true,
			worktreeBranch: "feature/demo",
			project: "/repo-b",
			existingBranchSessionName: null,
		});

		expect(plan?.attachSessionName).toBeUndefined();
		expect(plan?.branch).toBe("feature/demo");
		expect(plan?.project).toBe("/repo-b");
	});

	it("honors an explicit GJC_TMUX_SESSION override", () => {
		const plan = buildDefaultTmuxLaunchPlan({
			parsed: args({ messages: ["hello world"], tmux: true }),
			rawArgs: ["--tmux", "hello world"],
			cwd: "/repo",
			env: { GJC_TMUX_SESSION: "custom-gjc" },
			argv: ["bun", "packages/coding-agent/src/cli.ts"],
			execPath: "/bin/bun",
			platform: "darwin",
			tty: interactiveTty,
			tmuxAvailable: true,
		});

		expect(plan?.sessionName).toBe("custom-gjc");
		expect(plan?.newSessionArgs.slice(0, 6)).toEqual(["new-session", "-d", "-s", "custom-gjc", "-c", "/repo"]);
	});

	it("builds a session-scoped tmux profile without global tmux mutation", () => {
		const commands = buildJwcTmuxProfileCommands("gjc-session:0", {});
		const args = commands.map(command => command.args);

		expect(args).toContainEqual(["set-option", "-t", "gjc-session:0", "mouse", "on"]);
		expect(args).toContainEqual(["set-option", "-t", "gjc-session:0", "@gjc-profile", "1"]);
		expect(args).toContainEqual(["set-option", "-t", "gjc-session:0", "set-clipboard", "on"]);
		expect(args).toContainEqual([
			"set-window-option",
			"-t",
			"gjc-session:0",
			"mode-style",
			"fg=colour231,bg=colour60",
		]);
		expect(args.flat()).not.toContain("-g");
		expect(
			buildJwcTmuxProfileCommands("gjc-session:0", { GJC_TMUX_PROFILE: "false" }).map(command => command.args),
		).toEqual([["set-option", "-t", "gjc-session:0", "@gjc-profile", "1"]]);
		expect(
			buildJwcTmuxProfileCommands("gjc-session:0", { GJC_MOUSE: "off" }).flatMap(command => command.args),
		).not.toContain("mouse");
	});

	it("applies the tmux profile only to the requested target", () => {
		const calls: { command: string; args: string[] }[] = [];
		const result = applyJwcTmuxProfile({
			tmuxCommand: "tmux",
			target: "%7",
			cwd: "/repo",
			env: {},
			spawnSync: (command, spawnArgs) => {
				calls.push({ command, args: spawnArgs });
				return { exitCode: 0 };
			},
		});

		expect(result.skipped).toBe(false);
		expect(result.failures).toEqual([]);
		expect(calls).toHaveLength(4);
		expect(calls.every(call => call.command === "tmux")).toBe(true);
		expect(calls.every(call => call.args.includes("-t") && call.args.includes("%7"))).toBe(true);
		expect(calls.flatMap(call => call.args)).not.toContain("-g");
	});

	it("does not wrap non-interactive or already wrapped launches", () => {
		const common = {
			rawArgs: [],
			cwd: "/repo",
			argv: ["/usr/local/bin/gjc"],
			execPath: "/bin/bun",
			platform: "darwin" as const,
			tty: interactiveTty,
			tmuxAvailable: true,
		};

		expect(buildDefaultTmuxLaunchPlan({ ...common, parsed: args({ print: true }), env: {} })).toBeUndefined();
		expect(buildDefaultTmuxLaunchPlan({ ...common, parsed: args({ mode: "json" }), env: {} })).toBeUndefined();
		expect(
			buildDefaultTmuxLaunchPlan({ ...common, parsed: args({ tmux: true }), env: { TMUX: "/tmp/tmux" } }),
		).toBeUndefined();
		expect(
			buildDefaultTmuxLaunchPlan({
				...common,
				parsed: args({ tmux: true }),
				env: { [GJC_TMUX_LAUNCHED_ENV]: "1" },
			}),
		).toBeUndefined();
	});

	it("falls through to direct launch when session creation fails", () => {
		const calls: { command: string; args: string[]; options: TmuxSpawnOptions }[] = [];
		const handled = launchDefaultTmuxIfNeeded({
			parsed: args({ tmux: true }),
			rawArgs: [],
			cwd: "/repo",
			env: {},
			argv: ["/usr/local/bin/gjc"],
			execPath: "/bin/bun",
			platform: "darwin",
			tty: interactiveTty,
			tmuxAvailable: true,
			spawnSync: (command, spawnArgs, options) => {
				calls.push({ command, args: spawnArgs, options });
				return { exitCode: 1 };
			},
		});

		expect(handled).toBe(false);
		expect(calls).toHaveLength(1);
		expect(calls[0].args[0]).toBe("new-session");
	});

	it("handles and reports partial launch when required profile tagging fails", () => {
		const calls: { command: string; args: string[]; options: TmuxSpawnOptions }[] = [];
		const diagnostics: string[] = [];
		const handled = launchDefaultTmuxIfNeeded({
			parsed: args({ tmux: true }),
			rawArgs: [],
			cwd: "/repo",
			env: {},
			argv: ["/usr/local/bin/gjc"],
			execPath: "/bin/bun",
			platform: "darwin",
			tty: interactiveTty,
			tmuxAvailable: true,
			diagnosticWriter: message => diagnostics.push(message),
			spawnSync: (command, spawnArgs, options) => {
				calls.push({ command, args: spawnArgs, options });
				if (spawnArgs.includes("@gjc-profile")) return { exitCode: 1, stderr: "no server running on /tmp/tmux" };
				return { exitCode: 0 };
			},
		});

		expect(handled).toBe(true);
		expect(calls.some(call => call.args[0] === "new-session")).toBe(true);
		expect(calls.some(call => call.args[0] === "kill-session")).toBe(true);
		expect(diagnostics).toHaveLength(1);
		expect(diagnostics[0]).toStartWith("jwc --tmux failed after creating tmux session: profile tagging failed.");
		expect(diagnostics[0].length).toBeLessThan(320);
	});

	it("handles and reports partial launch when attach fails after profile succeeds", () => {
		const calls: { command: string; args: string[]; options: TmuxSpawnOptions }[] = [];
		const diagnostics: string[] = [];
		const handled = launchDefaultTmuxIfNeeded({
			parsed: args({ tmux: true }),
			rawArgs: [],
			cwd: "/repo",
			env: {},
			argv: ["/usr/local/bin/gjc"],
			execPath: "/bin/bun",
			platform: "darwin",
			tty: interactiveTty,
			tmuxAvailable: true,
			diagnosticWriter: message => diagnostics.push(message),
			spawnSync: (command, spawnArgs, options) => {
				calls.push({ command, args: spawnArgs, options });
				if (spawnArgs[0] === "attach-session") return { exitCode: 1, stderr: "attach failed" };
				return { exitCode: 0 };
			},
		});

		expect(handled).toBe(true);
		expect(calls.some(call => call.args[0] === "new-session")).toBe(true);
		expect(calls.some(call => call.args[0] === "attach-session")).toBe(true);
		expect(calls.some(call => call.args[0] === "kill-session")).toBe(true);
		expect(diagnostics).toHaveLength(1);
		expect(diagnostics[0]).toStartWith("jwc --tmux failed after creating tmux session: attach failed.");
		expect(diagnostics[0].length).toBeLessThan(320);
	});

	it("does not duplicate new-session when psmux has not registered the session yet", () => {
		const calls: { command: string; args: string[]; options: TmuxSpawnOptions }[] = [];
		const diagnostics: string[] = [];
		const handled = launchDefaultTmuxIfNeeded({
			parsed: args({ messages: ["hello world"], tmux: true }),
			rawArgs: ["--tmux", "hello world"],
			cwd: "C:\\repo",
			env: { JWC_TMUX_COMMAND: "psmux", JWC_PSMUX_COMMAND: "psmux" },
			argv: ["bun.exe", "packages\\coding-agent\\src\\cli.ts"],
			execPath: "C:\\Users\\jun\\.bun\\bin\\bun.exe",
			platform: "win32",
			tty: interactiveTty,
			tmuxAvailable: true,
			diagnosticWriter: message => diagnostics.push(message),
			spawnSync: (command, spawnArgs, options) => {
				calls.push({ command, args: spawnArgs, options });
				if (spawnArgs[0] === "has-session") return { exitCode: 1, stderr: "psmux: no server running" };
				return { exitCode: 0 };
			},
		});

		expect(handled).toBe(false);
		expect(calls.filter(call => call.args[0] === "new-session")).toHaveLength(1);
		expect(calls.filter(call => call.args[0] === "has-session").length).toBeGreaterThan(1);
		expect(calls.some(call => call.args[0] === "kill-session")).toBe(true);
		expect(diagnostics[0]).toContain("session registration failed");
	});

	it("retries Windows psmux attach once after transient os error 10061", () => {
		const calls: { command: string; args: string[]; options: TmuxSpawnOptions }[] = [];
		let attachAttempts = 0;
		const handled = launchDefaultTmuxIfNeeded({
			parsed: args({ messages: ["hello world"], tmux: true }),
			rawArgs: ["--tmux", "hello world"],
			cwd: "C:\\repo",
			env: { JWC_TMUX_COMMAND: "psmux", JWC_PSMUX_COMMAND: "psmux" },
			argv: ["bun.exe", "packages\\coding-agent\\src\\cli.ts"],
			execPath: "C:\\Users\\jun\\.bun\\bin\\bun.exe",
			platform: "win32",
			tty: interactiveTty,
			tmuxAvailable: true,
			diagnosticWriter: () => {},
			spawnSync: (command, spawnArgs, options) => {
				calls.push({ command, args: spawnArgs, options });
				if (spawnArgs[0] === "attach-session") {
					attachAttempts += 1;
					if (attachAttempts === 1) {
						return {
							exitCode: 1,
							stderr: "psmux: connection refused by target computer (os error 10061)",
						};
					}
				}
				return { exitCode: 0 };
			},
		});

		expect(handled).toBe(true);
		expect(calls.filter(call => call.args[0] === "attach-session")).toHaveLength(2);
		expect(calls.some(call => call.args[0] === "has-session")).toBe(true);
		expect(calls.some(call => call.args[0] === "kill-session")).toBe(false);
		expect(calls.find(call => call.args[0] === "attach-session")?.options.captureStderr).toBe(true);
	});

	it("recreates a Windows psmux session that disappears after transient attach os error 10061", () => {
		const calls: { command: string; args: string[]; options: TmuxSpawnOptions }[] = [];
		let attachAttempts = 0;
		let newSessionCount = 0;
		const handled = launchDefaultTmuxIfNeeded({
			parsed: args({ messages: ["hello world"], tmux: true }),
			rawArgs: ["--tmux", "hello world"],
			cwd: "C:\\repo",
			env: { JWC_TMUX_COMMAND: "psmux", JWC_PSMUX_COMMAND: "psmux" },
			argv: ["bun.exe", "packages\\coding-agent\\src\\cli.ts"],
			execPath: "C:\\Users\\jun\\.bun\\bin\\bun.exe",
			platform: "win32",
			tty: interactiveTty,
			tmuxAvailable: true,
			diagnosticWriter: () => {},
			spawnSync: (command, spawnArgs, options) => {
				calls.push({ command, args: spawnArgs, options });
				if (spawnArgs[0] === "new-session") {
					newSessionCount += 1;
					return { exitCode: 0 };
				}
				if (spawnArgs[0] === "attach-session") {
					attachAttempts += 1;
					if (attachAttempts === 1) {
						return {
							exitCode: 1,
							stderr: "psmux: connection refused by target computer (os error 10061)",
						};
					}
				}
				if (spawnArgs[0] === "has-session" && attachAttempts > 0 && newSessionCount === 1) {
					return { exitCode: 1, stderr: "psmux: no server running" };
				}
				return { exitCode: 0 };
			},
		});

		expect(handled).toBe(true);
		expect(calls.filter(call => call.args[0] === "new-session")).toHaveLength(2);
		expect(calls.filter(call => call.args[0] === "attach-session")).toHaveLength(2);
		expect(calls.some(call => call.args.includes("@gjc-profile"))).toBe(true);
		expect(calls.some(call => call.args[0] === "kill-session")).toBe(false);
	});

	it("does not retry Windows psmux attach failures without os error 10061", () => {
		const calls: { command: string; args: string[]; options: TmuxSpawnOptions }[] = [];
		const diagnostics: string[] = [];
		const handled = launchDefaultTmuxIfNeeded({
			parsed: args({ messages: ["hello world"], tmux: true }),
			rawArgs: ["--tmux", "hello world"],
			cwd: "C:\\repo",
			env: { JWC_TMUX_COMMAND: "psmux", JWC_PSMUX_COMMAND: "psmux" },
			argv: ["bun.exe", "packages\\coding-agent\\src\\cli.ts"],
			execPath: "C:\\Users\\jun\\.bun\\bin\\bun.exe",
			platform: "win32",
			tty: interactiveTty,
			tmuxAvailable: true,
			diagnosticWriter: message => diagnostics.push(message),
			spawnSync: (command, spawnArgs, options) => {
				calls.push({ command, args: spawnArgs, options });
				if (spawnArgs[0] === "attach-session") return { exitCode: 1, stderr: "psmux: attach failed" };
				return { exitCode: 0 };
			},
		});

		expect(handled).toBe(true);
		expect(calls.filter(call => call.args[0] === "attach-session")).toHaveLength(1);
		expect(calls.some(call => call.args[0] === "kill-session")).toBe(true);
		expect(diagnostics[0]).toStartWith("jwc --tmux failed after creating tmux session: attach failed.");
	});

	it("falls through to direct launch when tmux is unavailable", () => {
		const plan = buildDefaultTmuxLaunchPlan({
			parsed: args({ tmux: true }),
			rawArgs: [],
			cwd: "/repo",
			env: {},
			argv: ["/usr/local/bin/gjc"],
			execPath: "/bin/bun",
			platform: "darwin",
			tty: interactiveTty,
			tmuxAvailable: false,
		});

		expect(plan).toBeUndefined();
	});
});
