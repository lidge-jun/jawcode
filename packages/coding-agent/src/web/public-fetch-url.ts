import { ToolError } from "../tools/tool-errors";

const BLOCKED_PUBLIC_FETCH_URL_MESSAGE = "Blocked URL: private or local network targets are not allowed";

function normalizePublicFetchUrl(url: string): string {
	if (!/^https?:\/\//i.test(url)) {
		return `https://${url}`;
	}
	return url;
}

function normalizedHost(parsed: URL): string {
	return parsed.hostname.replace(/^\[|\]$/g, "").toLowerCase();
}

function ipv4Octets(host: string): number[] | null {
	const parts = host.split(".");
	if (parts.length !== 4) return null;
	const octets = parts.map(part => {
		if (!/^\d+$/.test(part)) return Number.NaN;
		return Number.parseInt(part, 10);
	});
	if (octets.some(octet => !Number.isInteger(octet) || octet < 0 || octet > 255)) return null;
	return octets;
}

function isBlockedIpv4(host: string): boolean {
	const octets = ipv4Octets(host);
	if (!octets) return false;
	const [first, second] = octets;
	if (first === 0) return true;
	if (first === 10) return true;
	if (first === 127) return true;
	if (first === 169 && second === 254) return true;
	if (first === 172 && second >= 16 && second <= 31) return true;
	return first === 192 && second === 168;
}

function isBlockedIpv6(host: string): boolean {
	const lower = host.toLowerCase();
	if (lower === "::1" || lower === "0:0:0:0:0:0:0:1") return true;
	if (lower.startsWith("fe80:")) return true;
	if (/^f[cd][0-9a-f]{2}:/i.test(lower)) return true;

	const mapped = lower.match(/^(?:::ffff:)?(\d{1,3}(?:\.\d{1,3}){3})$/);
	return mapped ? isBlockedIpv4(mapped[1]!) : false;
}

function isBlockedHost(host: string): boolean {
	if (host === "localhost" || host.endsWith(".localhost")) return true;
	if (isBlockedIpv4(host)) return true;
	return isBlockedIpv6(host);
}

export function assertPublicFetchUrl(url: string): string {
	const normalized = normalizePublicFetchUrl(url);
	let parsed: URL;
	try {
		parsed = new URL(normalized);
	} catch {
		throw new ToolError("Invalid URL");
	}

	if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
		throw new ToolError("Only http(s) URLs are allowed");
	}
	if (parsed.username || parsed.password) {
		throw new ToolError("URL credentials are not allowed");
	}
	if (isBlockedHost(normalizedHost(parsed))) {
		throw new ToolError(BLOCKED_PUBLIC_FETCH_URL_MESSAGE);
	}
	return parsed.href;
}
