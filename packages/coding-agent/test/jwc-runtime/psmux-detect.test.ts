import { afterEach, describe, expect, it } from "bun:test";
import {
	__setBinaryResolverForTests,
	clearPsmuxDetectionCache,
	detectPsmux,
	type PsmuxSpawnRunner,
	probePsmux,
	resolveJwcTmuxBinary,
} from "../../src/jwc-runtime/psmux-detect";
import { buildJwcTmuxExactOptionTarget, buildJwcTmuxExactSessionTarget } from "../../src/jwc-runtime/tmux-common";

afterEach(() => {
	__setBinaryResolverForTests(null);
	clearPsmuxDetectionCache();
});

function runner(outputByCommand: Record<string, string>): PsmuxSpawnRunner {
	return (command, _args) => ({ exitCode: 0, stdout: outputByCommand[command] ?? "tmux 3.6a", stderr: "" });
}

describe("psmux detection", () => {
	it("prefers psmux on native Windows when no explicit tmux command is set", () => {
		__setBinaryResolverForTests(candidate => (candidate === "psmux" ? candidate : null));

		const resolved = resolveJwcTmuxBinary({
			platform: "win32",
			env: {},
			runner: runner({ psmux: "psmux 3.3.6" }),
		});

		expect(resolved).toEqual({ command: "psmux", isPsmux: true, viaExplicitOverride: false });
	});

	it("honors JWC psmux env aliases and legacy GJC aliases", () => {
		__setBinaryResolverForTests(candidate => candidate);

		expect(
			resolveJwcTmuxBinary({
				platform: "darwin",
				env: { JWC_TMUX_COMMAND: "custom-tmux", JWC_PSMUX_COMMAND: "custom-tmux" },
				runner: runner({ "custom-tmux": "tmux 3.6a" }),
			}).isPsmux,
		).toBe(true);
		expect(detectPsmux("gjc-psmux", { env: { GJC_PSMUX_COMMAND: "pmux" } })).toBe(true);
	});

	it("supports detection-off and forced probe cache behavior", () => {
		__setBinaryResolverForTests(candidate => candidate);
		let output = "psmux 3.3.6";
		const dynamicRunner: PsmuxSpawnRunner = () => ({ exitCode: 0, stdout: output, stderr: "" });

		expect(detectPsmux("tmux", { env: {}, runner: dynamicRunner })).toBe(true);
		output = "tmux 3.6a";
		expect(detectPsmux("tmux", { env: {}, runner: dynamicRunner })).toBe(true);
		expect(detectPsmux("tmux", { env: { JWC_PSMUX_FORCE_DETECT: "1" }, runner: dynamicRunner })).toBe(false);
		expect(detectPsmux("tmux", { env: { JWC_PSMUX_DETECTION: "off" }, runner: dynamicRunner, force: true })).toBe(
			false,
		);
	});

	it("uses bare session targets for psmux and exact targets for native tmux", () => {
		__setBinaryResolverForTests(candidate => candidate);

		expect(buildJwcTmuxExactSessionTarget("demo", { env: { JWC_TMUX_COMMAND: "psmux" } })).toBe("demo");
		expect(buildJwcTmuxExactOptionTarget("demo", { env: { JWC_TMUX_COMMAND: "psmux" } })).toBe("demo");
		expect(
			buildJwcTmuxExactSessionTarget("demo", {
				binary: { command: "tmux", isPsmux: false, viaExplicitOverride: false },
			}),
		).toBe("=demo");
		expect(
			buildJwcTmuxExactOptionTarget("demo", {
				binary: { command: "tmux", isPsmux: false, viaExplicitOverride: false },
			}),
		).toBe("=demo:");
	});

	it("reports probe output for resolved binaries", () => {
		__setBinaryResolverForTests(candidate => candidate);

		const probe = probePsmux("pmux", { runner: runner({ pmux: "pmux 3.3.6" }), force: true });

		expect(probe.command).toBe("pmux");
		expect(probe.versionOutput).toContain("pmux");
		expect(probe.isPsmux).toBe(true);
	});
});
