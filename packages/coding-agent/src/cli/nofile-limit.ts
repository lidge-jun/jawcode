import { execFileSync } from "node:child_process";

export const RECOMMENDED_MACOS_NOFILE_LIMIT = 4096;

export function parseNoFileLimit(text: string): number | undefined {
	const trimmed = text.trim();
	if (!trimmed || trimmed === "unlimited") return undefined;
	const value = Number(trimmed);
	return Number.isSafeInteger(value) && value > 0 ? value : undefined;
}

export function buildMacOSNoFileLimitWarning(currentLimit: number): string {
	return [
		`Warning: macOS file descriptor limit is low (ulimit -n = ${currentLimit}).`,
		'JWC and project dev servers can hit EMFILE / "too many open files" while scanning or watching repositories.',
		"For this terminal session, run:",
		`  ulimit -n ${RECOMMENDED_MACOS_NOFILE_LIMIT}`,
		"If your shell refuses that value, raise the per-user launchd limit and restart the terminal:",
		`  sudo launchctl limit maxfiles ${RECOMMENDED_MACOS_NOFILE_LIMIT} 65536`,
		"Avoid using huge values such as 2147483646 on macOS; they are commonly rejected or clamped.",
		"Set JWC_SKIP_NOFILE_CHECK=1 to silence this preflight warning.",
	].join("\n");
}

export function warnIfMacOSNoFileLimitTooLow(): void {
	if (process.platform !== "darwin") return;
	if (process.env.JWC_SKIP_NOFILE_CHECK === "1") return;
	try {
		const raw = execFileSync("sh", ["-c", "ulimit -n"], { encoding: "utf-8" });
		const limit = parseNoFileLimit(raw);
		if (limit !== undefined && limit < RECOMMENDED_MACOS_NOFILE_LIMIT) {
			process.stderr.write(`\n${buildMacOSNoFileLimitWarning(limit)}\n\n`);
		}
	} catch {
		// Non-fatal: if ulimit is unavailable, skip silently.
	}
}
