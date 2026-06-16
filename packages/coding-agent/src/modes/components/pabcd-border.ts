const PHASE_HUES: Record<string, number> = {
	i: 200,
	p: 240,
	a: 45,
	b: 150,
	c: 290,
	d: 0,
};

const PHASE_IS_ACHROMATIC = new Set(["d"]);
const SATURATION = 100;
const WAVE_LIGHTNESS = 60;
const HUE_SWING = 20;
const CYCLE_MS = 3000;
const FRAME_MS = 100;
const LABEL_LIGHTNESS = 80;

function hslToAnsi(h: number, s: number, l: number): string {
	const c = ((1 - Math.abs((2 * l) / 100 - 1)) * s) / 100;
	const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
	const m = l / 100 - c / 2;
	let r = 0,
		g = 0,
		b = 0;
	if (h < 60) {
		r = c;
		g = x;
	} else if (h < 120) {
		r = x;
		g = c;
	} else if (h < 180) {
		g = c;
		b = x;
	} else if (h < 240) {
		g = x;
		b = c;
	} else if (h < 300) {
		r = x;
		b = c;
	} else {
		r = c;
		b = x;
	}
	const ri = Math.round((r + m) * 255);
	const gi = Math.round((g + m) * 255);
	const bi = Math.round((b + m) * 255);
	return `\x1b[38;2;${ri};${gi};${bi}m`;
}

function waveHue(baseHue: number, timeMs: number): number {
	const t = (timeMs % CYCLE_MS) / CYCLE_MS;
	const offset = Math.sin(t * 2 * Math.PI) * HUE_SWING;
	return (baseHue + offset + 360) % 360;
}

export function getPabcdBorderColor(phase: string): (str: string) => string {
	const normalized = phase.toLowerCase();
	if (PHASE_IS_ACHROMATIC.has(normalized)) {
		const v = 180 + Math.round(Math.sin(((Date.now() % CYCLE_MS) / CYCLE_MS) * 2 * Math.PI) * 40);
		return (str: string) => `\x1b[38;2;${v};${v};${v}m${str}\x1b[39m`;
	}
	const baseHue = PHASE_HUES[normalized];
	if (baseHue === undefined) return (str: string) => str;
	const hue = waveHue(baseHue, Date.now());
	const ansi = hslToAnsi(hue, SATURATION, WAVE_LIGHTNESS);
	return (str: string) => `${ansi}${str}\x1b[39m`;
}

export interface PabcdBorderHandle {
	stop(): void;
}

export function createPabcdBorderCycle(invalidate: () => void): PabcdBorderHandle {
	const timer = setInterval(invalidate, FRAME_MS);
	return {
		stop() {
			clearInterval(timer);
		},
	};
}

export function getPabcdPhaseAnsi(phase: string): string {
	const normalized = phase.toLowerCase();
	if (PHASE_IS_ACHROMATIC.has(normalized)) return "\x1b[97m";
	const hue = PHASE_HUES[normalized];
	if (hue === undefined) return "";
	return hslToAnsi(hue, SATURATION, LABEL_LIGHTNESS);
}

export function colorPabcdLabel(phase: string, text: string): string {
	const ansi = getPabcdPhaseAnsi(phase);
	return ansi ? `${ansi}${text}\x1b[39m` : text;
}

export function isPabcdPhase(phase: string | undefined): boolean {
	if (!phase) return false;
	return phase.toLowerCase() in PHASE_HUES;
}
