export function hasUnreleasedContent(content: string): boolean {
	const unreleasedMatch = content.match(/## \[Unreleased\]\s*\n([\s\S]*?)(?=## \[|$)/);
	if (!unreleasedMatch) return false;
	return unreleasedMatch[1].trim().length > 0;
}

export function removeEmptyVersionEntries(content: string): string {
	return content.replace(/## \[\d+\.\d+\.\d+\] - \d{4}-\d{2}-\d{2}\s*\n(?=## \[|\s*$)/g, "");
}

export function versionChangelogContent(content: string, version: string, date: string): string {
	const unreleasedHasContent = hasUnreleasedContent(content);
	const withoutStaleEmptyVersions = removeEmptyVersionEntries(content);
	const versionHeading = `## [${version}] - ${date}`;

	if (withoutStaleEmptyVersions.includes(versionHeading)) {
		return withoutStaleEmptyVersions;
	}

	if (unreleasedHasContent) {
		const versioned = withoutStaleEmptyVersions.replace("## [Unreleased]", versionHeading);
		return versioned.replace(/^(# Changelog\n\n)/, "$1## [Unreleased]\n\n");
	}

	return withoutStaleEmptyVersions.replace("## [Unreleased]", `## [Unreleased]\n\n${versionHeading}`);
}
