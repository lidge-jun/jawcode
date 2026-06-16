import type { ScreenshotMeta, SessionState } from "./session.js";

export interface ResolvedCoord {
	x: number;
	y: number;
}

/**
 * Resolve coordinates from the agent's coordinate space to display point coords.
 *
 * - "pixels": the agent sends screenshot-pixel coordinates.
 *   We scale them to display points using the ratio between screenshot
 *   dimensions and the display's point dimensions, then offset by the
 *   display origin.
 *
 * - "normalized_0_100": the agent sends percentages (0–100) of the
 *   display dimensions.
 *
 * Falls back to raw values when no screenshot has been taken yet.
 */
export function resolveCoordinate(x: number, y: number, state: SessionState): ResolvedCoord {
	const { coordinateMode, lastScreenshot } = state;

	if (coordinateMode === "normalized_0_100") {
		return resolveNormalized(x, y, lastScreenshot);
	}

	// "pixels" mode
	return resolvePixels(x, y, lastScreenshot);
}

export const resolveCoordinates = resolveCoordinate;

function resolvePixels(x: number, y: number, meta: ScreenshotMeta | null): ResolvedCoord {
	if (!meta) {
		// No screenshot taken yet — pass through raw values
		return { x, y };
	}

	const scaleX = meta.displayWidth / meta.width;
	const scaleY = meta.displayHeight / meta.height;

	return {
		x: meta.originX + x * scaleX,
		y: meta.originY + y * scaleY,
	};
}

function resolveNormalized(x: number, y: number, meta: ScreenshotMeta | null): ResolvedCoord {
	if (!meta) {
		// Without display info, treat percentages as raw (best-effort)
		return { x, y };
	}

	return {
		x: meta.originX + (x / 100) * meta.displayWidth,
		y: meta.originY + (y / 100) * meta.displayHeight,
	};
}
