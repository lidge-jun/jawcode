/**
 * Voice input must work on Linux boxes that do not run PulseAudio.
 *
 * The ffmpeg recorder hardcoded `-f pulse -i default` for every non-Windows,
 * non-macOS platform. PipeWire is the default on current Fedora and Ubuntu,
 * and a PipeWire-only system has no `pulse` input device at all — ffmpeg exits
 * immediately and voice input fails with a raw ffmpeg error rather than
 * anything actionable. Minimal systems with only ALSA fail the same way.
 *
 * The selection is driven by `ffmpeg -devices`, which reports the devices
 * compiled into the binary without opening audio hardware.
 */
import { describe, expect, it } from "bun:test";

const RECORDER_SOURCE = new URL("../src/stt/recorder.ts", import.meta.url).pathname;

describe("linux ffmpeg audio input selection", () => {
	it("prefers pipewire, then pulse, then alsa", async () => {
		const source = await Bun.file(RECORDER_SOURCE).text();
		const listLine = source.split("\n").find(line => line.includes("LINUX_FFMPEG_INPUTS ="));

		expect(listLine).toBeDefined();
		// Order is the contract: pulse must not come first, or a PipeWire box
		// picks the backend it does not have.
		expect(listLine).toContain('["pipewire", "pulse", "alsa"]');
	});

	it("no longer hardcodes the pulse input format", async () => {
		const source = await Bun.file(RECORDER_SOURCE).text();
		const args = source.slice(source.indexOf("const linuxInput = await detectLinuxAudioInput();"));
		const ffmpegArgs = args.slice(0, args.indexOf("];"));

		expect(ffmpegArgs).toContain("linuxInput.format");
		expect(ffmpegArgs).not.toContain('"pulse"');
	});

	it("falls back to pulse when the probe yields nothing", async () => {
		// Preserving the historical default on probe failure is what makes this
		// change unable to break a system that works today.
		const source = await Bun.file(RECORDER_SOURCE).text();
		const fallback = source.split("\n").find(line => line.includes("const format = supported ??"));

		expect(fallback).toBeDefined();
		expect(fallback).toContain('"pulse"');
	});

	it("leaves the macOS and Windows backends alone", async () => {
		const source = await Bun.file(RECORDER_SOURCE).text();

		expect(source).toContain('"avfoundation"');
		expect(source).toContain('"dshow"');
	});
});
/** Mirrors `detectLinuxAudioInput`'s selection over `ffmpeg -devices` output. */
function selectFormat(devicesOutput: string): string {
	const order = ["pipewire", "pulse", "alsa"] as const;
	return order.find(format => new RegExp(`\\b${format}\\b`).test(devicesOutput)) ?? "pulse";
}

describe("linux audio backend selection over real ffmpeg -devices output", () => {
	it("picks pipewire on a PipeWire-only box", () => {
		// A PipeWire-only system genuinely has no `pulse` device line.
		const devices = [
			"Devices:",
			" D  lavfi           Libavfilter virtual input device",
			" D  pipewire        PipeWire input device",
		].join("\n");
		expect(selectFormat(devices)).toBe("pipewire");
	});

	it("picks alsa when it is the only audio backend present", () => {
		const devices = [
			"Devices:",
			" D  alsa            ALSA audio input",
			" D  lavfi           Libavfilter virtual input device",
		].join("\n");
		expect(selectFormat(devices)).toBe("alsa");
	});

	it("prefers pipewire when both it and pulse are available", () => {
		const devices = [" D  alsa   ALSA audio input", " D  pipewire   PipeWire", " D  pulse   Pulse audio input"].join(
			"\n",
		);
		expect(selectFormat(devices)).toBe("pipewire");
	});

	it("falls back to pulse for empty or unreadable probe output", () => {
		expect(selectFormat("")).toBe("pulse");
		expect(selectFormat("ffmpeg: command not found")).toBe("pulse");
	});

	it("does not match a backend name embedded in another word", () => {
		// Word boundaries matter: `pulseaudio-utils` in a description must not
		// count as the `pulse` device being present.
		expect(selectFormat(" D  alsa  ALSA input (see pulseaudio-utils)")).toBe("alsa");
	});
});
