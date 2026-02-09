import "./style.css";

const BUTTON_ID = "uncheck-viewed-btn";
const BUTTON_LABEL = "Uncheck All Viewed";

function sleep(ms: number): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

function findCheckedViewedButtons(): HTMLElement[] {
	return Array.from(
		document.querySelectorAll<HTMLElement>(
			'button[aria-label="Viewed"][aria-pressed="true"]',
		),
	);
}

function getViewedCount(): number {
	const el = document.querySelector('[class*="FilesCountText"]');
	return el ? Number.parseInt(el.textContent ?? "0", 10) : 0;
}

function getButton(): HTMLButtonElement | null {
	return document.getElementById(BUTTON_ID) as HTMLButtonElement | null;
}

async function uncheckAllViewed(): Promise<void> {
	const button = getButton();
	if (!button) return;

	button.textContent = "Unchecking...";
	button.disabled = true;

	for (let attempt = 0; attempt < 100; attempt++) {
		if (getViewedCount() === 0) break;

		for (const el of findCheckedViewedButtons()) {
			el.click();
		}
		await sleep(200);
	}

	button.textContent = BUTTON_LABEL;
	button.disabled = false;
}

function insertButton(): void {
	if (getButton()) return;

	const viewedProgress = document.querySelector<HTMLElement>(
		'[class*="ViewedFileProgress-module__ProgressContainer"]',
	);
	if (!viewedProgress) return;

	const btn = document.createElement("button");
	btn.id = BUTTON_ID;
	btn.type = "button";
	btn.className = "uncheck-viewed-btn";
	btn.textContent = BUTTON_LABEL;
	btn.addEventListener("click", uncheckAllViewed);

	viewedProgress.insertAdjacentElement("afterend", btn);
}

export default defineContentScript({
	matches: [
		"https://github.com/*/pull/*/files*",
		"https://github.com/*/pull/*/changes*",
	],
	runAt: "document_idle",

	main(ctx) {
		insertButton();

		const observer = new MutationObserver(insertButton);

		observer.observe(document.body, { childList: true, subtree: true });
		ctx.onInvalidated(() => observer.disconnect());
	},
});
