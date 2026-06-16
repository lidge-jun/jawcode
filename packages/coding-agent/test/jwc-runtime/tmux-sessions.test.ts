import { afterEach, describe, expect, it, spyOn, vi } from "bun:test";
import {
	listJwcTmuxSessions,
	removeJwcTmuxSession,
	statusJwcTmuxSession,
} from "@jawcode-dev/coding-agent/jwc-runtime/tmux-sessions";

type SpawnSyncResult = Bun.SyncSubprocess<"pipe", "pipe">;
type SpawnSyncSpy = { mockImplementation(implementation: (command: string[]) => SpawnSyncResult): void };

function spawnResult(exitCode: number, stdout: string, stderr = ""): SpawnSyncResult {
	return {
		exitCode,
		stdout: Buffer.from(stdout),
		stderr: Buffer.from(stderr),
	} as SpawnSyncResult;
}

describe("GJC tmux session management", () => {
	afterEach(() => {
		vi.restoreAllMocks();
	});

	it("lists only GJC-managed tmux sessions", () => {
		spyOn(Bun, "spawnSync").mockReturnValue(
			spawnResult(
				0,
				[
					"gajae_code_abc\t1\t0\t1770000000\t1\troot\t2\tfeature/demo\tfeature-demo\t/repo-a",
					"unrelated\t2\t1\t1770000060\t\troot\t3\t\t",
					"gajae_code\t1\t1\t1770000120\t\troot\t1\t\t",
				].join("\n"),
			),
		);

		const sessions = listJwcTmuxSessions({ GJC_TMUX_COMMAND: "tmux-test" });

		expect(sessions.map(session => session.name)).toEqual(["gajae_code_abc"]);
		expect(sessions[0].attached).toBe(false);
		expect(sessions[0].panes).toBe(2);
		expect(sessions[0].bindings).toBe("root");
		expect(sessions[0].createdAt).toBe("2026-02-02T02:40:00.000Z");
		expect(sessions[0].branch).toBe("feature/demo");
		expect(sessions[0].project).toBe("/repo-a");
		expect(Bun.spawnSync).toHaveBeenCalledWith(
			[
				"tmux-test",
				"list-sessions",
				"-F",
				"#{session_name}\t#{session_windows}\t#{session_attached}\t#{session_created}\t#{@gjc-profile}\t#{session_key_table}\t#{session_panes}\t#{@gjc-branch}\t#{@gjc-branch-slug}\t#{@gjc-project}",
			],
			expect.any(Object),
		);
	});

	it("returns an empty list when tmux has no server", () => {
		spyOn(Bun, "spawnSync").mockReturnValue(spawnResult(1, "", "no server running on /tmp/tmux"));

		expect(listJwcTmuxSessions()).toEqual([]);
	});

	it("guards status and remove to GJC-managed sessions", () => {
		const calls: string[][] = [];
		const spawnSyncSpy = spyOn(Bun, "spawnSync") as unknown as SpawnSyncSpy;
		spawnSyncSpy.mockImplementation((cmd: string[]) => {
			calls.push(cmd);
			if (cmd.includes("list-sessions")) {
				return spawnResult(0, "gajae_code_work\t1\t0\t1770000000\t1\troot\t1\t\t\n");
			}
			if (cmd.includes("show-options")) return spawnResult(0, "1\n");
			return spawnResult(0, "");
		});

		expect(statusJwcTmuxSession("gajae_code_work").name).toBe("gajae_code_work");
		expect(() => statusJwcTmuxSession("unrelated")).toThrow("jwc_tmux_session_not_found:unrelated");
		expect(removeJwcTmuxSession("gajae_code_work").name).toBe("gajae_code_work");
		expect(calls.at(-1)).toEqual(["tmux", "kill-session", "-t", "=gajae_code_work"]);
	});

	it("does not kill when final live profile check fails", () => {
		const calls: string[][] = [];
		const spawnSyncSpy = spyOn(Bun, "spawnSync") as unknown as SpawnSyncSpy;
		spawnSyncSpy.mockImplementation((cmd: string[]) => {
			calls.push(cmd);
			if (cmd.includes("list-sessions")) {
				return spawnResult(0, "gajae_code_work\t1\t0\t1770000000\t1\troot\t1\t\t\n");
			}
			if (cmd.includes("show-options")) return spawnResult(0, "\n");
			return spawnResult(0, "");
		});

		expect(() => removeJwcTmuxSession("gajae_code_work")).toThrow("gjc_tmux_session_not_managed:gajae_code_work");
		expect(calls.some(call => call.includes("kill-session"))).toBe(false);
	});
});
