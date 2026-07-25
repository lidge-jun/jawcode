import { describe, expect, it } from "bun:test";

import { versionChangelogContent } from "./release-changelog";

const version = "1.2.3";
const date = "2026-07-26";

describe("versionChangelogContent", () => {
	it("keeps Unreleased and inserts an empty version heading", () => {
		const result = versionChangelogContent("# Changelog\n\n## [Unreleased]\n", version, date);

		expect(result).toContain("## [Unreleased]\n\n## [1.2.3] - 2026-07-26");
	});

	it("moves Unreleased content under the version and re-adds an empty Unreleased section", () => {
		const content = "# Changelog\n\n## [Unreleased]\n\n### Fixed\n\n- Corrected extraction.\n";
		const result = versionChangelogContent(content, version, date);

		expect(result).toBe(
			"# Changelog\n\n## [Unreleased]\n\n## [1.2.3] - 2026-07-26\n\n### Fixed\n\n- Corrected extraction.\n",
		);
	});

	it("removes a stale empty version heading before inserting the new one", () => {
		const content = "# Changelog\n\n## [Unreleased]\n\n## [1.2.2] - 2026-07-25\n## [1.2.1] - 2026-07-24\n\n### Fixed\n\n- Prior fix.\n";
		const result = versionChangelogContent(content, version, date);

		expect(result).not.toContain("## [1.2.2]");
		expect(result).toContain("## [1.2.3] - 2026-07-26\n\n## [1.2.1] - 2026-07-24");
	});

	it("does not duplicate headings when transformed twice", () => {
		const content = "# Changelog\n\n## [Unreleased]\n";
		const once = versionChangelogContent(content, version, date);
		const twice = versionChangelogContent(once, version, date);

		expect(twice.match(/## \[Unreleased\]/g)).toHaveLength(1);
		expect(twice.match(/## \[1\.2\.3\] - 2026-07-26/g)).toHaveLength(1);
	});
});
