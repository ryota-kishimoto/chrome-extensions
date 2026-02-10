const SELECTORS = {
	viewedButton: 'button[aria-label="Viewed"][aria-pressed="true"]',
	filesCountText: '[class*="FilesCountText"]',
	viewedProgress: '[class*="ViewedFileProgress-module__ProgressContainer"]',
} as const;

export function findCheckedViewedButtons(): HTMLElement[] {
	return Array.from(
		document.querySelectorAll<HTMLElement>(SELECTORS.viewedButton),
	);
}

export function getViewedCount(): number {
	const el = document.querySelector(SELECTORS.filesCountText);
	return el ? Number.parseInt(el.textContent ?? "0", 10) : 0;
}

export function getUncheckButton(id: string): HTMLButtonElement | null {
	return document.querySelector<HTMLButtonElement>(`button#${id}`);
}

export function findViewedProgress(): HTMLElement | null {
	return document.querySelector<HTMLElement>(SELECTORS.viewedProgress);
}

export function createUncheckButton(
	id: string,
	label: string,
	onClick: () => void,
): HTMLButtonElement {
	const btn = document.createElement("button");
	btn.id = id;
	btn.type = "button";
	btn.className = "uncheck-viewed-btn";
	btn.textContent = label;
	btn.addEventListener("click", onClick);
	return btn;
}
