import { Container, type SelectItem, SelectList } from "@jawcode-dev/tui";
import { getSelectListTheme } from "../theme/theme";
import { DynamicBorder } from "./dynamic-border";

export class BackgroundFooterDetailComponent extends Container {
	#selectList: SelectList;

	constructor(items: SelectItem[], onClose: () => void) {
		super();
		this.addChild(new DynamicBorder());
		this.#selectList = new SelectList(
			items.length > 0 ? items : [{ value: "back", label: "Back" }],
			8,
			getSelectListTheme(),
		);
		this.#selectList.onCancel = onClose;
		this.#selectList.onSelect = item => {
			if (item.value === "back") onClose();
		};
		this.addChild(this.#selectList);
		this.addChild(new DynamicBorder());
	}

	getFocus(): SelectList {
		return this.#selectList;
	}
}
