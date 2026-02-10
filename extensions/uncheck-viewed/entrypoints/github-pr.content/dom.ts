const BUTTON_ID = "uncheck-viewed-btn";

const SELECTORS = {
	viewedButton: 'button[aria-label="Viewed"][aria-pressed="true"]',
	filesCountText: '[class*="FilesCountText"]',
	viewedProgress: '[class*="ViewedFileProgress-module__ProgressContainer"]',
	uncheckButton: `button#${BUTTON_ID}`,
} as const;

export function findViewedButtons(): HTMLElement[] {
	return Array.from(
		document.querySelectorAll<HTMLElement>(SELECTORS.viewedButton),
	);
}

export function getViewedCount(): number {
	const el = document.querySelector(SELECTORS.filesCountText);
	return el ? Number.parseInt(el.textContent ?? "0", 10) : 0;
}

export function findUncheckButton(): HTMLButtonElement | null {
	return document.querySelector<HTMLButtonElement>(SELECTORS.uncheckButton);
}

export function findViewedProgress(): HTMLElement | null {
	return document.querySelector<HTMLElement>(SELECTORS.viewedProgress);
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
