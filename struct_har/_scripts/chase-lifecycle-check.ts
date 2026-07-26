/**
 * Verify chase-card status, placement, and index links.
 * Run: bun struct_har/_scripts/chase-lifecycle-check.ts
 */
import * as fs from "node:fs/promises";
import * as path from "node:path";

const ROOT = path.resolve(import.meta.dir, "../..");
const CHASE = path.join(ROOT, "struct_har/chase");
const CARD_NAME = /^(10|20)\.\d{3}[a-z]?_.+\.md$/;
const CARD_ID = /(?:^|[^\d])(10|20)\.\d{3}[a-z]?(?=[^\da-z]|$)/i;
const LINK = /\[[^\]]*\]\(([^)]+)\)/g;
const STATUS_FILES = [
	"10_gjc_chase_MOC.md",
	"20_omp_chase_MOC.md",
	"007_follow_index.md",
	"009_follow_tiers.md",
] as const;

type Location = "active" | "archived";
type ClaimedStatus = Location;
type Card = { id: string; location: Location; relativePath: string };
type Claim = { file: string; line: number; status: ClaimedStatus };
type ViolationKind = "duplicate-id" | "broken-link" | "missing-moc-row" | "status-location-mismatch";
type Violation = { kind: ViolationKind; message: string };

function cardId(value: string): string | undefined {
	return value.match(CARD_ID)?.[0].replace(/^[^\d]+/, "").toLowerCase();
}

async function listCards(directory: string, location: Location): Promise<Card[]> {
	const entries = await fs.readdir(directory, { withFileTypes: true });
	return entries
		.filter(entry => entry.isFile() && CARD_NAME.test(entry.name))
		.map(entry => ({
			id: cardId(entry.name) as string,
			location,
			relativePath: path.relative(ROOT, path.join(directory, entry.name)),
		}));
}

function lineStatus(line: string): ClaimedStatus | undefined {
	if (line.includes("✅")) return "archived";
	if (line.includes("⬜") || line.includes("🟡")) return "active";
	if (/(?:^|\W)_fin(?:\W|$)/i.test(line)) return "archived";
	return undefined;
}

function displayLocation(file: string, line: number): string {
	return `${file}:${line}`;
}

const cards = [
	...(await listCards(CHASE, "active")),
	...(await listCards(path.join(CHASE, "_fin/10"), "archived")),
	...(await listCards(path.join(CHASE, "_fin/20"), "archived")),
];
const violations: Violation[] = [];
const cardsById = new Map<string, Card[]>();

for (const card of cards) {
	const matches = cardsById.get(card.id) ?? [];
	matches.push(card);
	cardsById.set(card.id, matches);
}

for (const [id, matches] of cardsById) {
	const locations = new Set(matches.map(card => card.location));
	if (locations.size > 1) {
		violations.push({
			kind: "duplicate-id",
			message: `${id}: ${matches.map(card => card.relativePath).join(", ")}`,
		});
	}
}

const claimsById = new Map<string, Claim[]>();
const owningMocIds = new Map<"10" | "20", Set<string>>([
	["10", new Set<string>()],
	["20", new Set<string>()],
]);

for (const statusFile of STATUS_FILES) {
	const absoluteFile = path.join(CHASE, statusFile);
	const relativeFile = path.relative(ROOT, absoluteFile);
	const lines = (await Bun.file(absoluteFile).text()).split(/\r?\n/);
	for (const [index, line] of lines.entries()) {
		const lineNumber = index + 1;
		const status = lineStatus(line);
		for (const match of line.matchAll(LINK)) {
			const rawTarget = match[1]?.split("#", 1)[0]?.split("?", 1)[0];
			if (!rawTarget || /^(?:[a-z]+:|#)/i.test(rawTarget)) continue;
			const decodedTarget = decodeURIComponent(rawTarget);
			const targetId = cardId(decodedTarget);
			if (!targetId) continue;
			const target = path.resolve(path.dirname(absoluteFile), decodedTarget);
			try {
				await fs.access(target);
			} catch {
				violations.push({
					kind: "broken-link",
					message: `${displayLocation(relativeFile, lineNumber)}: ${rawTarget}`,
				});
			}
			if (status) {
				const claims = claimsById.get(targetId) ?? [];
				claims.push({ file: relativeFile, line: lineNumber, status });
				claimsById.set(targetId, claims);
			}
			if (statusFile.startsWith(`${targetId.slice(0, 2)}_`)) {
				owningMocIds.get(targetId.slice(0, 2) as "10" | "20")?.add(targetId);
			}
		}
	}
}

for (const [id, matches] of cardsById) {
	const owner = id.slice(0, 2) as "10" | "20";
	if (!owningMocIds.get(owner)?.has(id)) {
		violations.push({
			kind: "missing-moc-row",
			message: `${id}: no linked row in struct_har/chase/${owner}_${owner === "10" ? "gjc" : "omp"}_chase_MOC.md`,
		});
	}
	for (const claim of claimsById.get(id) ?? []) {
		for (const card of matches) {
			if (claim.status !== card.location) {
				violations.push({
					kind: "status-location-mismatch",
					message: `${displayLocation(claim.file, claim.line)}: ${id} claims ${claim.status}, located ${card.location} at ${card.relativePath}`,
				});
			}
		}
	}
}

const kinds: ViolationKind[] = ["status-location-mismatch", "duplicate-id", "broken-link", "missing-moc-row"];
for (const kind of kinds) {
	const grouped = violations.filter(violation => violation.kind === kind);
	if (grouped.length === 0) continue;
	console.log(`\n${kind} (${grouped.length})`);
	for (const violation of grouped) console.log(`- ${violation.message}`);
}

console.log(
	`chase lifecycle: ${violations.length === 0 ? "PASS" : "FAIL"} — ${cardsById.size} card ids, ${violations.length} violations`,
);
process.exitCode = violations.length === 0 ? 0 : 1;
