import { getEditorTheme, theme } from "../theme/theme";
import { CustomEditor } from "./custom-editor";

function getDefaultInputPrefix(): string {
	return `${theme.fg("accent", ">")} `;
}

/** Match main TUI composer chrome (interactive-mode `configureDefaultComposerChrome`). */
export function configureComposerChrome(editor: CustomEditor): void {
	editor.setBorderVisible(true);
	editor.setBorderStyle("sharp");
	editor.setClosedBorderBox(true);
	editor.setPromptGutter(undefined);
	editor.setInputPrefix(getDefaultInputPrefix());
	editor.setPlaceholder("Type your message...");
	editor.setPaddingX(1);
	editor.setTopBorder(undefined);
	editor.disableSubmit = true;
}

/** Ask output panel (082.3): flat editor inside the option list box — no nested border. */
export function configureAskOutputPanelEditor(editor: CustomEditor): void {
	editor.setBorderVisible(false);
	editor.setPromptGutter(undefined);
	editor.setInputPrefix(getDefaultInputPrefix());
	editor.setPlaceholder("");
	editor.setPaddingX(0);
	editor.setTopBorder(undefined);
	editor.disableSubmit = true;
}

export function createComposerStyleEditor(): CustomEditor {
	const editor = new CustomEditor(getEditorTheme());
	configureComposerChrome(editor);
	return editor;
}

export function createAskOutputPanelEditor(): CustomEditor {
	const editor = new CustomEditor(getEditorTheme());
	configureAskOutputPanelEditor(editor);
	return editor;
}
