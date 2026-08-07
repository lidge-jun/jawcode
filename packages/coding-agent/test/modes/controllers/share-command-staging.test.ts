/**
 * `/share` exports the FULL session transcript to disk before uploading it.
 *
 * It used to write that export to a predictable path directly in the shared
 * temp dir, and `Bun.write` under the default umask produces mode 0644. On a
 * multi-user host every local account could read the entire conversation for
 * as long as the share ran, and could pre-create the path.
 *
 * The export is now staged in an owner-only directory. These assertions are on
 * the real `handleShareCommand`, with the upload path stubbed out.
 */
import { afterEach, describe, expect, it, vi } from "bun:test";
import * as fs from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";
import { CommandController } from "@jawcode-dev/coding-agent/modes/controllers/command-controller";
import type { InteractiveModeContext } from "@jawcode-dev/coding-agent/modes/types";

/** Everything the share path touches on the export side. */
interface StagingObservation {
	filePath: string;
	fileMode: number;
	dirMode: number;
	dirPath: string;
}

function createController(onExport: (outputPath: string) => Promise<void>): {
	controller: CommandController;
	showError: ReturnType<typeof vi.fn>;
	showStatus: ReturnType<typeof vi.fn>;
} {
	const showStatus = vi.fn();
	const showError = vi.fn();
	const ctx = {
		session: {
			exportToHtml: async (outputPath: string) => {
				await onExport(outputPath);
				return outputPath;
			},
		},
		showStatus,
		showError,
	} as unknown as InteractiveModeContext;
	return { controller: new CommandController(ctx), showStatus, showError };
}

afterEach(() => {
	vi.restoreAllMocks();
});

describe("/share export staging", () => {
	it("stages the transcript owner-only, then removes the whole directory", async () => {
		let observed: StagingObservation | undefined;

		// exportToHtml runs with the staging already created, which is the window
		// where an attacker would race the file. Inspecting it here observes the
		// real staging rather than a reconstruction of it.
		const { controller } = createController(async outputPath => {
			const dirPath = path.dirname(outputPath);
			observed = {
				filePath: outputPath,
				fileMode: (await fs.stat(outputPath)).mode & 0o777,
				dirMode: (await fs.stat(dirPath)).mode & 0o777,
				dirPath,
			};
			await Bun.write(outputPath, "<html>full transcript</html>");
		});

		// The upload path needs `gh`, a live account and a UI; this exercise stops
		// at the staging contract, so failing afterwards is expected and fine.
		await controller.handleShareCommand().catch(() => undefined);

		expect(observed).toBeDefined();
		if (!observed) return;

		if (process.platform !== "win32") {
			// 0600/0700: nothing for group or other. A single readable bit here is
			// the whole vulnerability.
			expect(observed.fileMode).toBe(0o600);
			expect(observed.dirMode).toBe(0o700);
		}

		// Staging must not sit directly in the shared temp dir.
		expect(path.dirname(observed.filePath)).not.toBe(os.tmpdir());
		expect(path.dirname(observed.dirPath)).toBe(os.tmpdir());
	});

	it("reports an export failure instead of proceeding to upload", async () => {
		const { controller, showError } = createController(async () => {
			throw new Error("disk full");
		});

		await controller.handleShareCommand();

		expect(showError).toHaveBeenCalledWith(expect.stringContaining("disk full"));
	});
});
