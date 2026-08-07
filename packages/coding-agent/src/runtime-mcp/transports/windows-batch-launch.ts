/**
 * Windows `.cmd`/`.bat` launch construction for MCP stdio servers.
 *
 * Two facts drive this module:
 *
 * 1. Bun resolves a bare `npx` to `npx.cmd` on Windows, then hands that path to
 *    `CreateProcessW` — which cannot launch batch files at all. So JWC's bundled
 *    default MCP server (`npx -y @upstash/context7-mcp@latest`) does not start.
 *    Fixing that requires routing through `cmd.exe /c`.
 *
 * 2. `cmd.exe` parses the command line *before* the program sees it, so routing
 *    through it without escaping introduces CVE-2024-24576 ("BatBadBut"): an
 *    argument containing `%VAR%`, a quote, or a metacharacter can be expanded or
 *    inject a new command.
 *
 * The escaping is therefore not optional hardening bolted onto a compatibility
 * fix — it is what makes the compatibility fix safe to make at all.
 *
 * Everything here is pure: argv in, argv out. That is deliberate, so the
 * security-critical construction is testable on any host rather than only on
 * Windows.
 */
import * as path from "node:path";

/** Extensions `cmd.exe` must interpret rather than `CreateProcessW` executing. */
const WINDOWS_BATCH_EXTENSIONS = new Set([".bat", ".cmd"]);

/**
 * Characters safe to leave unquoted for both `cmd.exe` and `CommandLineToArgvW`.
 * Anything outside this set forces quoting.
 *
 * `,` and `;` and `=` are deliberately EXCLUDED even though they look harmless:
 * `cmd.exe` treats them as token separators, so an unquoted `a,b` would arrive at
 * the program as two arguments instead of one. This mirrors upstream's set.
 */
const CMD_SAFE_ARG = /^[A-Za-z0-9#$*+\-./:?@\\_]+$/;

/**
 * Neutralize a literal `%` so `cmd.exe` cannot expand `%VAR%`.
 *
 * `%%cd:~,%` expands to the empty string, so it splits a `%` pair without
 * contributing characters — the standard trick, because `cmd.exe` offers no
 * escape for `%` inside a quoted string.
 */
const PERCENT_NEUTRALIZER = "%%cd:~,%";

/** True when this argv would be executed by `cmd.exe` rather than directly. */
export function isWindowsBatchTarget(command: string): boolean {
	return WINDOWS_BATCH_EXTENSIONS.has(path.extname(command).toLowerCase());
}

/**
 * Escape one argument for `cmd.exe`'s parser.
 *
 * Rejects NUL/CR/LF outright: a newline cannot be represented on a `cmd.exe`
 * command line, and silently truncating there would smuggle the remainder.
 */
export function escapeCmdBatchArg(arg: string): string {
	if (/[\0\r\n]/.test(arg)) {
		throw new Error("Windows batch argument cannot contain NUL, CR, or LF characters");
	}

	const needsQuotes = arg.length === 0 || arg.endsWith("\\") || !CMD_SAFE_ARG.test(arg);
	let out = needsQuotes ? '"' : "";
	let backslashes = 0;

	for (const ch of arg) {
		if (ch === "\\") {
			backslashes += 1;
			out += ch;
		} else if (ch === '"') {
			// Backslashes preceding a quote are doubled, then the quote is escaped
			// as `""` — which `cmd.exe` treats as a literal quote inside a string.
			out += "\\".repeat(backslashes);
			out += '""';
			backslashes = 0;
		} else if (ch === "%") {
			out += PERCENT_NEUTRALIZER;
			backslashes = 0;
		} else {
			backslashes = 0;
			out += ch;
		}
	}

	if (needsQuotes) {
		out += "\\".repeat(backslashes);
		out += '"';
	}
	return out;
}

/**
 * Build the `cmd.exe` argv for a batch target.
 *
 * The command path is escaped too: a `%` in the shim path would otherwise expand
 * before launch. The outer `""…"` wrapper is how `cmd.exe /c` accepts a quoted
 * program plus quoted arguments without stripping the first quote.
 *
 * `/d` skips AutoRun, `/e:ON` keeps command extensions, `/v:OFF` disables
 * delayed expansion so a `!` in an argument cannot expand either.
 */
export function buildCmdExeArgv(comspec: string, command: string, args: readonly string[]): string[] {
	let line = `""${escapeCmdBatchArg(command)}"`;
	for (const arg of args) line += ` ${escapeCmdBatchArg(arg)}`;
	line += '"';
	return [comspec, "/d", "/e:ON", "/v:OFF", "/c", line];
}

export interface WindowsBatchLaunch {
	argv: string[];
	windowsVerbatimArguments: true;
}

/**
 * Rewrite an MCP argv for `cmd.exe` when the target is a batch shim.
 *
 * Returns `null` when no rewrite applies — non-Windows, or a target that
 * `CreateProcessW` can execute directly — so the caller keeps its existing
 * behavior byte-for-byte.
 *
 * `windowsVerbatimArguments` is mandatory on this path: libuv's quoting targets
 * `CommandLineToArgvW`, not `cmd.exe`, so letting it re-quote the line would
 * corrupt arguments and reopen the injection hole the escaping closes.
 */
export function resolveWindowsBatchLaunch(
	command: string,
	args: readonly string[],
	options: { platform?: NodeJS.Platform; comspec?: string } = {},
): WindowsBatchLaunch | null {
	const platform = options.platform ?? process.platform;
	if (platform !== "win32") return null;
	if (!isWindowsBatchTarget(command)) return null;

	const comspec = options.comspec?.trim() || "cmd.exe";
	return { argv: buildCmdExeArgv(comspec, command, args), windowsVerbatimArguments: true };
}
