import {
	getImageDimensions,
	type ImageDimensions,
	ImageProtocol,
	imageFallback,
	kittyImageId,
	renderImage,
	TERMINAL,
} from "../terminal-capabilities";
import type { Component } from "../tui";

let nextPlacementId = 1;

function allocatePlacementId(): number {
	const id = nextPlacementId;
	nextPlacementId = nextPlacementId >= 0x7fffffff ? 1 : nextPlacementId + 1;
	return id;
}

export interface ImageTheme {
	fallbackColor: (str: string) => string;
}

export interface ImageOptions {
	maxWidthCells?: number;
	maxHeightCells?: number;
	filename?: string;
}

export class Image implements Component {
	#base64Data: string;
	#mimeType: string;
	#dimensions: ImageDimensions;
	#theme: ImageTheme;
	#options: ImageOptions;

	#cachedLines?: string[];
	#cachedWidth?: number;
	#kittyImageId?: number;
	readonly #kittyPlacementId = allocatePlacementId();

	constructor(
		base64Data: string,
		mimeType: string,
		theme: ImageTheme,
		options: ImageOptions = {},
		dimensions?: ImageDimensions,
	) {
		this.#base64Data = base64Data;
		this.#mimeType = mimeType;
		this.#theme = theme;
		this.#options = options;
		this.#dimensions = dimensions || getImageDimensions(base64Data, mimeType) || { widthPx: 800, heightPx: 600 };
	}

	invalidate(): void {
		this.#cachedLines = undefined;
		this.#cachedWidth = undefined;
	}

	render(width: number): string[] {
		if (this.#cachedLines && this.#cachedWidth === width) {
			return this.#cachedLines;
		}

		const cap = this.#options.maxWidthCells;
		const maxWidth = cap != null && cap > 0 ? Math.min(width - 2, cap) : width - 2;

		let lines: string[];

		if (TERMINAL.imageProtocol) {
			if (TERMINAL.imageProtocol === ImageProtocol.Kitty) {
				this.#kittyImageId ??= kittyImageId(this.#base64Data);
			}
			const result = renderImage(this.#base64Data, this.#dimensions, {
				maxWidthCells: maxWidth,
				maxHeightCells: this.#options.maxHeightCells,
				imageId: this.#kittyImageId,
				placementId: this.#kittyPlacementId,
			});

			if (result) {
				if (result.cursorNeutral) {
					// Kitty placements anchor to the first reserved row and are safe to replay.
					lines = [result.sequence];
					for (let i = 0; i < result.rows - 1; i++) lines.push("");
				} else {
					// Cursor-advancing protocols draw from the last reserved row.
					lines = [];
					for (let i = 0; i < result.rows - 1; i++) lines.push("");
					const moveUp = result.rows > 1 ? `\x1b[${result.rows - 1}A` : "";
					lines.push(moveUp + result.sequence);
				}
			} else {
				const fallback = imageFallback(this.#mimeType, this.#dimensions, this.#options.filename);
				lines = [this.#theme.fallbackColor(fallback)];
			}
		} else {
			const fallback = imageFallback(this.#mimeType, this.#dimensions, this.#options.filename);
			lines = [this.#theme.fallbackColor(fallback)];
		}

		this.#cachedLines = lines;
		this.#cachedWidth = width;

		return lines;
	}
}
