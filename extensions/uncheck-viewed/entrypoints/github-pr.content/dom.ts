const BUTTON_ID = "uncheck-viewed-btn";

const SELECTORS = {
	// new experience
	viewedButton: 'button[aria-label="Viewed"][aria-pressed="true"]',
	filesCountText: '[class*="FilesCountText"]',
	viewedProgress: '[class*="ViewedFileProgress-module__ProgressContainer"]',
	// classic view
	viewedCheckbox: "input.js-reviewed-checkbox:checked",
	filesViewedText: ".diffbar-item.hide-md.hide-sm",

	uncheckButton: `button#${BUTTON_ID}`,
} as const;

export function findViewedButtons(): HTMLElement[] {
	// new experience: button
	const buttons = Array.from(
		document.querySelectorAll<HTMLElement>(SELECTORS.viewedButton),
	);
	if (buttons.length > 0) return buttons;

	// classic view: checkbox
	return Array.from(
		document.querySelectorAll<HTMLElement>(SELECTORS.viewedCheckbox),
	);
}

export function getViewedCount(): number {
	// new experience
	const newEl = document.querySelector(SELECTORS.filesCountText);
	if (newEl) return Number.parseInt(newEl.textContent ?? "0", 10);

	// classic view: "0  /  1 files viewed" → 最初の数字
	const classicEl = document.querySelector(SELECTORS.filesViewedText);
	if (classicEl) {
		const match = classicEl.textContent?.match(/(\d+)\s*\/\s*\d+/);
		return match ? Number.parseInt(match[1], 10) : 0;
	}

	return 0;
}

export function findUncheckButton(): HTMLButtonElement | null {
	return document.querySelector<HTMLButtonElement>(SELECTORS.uncheckButton);
}

export function findViewedProgress(): HTMLElement | null {
	return (
		document.querySelector<HTMLElement>(SELECTORS.viewedProgress) ??
		document.querySelector<HTMLElement>(SELECTORS.filesViewedText)
	);
}

export function createUncheckButton(
	label: string,
	onClick: () => void,
): HTMLButtonElement {
	const btn = document.createElement("button");
	btn.id = BUTTON_ID;
	btn.type = "button";
	btn.className = "uncheck-viewed-btn";
	btn.textContent = label;
	btn.addEventListener("click", onClick);
	return btn;
}
