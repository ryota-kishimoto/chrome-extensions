const BUTTON_ID = "uncheck-viewed-btn";

const SELECTORS = {
	// new experience
	viewedButton: 'button[aria-label="Viewed"][aria-pressed="true"]',
	filesCountText: '[class*="FilesCountText"]',
	viewedProgress: '[class*="ViewedFileProgress-module__ProgressContainer"]',
	// classic view
	viewedCheckbox: "input.js-reviewed-checkbox:checked",
	filesViewedText: ".diffbar-item.hide-md.hide-sm",
	askCopilot: "#copilot-diff-header-button",
	askCopilotContainer: ".pr-review-tools > div:has(#copilot-diff-header-button)",

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

type InsertTarget = { element: HTMLElement; position: InsertPosition };

export function findInsertTarget(): InsertTarget | null {
	// new experience
	const newEl = document.querySelector<HTMLElement>(SELECTORS.viewedProgress);
	if (newEl) return { element: newEl, position: "afterend" };

	// classic view: Ask Copilotの左
	const askCopilotContainer = document.querySelector<HTMLElement>(SELECTORS.askCopilotContainer);
	if (askCopilotContainer) return { element: askCopilotContainer, position: "beforebegin" };

	// classic view: fallback（files viewedの右）
	const filesViewed = document.querySelector<HTMLElement>(
		SELECTORS.filesViewedText,
	);
	if (filesViewed) return { element: filesViewed, position: "afterend" };

	return null;
}

export function createUncheckButton(
	label: string,
	onClick: () => void,
): HTMLButtonElement {
	const btn = document.createElement("button");
	btn.id = BUTTON_ID;
	btn.type = "button";
	btn.className = "uncheck-viewed-btn diffbar-item";
	btn.textContent = label;
	btn.addEventListener("click", onClick);
	return btn;
}
