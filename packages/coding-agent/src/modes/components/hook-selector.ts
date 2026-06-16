/**
 * Generic selector component for hooks.
 * Displays a list of string options with keyboard navigation.
 */
import {
	Container,
	CURSOR_MARKER,
	Editor,
	Markdown,
	matchesKey,
	padding,
	renderInlineMarkdown,
	replaceTabs,
	Spacer,
	Text,
	type TUI,
	truncateToWidth,
	visibleWidth,
	wrapTextWithAnsi,
} from "@gajae-code/tui";
import { getEditorTheme, getMarkdownTheme, theme } from "../../modes/theme/theme";
import {
	matchesAppExternalEditor,
	matchesAppInterrupt,
	matchesSelectCancel,
} from "../../modes/utils/keybinding-matchers";
import { getEditorCommand, openInEditor } from "../../utils/external-editor";
import { createAskOutputPanelEditor } from "./composer-chrome";
import { CountdownTimer } from "./countdown-timer";
import type { CustomEditor } from "./custom-editor";
import { DynamicBorder } from "./dynamic-border";

const SGR_MOUSE_PRESS_PATTERN = /^\x1b\[<(\d+);\d+;\d+M$/;
const MOUSE_WHEEL_TITLE_SCROLL_ROWS = 3;

function getMouseWheelTitleScrollRows(keyData: string): number {
	const match = SGR_MOUSE_PRESS_PATTERN.exec(keyData);
	if (!match) return 0;

	const button = Number.parseInt(match[1] ?? "", 10);
	if (!Number.isFinite(button) || (button & 64) === 0) return 0;

	const wheelDirection = button & 3;
	if (wheelDirection === 0) return -MOUSE_WHEEL_TITLE_SCROLL_ROWS;
	if (wheelDirection === 1) return MOUSE_WHEEL_TITLE_SCROLL_ROWS;
	return 0;
}

export interface HookSelectorOptions {
	tui?: TUI;
	timeout?: number;
	onTimeout?: () => void;
	initialIndex?: number;
	outline?: boolean;
	maxVisible?: number;
	onLeft?: () => void;
	onRight?: () => void;
	onExternalEditor?: () => void;
	helpText?: string;
	/**
	 * When true, the focused option's label wraps across multiple rows so the
	 * full text is visible. Non-focused options remain single-row with the
	 * existing `…` truncation hint. When unset/false, rendering is
	 * byte-identical to the previous implementation for all consumers.
	 */
	wrapFocused?: boolean;
	scrollTitleRows?: number;
	/**
	 * Inline free-text entry for the option with this label (e.g. the ask
	 * tool's "Other (type your own)"). Selecting it keeps the title and option
	 * list on screen and opens a prompt-style editor below the list instead of
	 * replacing the whole selector. Enter submits via `onSubmit`; Escape
	 * returns to option selection.
	 */
	customInput?: {
		optionLabel: string;
		onSubmit: (text: string) => void;
	};
	/**
	 * When true, show a free-text editor below the option list from the start (no
	 * separate "Other" list row). Use with `dockedCustomInput`.
	 */
	customInputDocked?: boolean;
	/** Free-text input mounted under the list when `customInputDocked` is true. */
	dockedCustomInput?: {
		label?: string;
		prompt?: string;
		onSubmit: (text: string) => void;
	};
	/**
	 * v2 interview UX (082.3): last list index is a free-text slot; ↑↓ includes it.
	 * Editor uses composer chrome; shown in `#inputArea` only while the slot is focused.
	 */
	customInputListSlot?: boolean;
	/** Handler for `customInputListSlot` (same contract as `dockedCustomInput.onSubmit`). */
	listSlotCustomInput?: {
		label?: string;
		onSubmit: (text: string) => void;
	};
}

/**
 * Pad/truncate one outline content row to `innerWidth`, measuring without the
 * zero-width cursor marker the embedded slot editor emits — `Bun.stringWidth`
 * counts the APC payload (`\x1b_pi:c\x07`) as 5 visible columns, which used to
 * shave real columns off the editor row and append a spurious "…" before the
 * right border.
 */
/**
 * Box chrome for the selector outline. Corners join the horizontal and
 * vertical strokes into one connected box (matching the composer's closed
 * border box) — corner-less full-width rules read as three detached lines
 * in most terminal fonts.
 */
function outlineBoxChrome(innerWidth: number): { top: string; bottom: string; vertical: string } {
	const borderColor = (text: string) => theme.fg("border", text);
	const h = theme.boxSharp.horizontal.repeat(innerWidth);
	return {
		top: borderColor(`${theme.boxSharp.topLeft}${h}${theme.boxSharp.topRight}`),
		bottom: borderColor(`${theme.boxSharp.bottomLeft}${h}${theme.boxSharp.bottomRight}`),
		vertical: borderColor(theme.boxSharp.vertical),
	};
}

function fitOutlineRow(line: string, innerWidth: number): string {
	const normalized = replaceTabs(line);
	const markerFree = normalized.includes(CURSOR_MARKER) ? normalized.replaceAll(CURSOR_MARKER, "") : normalized;
	const width = visibleWidth(markerFree);
	if (width <= innerWidth) return normalized + padding(innerWidth - width);
	return truncateToWidth(markerFree, innerWidth);
}

class OutlinedList extends Container {
	#lines: string[] = [];
	#footerLines: string[] = [];

	setLines(lines: string[], footerLines: string[] = []): void {
		this.#lines = lines;
		this.#footerLines = footerLines;
		this.invalidate();
	}

	render(width: number): string[] {
		const innerWidth = Math.max(1, width - 2);
		const { top, bottom, vertical } = outlineBoxChrome(innerWidth);
		const all = [...this.#lines, ...this.#footerLines];
		const content = all.map(line => `${vertical}${fitOutlineRow(line, innerWidth)}${vertical}`);
		return [top, ...content, bottom];
	}
}

class ScrollableTitle extends Container {
	#markdown: Markdown;
	#maxRows: number;
	#scrollOffset = 0;
	#lastMaxScrollOffset = 0;

	constructor(title: string, maxRows: number) {
		super();
		this.#maxRows = Math.max(1, Math.floor(maxRows));
		this.#markdown = new Markdown(title, 1, 0, getMarkdownTheme(), { color: t => theme.fg("accent", t) });
	}

	setText(text: string): void {
		this.#markdown.setText(text);
		this.#scrollOffset = 0;
		this.invalidate();
	}

	scrollBy(rows: number): void {
		if (rows === 0) return;
		const nextOffset = Math.max(0, Math.min(this.#lastMaxScrollOffset, this.#scrollOffset + rows));
		if (nextOffset === this.#scrollOffset) return;
		this.#scrollOffset = nextOffset;
		this.invalidate();
	}

	render(width: number): string[] {
		const lines = this.#markdown.render(width);
		const maxScrollOffset = Math.max(0, lines.length - this.#maxRows);
		this.#lastMaxScrollOffset = maxScrollOffset;
		this.#scrollOffset = Math.max(0, Math.min(this.#scrollOffset, maxScrollOffset));

		const visibleLines = lines.slice(this.#scrollOffset, this.#scrollOffset + this.#maxRows);
		if (maxScrollOffset === 0 || visibleLines.length === 0) {
			return visibleLines;
		}

		const indicator =
			this.#scrollOffset === 0
				? theme.fg("dim", " PgDn↓")
				: this.#scrollOffset >= maxScrollOffset
					? theme.fg("dim", " PgUp↑")
					: theme.fg("dim", " PgUp/PgDn↕");
		const lastIndex = visibleLines.length - 1;
		const availableWidth = Math.max(1, width - visibleWidth(indicator));
		const fittedLine = truncateToWidth(visibleLines[lastIndex] ?? "", availableWidth);
		visibleLines[lastIndex] = `${fittedLine}${indicator}`;
		return visibleLines;
	}
}

/**
 * Width-aware list child that owns wrapped focused-option layout.
 *
 * Single layout owner for the `wrapFocused` branch: row budgeting, sibling
 * selection, marker placement, and finalized row construction all happen
 * inside `render(width)` using the actual incoming width. The outer host
 * (`HookSelectorComponent`) feeds it `options`, `selectedIndex`, and
 * `maxVisibleRows`; everything that depends on terminal width is recomputed
 * on each render so resize Just Works.
 *
 * `maxVisibleRows` is a hard viewport budget for every rendered option-list
 * row. Surrounding options shrink first; if the focused option alone would
 * exceed the remaining budget, it is compacted to contextual rows plus an
 * omitted-rows marker so controls stay reachable for untrusted long labels.
 */
class FocusAwareList extends Container {
	#options: string[] = [];
	#selectedIndex = 0;
	#maxVisibleRows = 0;
	#outline: boolean;

	constructor(outline: boolean) {
		super();
		this.#outline = outline;
	}

	#footerLines: string[] = [];

	#slotFocused = false;

	setState(
		options: string[],
		selectedIndex: number,
		maxVisibleRows: number,
		footerLines: string[] = [],
		slotFocused = false,
	): void {
		this.#options = options;
		this.#footerLines = footerLines;
		// While the list-slot input owns focus, `selectedIndex` is only a scroll
		// anchor — no option row may render as selected (the slot heading carries
		// the cursor instead).
		this.#slotFocused = slotFocused;
		const maxIndex = Math.max(0, options.length - 1);
		this.#selectedIndex = Math.max(0, Math.min(selectedIndex, maxIndex));
		this.#maxVisibleRows = Math.max(1, maxVisibleRows);
		this.invalidate();
	}

	render(width: number): string[] {
		if (this.#options.length === 0) return this.#outline ? this.#wrapOutline([], width) : [];

		const mdTheme = getMarkdownTheme();
		const innerWidth = this.#outline ? Math.max(1, width - 2) : Math.max(1, width);

		// Selected/non-selected prefixes mirror the legacy `#updateList` shape.
		// With slot focus the anchor row renders like any sibling.
		const styledSelectedPrefix = this.#slotFocused ? "  " : theme.fg("accent", `${theme.nav.cursor} `);
		const nonSelectedPrefix = "  ";
		const prefixWidth = visibleWidth(styledSelectedPrefix);
		const continuationPrefix = " ".repeat(prefixWidth);
		const availableLabelWidth = Math.max(1, innerWidth - prefixWidth);

		// Render the focused label up front so we can measure how many rows it
		// will consume at the current width and budget siblings accordingly.
		const focusedRaw = this.#options[this.#selectedIndex] ?? "";
		const focusedColor = this.#slotFocused ? ("text" as const) : ("accent" as const);
		const focusedLabel = renderInlineMarkdown(focusedRaw, mdTheme, t => theme.fg(focusedColor, t));
		const focusedWrappedSegments = wrapTextWithAnsi(focusedLabel, availableLabelWidth);

		// Reserve one row for the option position marker only when the focused
		// block itself must be compacted. Moderate focused labels keep the legacy
		// wrap-focused behavior and spend the full viewport on label context.
		const totalOptions = this.#options.length;
		const totalItems = totalOptions;
		const mustCompactFocused = focusedWrappedSegments.length > this.#maxVisibleRows;
		const positionMarkerSlot = mustCompactFocused && totalOptions > 1 ? 1 : 0;
		const focusedBudget = Math.max(1, this.#maxVisibleRows - positionMarkerSlot);
		const focusedSegments = this.#capFocusedSegments(focusedWrappedSegments, focusedBudget, availableLabelWidth);
		const focusedRows = Math.max(1, focusedSegments.length);

		// Sibling budget. If the focused block consumes the available viewport,
		// render it with zero siblings and the reserved position marker.
		const siblingBudget = Math.max(0, this.#maxVisibleRows - focusedRows - positionMarkerSlot);

		// Distribute sibling slots around focus, preferring closest options.
		const availableAbove = this.#selectedIndex;
		const availableBelow = totalItems - this.#selectedIndex - 1;
		let above = Math.min(availableAbove, Math.floor(siblingBudget / 2));
		let below = Math.min(availableBelow, siblingBudget - above);
		// Transfer unused quota across the focus when one side has fewer
		// options than its share.
		const unusedBelow = siblingBudget - above - below;
		if (unusedBelow > 0) above = Math.min(availableAbove, above + unusedBelow);
		const unusedAbove = siblingBudget - above - below;
		if (unusedAbove > 0) below = Math.min(availableBelow, below + unusedAbove);

		const startIndex = this.#selectedIndex - above;
		const endIndex = this.#selectedIndex + below + 1;
		const showMarker = startIndex > 0 || endIndex < totalItems;

		const rows: string[] = [];
		for (let i = startIndex; i < endIndex; i++) {
			if (i === this.#selectedIndex) {
				for (let r = 0; r < focusedSegments.length; r++) {
					const segment = focusedSegments[r] ?? "";
					rows.push(r === 0 ? styledSelectedPrefix + segment : continuationPrefix + segment);
				}
			} else {
				const label = renderInlineMarkdown(this.#options[i] ?? "", mdTheme, t => theme.fg("text", t));
				const fittedLabel = truncateToWidth(label, availableLabelWidth);
				rows.push(nonSelectedPrefix + fittedLabel);
			}
		}

		if (showMarker && rows.length < this.#maxVisibleRows) {
			rows.push(theme.fg("dim", `  (${this.#selectedIndex + 1}/${totalItems})`));
		}

		if (this.#footerLines.length > 0) {
			rows.push(...this.#footerLines);
		}

		return this.#outline ? this.#wrapOutline(rows, width) : rows;
	}

	#capFocusedSegments(segments: string[], maxRows: number, availableLabelWidth: number): string[] {
		const rows = segments.length > 0 ? segments : [""];
		const budget = Math.max(1, Math.floor(maxRows));
		if (rows.length <= budget) return rows;

		if (budget === 1) {
			return [truncateToWidth(`… ${rows.length - 1} wrapped rows omitted …`, availableLabelWidth)];
		}

		if (budget === 2) {
			return [rows[0] ?? "", truncateToWidth(`… ${rows.length - 1} wrapped rows omitted …`, availableLabelWidth)];
		}

		const tailRows = Math.max(1, Math.floor((budget - 2) / 2));
		const headRows = Math.max(1, budget - 1 - tailRows);
		const omittedRows = Math.max(1, rows.length - headRows - tailRows);
		const marker = truncateToWidth(`… ${omittedRows} wrapped rows omitted …`, availableLabelWidth);
		return [...rows.slice(0, headRows), marker, ...rows.slice(rows.length - tailRows)];
	}

	#wrapOutline(rows: string[], width: number): string[] {
		// Mirror the outline border drawn by `OutlinedList.render(width)`. The
		// rows passed in are already constrained to `innerWidth` by
		// `wrapTextWithAnsi`, so we only normalize tabs and pad — no further
		// truncation, which would clip wrapped focused labels.
		const innerWidth = Math.max(1, width - 2);
		const { top, bottom, vertical } = outlineBoxChrome(innerWidth);
		const content = rows.map(line => `${vertical}${fitOutlineRow(line, innerWidth)}${vertical}`);
		return [top, ...content, bottom];
	}
}

export class HookSelectorComponent extends Container {
	#options: string[];
	#selectedIndex: number;
	#maxVisible: number;
	#listContainer: Container | undefined;
	#outlinedList: OutlinedList | undefined;
	#focusAwareList: FocusAwareList | undefined;
	#onSelectCallback: (option: string) => void;
	#onCancelCallback: () => void;
	#titleComponent: Markdown | ScrollableTitle;
	#scrollableTitle: ScrollableTitle | undefined;
	#baseTitle: string;
	#countdown: CountdownTimer | undefined;
	#onLeftCallback: (() => void) | undefined;
	#onRightCallback: (() => void) | undefined;
	#onExternalEditorCallback: (() => void) | undefined;
	#wrapFocused: boolean;
	#outline: boolean;
	#scrollTitleRows: number | undefined;
	#customInput: { optionLabel: string; onSubmit: (text: string) => void } | undefined;
	#customInputDocked: boolean;
	#dockedCustomInput: { label?: string; prompt?: string; onSubmit: (text: string) => void } | undefined;
	#customInputListSlot: boolean;
	#listSlotCustomInput: { label?: string; onSubmit: (text: string) => void } | undefined;
	#listSlotEditor: CustomEditor | undefined;
	#outputFooterLines: string[] = [];
	#inputArea: Container;
	#inlineEditor: Editor | undefined;
	#editorFocused: boolean;
	#helpTextComponent: Text;
	#baseHelpText: string;
	#tui: TUI | undefined;
	constructor(
		title: string,
		options: string[],
		onSelect: (option: string) => void,
		onCancel: () => void,
		opts?: HookSelectorOptions,
	) {
		super();

		this.#options = options;
		const listSlot = opts?.customInputListSlot === true;
		const maxInit = listSlot ? options.length : Math.max(0, options.length - 1);
		this.#selectedIndex = Math.min(opts?.initialIndex ?? 0, maxInit);
		this.#maxVisible = Math.max(3, opts?.maxVisible ?? 12);
		this.#onSelectCallback = onSelect;
		this.#onCancelCallback = onCancel;
		this.#baseTitle = title;
		this.#onLeftCallback = opts?.onLeft;
		this.#onRightCallback = opts?.onRight;
		this.#onExternalEditorCallback = opts?.onExternalEditor;
		this.#wrapFocused = opts?.wrapFocused === true;
		this.#outline = opts?.outline === true;
		this.#customInput = opts?.customInput;
		this.#customInputDocked = opts?.customInputDocked === true;
		this.#dockedCustomInput = opts?.dockedCustomInput;
		this.#customInputListSlot = opts?.customInputListSlot === true;
		this.#listSlotCustomInput = opts?.listSlotCustomInput;
		this.#listSlotEditor = undefined;
		this.#editorFocused = false;
		this.#tui = opts?.tui;

		this.addChild(new DynamicBorder());
		this.addChild(new Spacer(1));

		const scrollTitleRows =
			opts?.scrollTitleRows === undefined ? undefined : Math.max(1, Math.floor(opts.scrollTitleRows));
		this.#scrollTitleRows = scrollTitleRows;
		if (scrollTitleRows === undefined) {
			this.#titleComponent = new Markdown(title, 1, 0, getMarkdownTheme(), { color: t => theme.fg("accent", t) });
		} else {
			this.#scrollableTitle = new ScrollableTitle(title, scrollTitleRows);
			this.#titleComponent = this.#scrollableTitle;
		}
		this.addChild(this.#titleComponent);
		this.addChild(new Spacer(1));

		if (opts?.timeout && opts.timeout > 0 && opts.tui) {
			this.#countdown = new CountdownTimer(
				opts.timeout,
				opts.tui,
				s => this.#titleComponent.setText(`${this.#baseTitle} (${s}s)`),
				() => {
					opts?.onTimeout?.();
					// Auto-select current option on timeout (typically the first/recommended option)
					if (this.#onOutputPanelFocus()) {
						this.#onCancelCallback();
						return;
					}
					const selected = this.#options[this.#selectedIndex];
					if (selected) {
						this.#onSelectCallback(selected);
					} else {
						this.#onCancelCallback();
					}
				},
			);
		}

		if (this.#wrapFocused) {
			// Width-aware child owns wrapped layout. It handles both outline
			// and non-outline rendering paths internally so the cursor signal
			// + continuation indent are identical across branches.
			this.#focusAwareList = new FocusAwareList(this.#outline);
			this.addChild(this.#focusAwareList);
		} else if (this.#outline) {
			this.#outlinedList = new OutlinedList();
			this.addChild(this.#outlinedList);
		} else {
			this.#listContainer = new Container();
			this.addChild(this.#listContainer);
		}
		this.#inputArea = new Container();
		this.addChild(this.#inputArea);
		this.addChild(new Spacer(1));
		this.#baseHelpText = opts?.helpText ?? "up/down navigate  enter select  esc cancel";
		const initialHelp =
			opts?.customInputListSlot === true
				? theme.fg("dim", `${this.#baseHelpText}  ▲▼`)
				: theme.fg("dim", this.#baseHelpText);
		this.#helpTextComponent = new Text(initialHelp, 1, 0);
		this.addChild(this.#helpTextComponent);
		this.addChild(new Spacer(1));
		this.addChild(new DynamicBorder());

		this.#updateList();
		if (this.#customInputListSlot && this.#listSlotCustomInput) {
			this.#mountOutputPanelChrome();
		} else if (this.#customInputDocked && this.#dockedCustomInput) {
			this.#mountDockedInputArea();
		}
	}

	#updateList(): void {
		if (this.#wrapFocused && this.#focusAwareList) {
			const onPanel = this.#onOutputPanelFocus();
			const listIndex = onPanel ? Math.max(0, this.#options.length - 1) : this.#selectedIndex;
			this.#focusAwareList.setState(this.#options, listIndex, this.#maxVisible, this.#outputFooterLines, onPanel);
			return;
		}

		// Legacy branch — byte-identical to the previous implementation. Any
		// change here is a regression against
		// `BASELINE_OUTLINED_RENDER_80_STRIPPED` in
		// `packages/coding-agent/test/hook-selector-overflow.test.ts`.
		const lines: string[] = [];
		const startIndex = Math.max(
			0,
			Math.min(this.#selectedIndex - Math.floor(this.#maxVisible / 2), this.#options.length - this.#maxVisible),
		);
		const endIndex = Math.min(startIndex + this.#maxVisible, this.#options.length);

		const mdTheme = getMarkdownTheme();
		for (let i = startIndex; i < endIndex; i++) {
			const isSelected = i === this.#selectedIndex;
			const label = isSelected
				? renderInlineMarkdown(this.#options[i], mdTheme, t => theme.fg("accent", t))
				: renderInlineMarkdown(this.#options[i], mdTheme, t => theme.fg("text", t));
			const prefix = isSelected ? theme.fg("accent", `${theme.nav.cursor} `) : "  ";
			lines.push(prefix + label);
		}

		const totalItems = this.#options.length;
		if (startIndex > 0 || endIndex < totalItems) {
			lines.push(theme.fg("dim", `  (${this.#selectedIndex + 1}/${totalItems})`));
		}
		if (this.#outlinedList) {
			this.#outlinedList.setLines(lines, this.#outputFooterLines);
			return;
		}
		this.#listContainer?.clear();
		for (const line of lines) {
			this.#listContainer?.addChild(new Text(line, 1, 0));
		}
	}

	#stopCountdownForTyping(): void {
		if (this.#countdown) {
			this.#countdown.dispose();
			this.#countdown = undefined;
			this.#titleComponent.setText(this.#baseTitle);
		}
	}

	#inputModeHelpText(): string {
		// 99.20.05: the wheel belongs to the terminal (native scrollback) — only
		// keyboard paging scrolls the question.
		const scrollHint = this.#scrollTitleRows === undefined ? "" : "  PgUp/PgDn scroll question";
		return `enter submit  esc back to options  ctrl+g external editor${scrollHint}`;
	}

	#inputSubmitHandler(): ((text: string) => void) | undefined {
		if (this.#customInputListSlot) return this.#listSlotCustomInput?.onSubmit;
		if (this.#customInputDocked) return this.#dockedCustomInput?.onSubmit;
		return this.#customInput?.onSubmit;
	}

	#listSlotLabel(): string {
		const n = this.#options.length + 1;
		const custom = this.#listSlotCustomInput?.label?.trim();
		return custom && custom.length > 0 ? custom : `${n}. Type your own`;
	}

	#selectionMaxIndex(): number {
		return this.#customInputListSlot ? this.#options.length : Math.max(0, this.#options.length - 1);
	}

	#onOutputPanelFocus(): boolean {
		return this.#customInputListSlot && this.#selectedIndex === this.#options.length;
	}

	#ensureListSlotEditor(): void {
		if (this.#listSlotEditor) return;
		this.#listSlotEditor = createAskOutputPanelEditor();
	}

	#mountOutputPanelChrome(): void {
		if (!this.#listSlotCustomInput) return;
		this.#ensureListSlotEditor();
		this.#syncOutputPanelPresentation();
	}

	#syncOutputPanelPresentation(width?: number): void {
		if (!this.#customInputListSlot) return;
		const w = width ?? 80;
		const inner = Math.max(1, w - 4);
		const heading = this.#listSlotLabel();
		const onPanel = this.#onOutputPanelFocus();
		const mdTheme = getMarkdownTheme();
		const prefix = onPanel ? theme.fg("accent", `${theme.nav.cursor} `) : "  ";
		const headingLine =
			prefix + renderInlineMarkdown(heading, mdTheme, t => (onPanel ? theme.fg("accent", t) : theme.fg("dim", t)));
		// The editor row renders focused or not (unfocused emits no cursor
		// marker) so the selector keeps a constant height — toggling rows on
		// slot focus fed the scrollback-artifact differ path (086 family) and
		// could eat the box's top border mid-interaction.
		const footer: string[] = [headingLine];
		if (this.#listSlotEditor) {
			for (const line of this.#listSlotEditor.render(inner)) {
				footer.push(`  ${line}`);
			}
		}
		this.#outputFooterLines = footer;
		this.#inputArea.clear();
		this.#updateList();
		this.invalidate();
	}

	#focusOutputPanelEditor(): void {
		if (!this.#listSlotEditor) return;
		this.#stopCountdownForTyping();
		this.#editorFocused = true;
		this.#listSlotEditor.focused = true;
		this.#helpTextComponent.setText(theme.fg("dim", this.#inputModeHelpText()));
		this.#syncOutputPanelPresentation();
		this.#tui?.requestRender();
	}

	#blurOutputPanelEditor(): void {
		if (!this.#customInputListSlot) return;
		this.#editorFocused = false;
		if (this.#listSlotEditor) this.#listSlotEditor.focused = false;
		this.#helpTextComponent.setText(theme.fg("dim", this.#listSlotNavHelpText()));
		this.#syncOutputPanelPresentation();
		this.#tui?.requestRender();
	}

	#listSlotNavHelpText(): string {
		return `${this.#baseHelpText}  ▲▼`;
	}

	#createPromptEditor(promptGutter: string): Editor {
		const editor = new Editor(getEditorTheme());
		editor.setBorderVisible(false);
		editor.setPromptGutter(promptGutter);
		editor.disableSubmit = true;
		return editor;
	}

	#mountDockedInputArea(): void {
		const docked = this.#dockedCustomInput;
		if (!docked) return;
		this.#stopCountdownForTyping();
		this.#inputArea.clear();
		if (docked.label) {
			this.#inputArea.addChild(new Text(theme.fg("dim", docked.label), 1, 0));
		}
		const editor = this.#createPromptEditor(docked.prompt ?? "> ");
		this.#inlineEditor = editor;
		this.#inputArea.addChild(new Spacer(1));
		this.#inputArea.addChild(editor);
		const dockedHint = "  tab type own answer";
		this.#helpTextComponent.setText(theme.fg("dim", `${this.#baseHelpText}${dockedHint}`));
		this.invalidate();
	}

	#focusDockedEditor(): void {
		if (!this.#inlineEditor || !this.#customInputDocked) return;
		this.#editorFocused = true;
		this.#stopCountdownForTyping();
		this.#helpTextComponent.setText(theme.fg("dim", this.#inputModeHelpText()));
		this.invalidate();
	}

	#blurDockedEditor(): void {
		if (!this.#customInputDocked) return;
		this.#editorFocused = false;
		const dockedHint = "  tab type own answer";
		this.#helpTextComponent.setText(theme.fg("dim", `${this.#baseHelpText}${dockedHint}`));
		this.invalidate();
	}

	#submitInlineText(editor: Editor): void {
		const text = editor.getText().trim();
		if (!text) return;
		this.#inputSubmitHandler()?.(text);
	}
	handleInput(keyData: string): void {
		// Reset countdown on any interaction
		this.#countdown?.reset();

		if (this.#scrollTitleRows !== undefined) {
			const wheelRows = getMouseWheelTitleScrollRows(keyData);
			if (wheelRows !== 0) {
				this.#scrollableTitle?.scrollBy(wheelRows);
				return;
			}
		}
		if (this.#scrollTitleRows !== undefined && matchesKey(keyData, "pageUp")) {
			this.#scrollableTitle?.scrollBy(-this.#scrollTitleRows);
			return;
		}
		if (this.#scrollTitleRows !== undefined && matchesKey(keyData, "pageDown")) {
			this.#scrollableTitle?.scrollBy(this.#scrollTitleRows);
			return;
		}

		if (this.#editorFocused && this.#customInputListSlot && this.#listSlotEditor) {
			if (matchesKey(keyData, "up")) {
				if (this.#onOutputPanelFocus()) {
					this.#selectedIndex = Math.max(0, this.#options.length - 1);
					this.#blurOutputPanelEditor();
					this.#updateList();
					return;
				}
			}
			if (matchesKey(keyData, "down")) {
				return;
			}
		}

		if (this.#editorFocused) {
			const activeEditor =
				this.#customInputListSlot && this.#onOutputPanelFocus() && this.#listSlotEditor
					? this.#listSlotEditor
					: this.#inlineEditor;
			if (activeEditor) {
				this.#handleInputModeKey(keyData, activeEditor);
				return;
			}
		}

		if (matchesKey(keyData, "tab") && !matchesKey(keyData, "shift+tab")) {
			if (this.#customInputDocked && this.#inlineEditor) {
				this.#focusDockedEditor();
				return;
			}
		}
		if (matchesKey(keyData, "shift+tab")) {
			if (this.#customInputDocked && this.#editorFocused) {
				this.#blurDockedEditor();
				return;
			}
		}
		if (matchesKey(keyData, "up") || keyData === "k") {
			if (this.#selectedIndex > 0) {
				const wasSlot = this.#onOutputPanelFocus();
				this.#selectedIndex = Math.max(0, this.#selectedIndex - 1);
				if (wasSlot) this.#blurOutputPanelEditor();
				if (this.#onOutputPanelFocus()) this.#focusOutputPanelEditor();
				this.#updateList();
			}
		} else if (matchesKey(keyData, "down") || keyData === "j") {
			const atLast = this.#selectedIndex >= this.#selectionMaxIndex();
			if (this.#customInputDocked && this.#inlineEditor && atLast && !this.#customInputListSlot) {
				this.#focusDockedEditor();
				return;
			}
			if (!atLast) {
				const wasSlot = this.#onOutputPanelFocus();
				this.#selectedIndex = Math.min(this.#selectionMaxIndex(), this.#selectedIndex + 1);
				if (wasSlot) this.#blurOutputPanelEditor();
				if (this.#onOutputPanelFocus()) this.#focusOutputPanelEditor();
				this.#updateList();
			}
		} else if (matchesKey(keyData, "enter") || matchesKey(keyData, "return") || keyData === "\n") {
			if (this.#onOutputPanelFocus()) {
				const editor = this.#listSlotEditor;
				if (editor) this.#submitInlineText(editor);
				return;
			}
			const selected = this.#options[this.#selectedIndex];
			if (!selected) return;
			if (this.#customInput && selected === this.#customInput.optionLabel) {
				this.#enterInputMode();
				return;
			}
			this.#onSelectCallback(selected);
		} else if (matchesKey(keyData, "left")) {
			this.#onLeftCallback?.();
		} else if (matchesKey(keyData, "right")) {
			this.#onRightCallback?.();
		} else if (this.#onExternalEditorCallback && matchesAppExternalEditor(keyData)) {
			this.#onExternalEditorCallback();
		} else if (matchesSelectCancel(keyData)) {
			this.#onCancelCallback();
		}
	}

	/** Keys while the inline custom-input editor is open below the option list. */
	#handleInputModeKey(keyData: string, editor: Editor): void {
		// Escape backs out to option selection instead of cancelling the dialog,
		// so a stray Esc never throws away the question context.
		if (matchesKey(keyData, "escape") || matchesAppInterrupt(keyData)) {
			if (this.#customInputListSlot && editor === this.#listSlotEditor) {
				this.#blurOutputPanelEditor();
				this.#selectedIndex = Math.max(0, this.#options.length - 1);
				this.#updateList();
				return;
			}
			if (this.#customInputDocked) {
				this.#blurDockedEditor();
				return;
			}
			this.#exitInputMode();
			return;
		}

		if (matchesAppExternalEditor(keyData)) {
			void this.#openExternalEditor(editor);
			return;
		}
		if (matchesKey(keyData, "enter") || matchesKey(keyData, "return")) {
			if (this.#customInputListSlot && editor === this.#listSlotEditor) {
				this.#submitInlineText(editor);
			} else if (this.#customInputDocked) {
				this.#submitInlineText(editor);
			} else {
				this.#customInput?.onSubmit(editor.getText());
			}
			return;
		}
		editor.handleInput(keyData);
		if (this.#customInputListSlot && editor === this.#listSlotEditor) {
			this.#syncOutputPanelPresentation();
			this.#tui?.requestRender();
		}
	}

	#enterInputMode(): void {
		if (this.#inlineEditor) return;
		this.#stopCountdownForTyping();
		const editor = this.#createPromptEditor("> ");
		this.#inlineEditor = editor;
		this.#editorFocused = true;
		this.#inputArea.addChild(new Spacer(1));
		this.#inputArea.addChild(editor);
		this.#helpTextComponent.setText(theme.fg("dim", this.#inputModeHelpText()));
		this.invalidate();
	}

	#exitInputMode(): void {
		if (!this.#inlineEditor) return;
		if (this.#customInputDocked) {
			this.#blurDockedEditor();
			return;
		}
		this.#inlineEditor = undefined;
		this.#editorFocused = false;
		this.#inputArea.clear();
		this.#helpTextComponent.setText(theme.fg("dim", this.#baseHelpText));
		this.invalidate();
	}

	async #openExternalEditor(editor: Editor): Promise<void> {
		const editorCmd = getEditorCommand();
		if (!editorCmd || !this.#tui) return;

		const currentText = editor.getExpandedText();
		try {
			this.#tui.stop();
			const result = await openInEditor(editorCmd, currentText);
			if (result !== null) {
				editor.setText(result);
			}
		} finally {
			this.#tui.start();
			this.#tui.requestRender(true);
		}
	}

	override render(width: number): string[] {
		if (this.#customInputListSlot) {
			this.#syncOutputPanelPresentation(width);
		}
		return super.render(width);
	}

	dispose(): void {
		this.#countdown?.dispose();
	}
}
