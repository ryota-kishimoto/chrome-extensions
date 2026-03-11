import {
	createUncheckButton,
	findUncheckButton,
	findViewedButtons,
	findViewedProgress,
	getViewedCount,
} from "./dom";
import "./style.css";

const BUTTON_LABEL = "Uncheck All Viewed";

function delay(ms: number): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

async function uncheckAllViewed(): Promise<void> {
	const button = findUncheckButton();
	if (!button) return;

	button.textContent = "Unchecking...";
	button.disabled = true;

	const MAX_ATTEMPTS = 500;
	for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
		if (getViewedCount() === 0) break;

		for (const el of findViewedButtons()) {
			el.click();
		}
		await delay(200);
	}

	button.textContent = BUTTON_LABEL;
	button.disabled = false;
}

function insertButton(): void {
	if (findUncheckButton()) return;

	const viewedProgress = findViewedProgress();
	if (!viewedProgress) return;

	const btn = createUncheckButton(BUTTON_LABEL, uncheckAllViewed);
	viewedProgress.insertAdjacentElement("afterend", btn);
}

const RETRY_DELAYS_MS = [1000, 2000];

function startRetry(ctx: ContentScriptContext): void {
	for (const delay of RETRY_DELAYS_MS) {
		const timer = setTimeout(() => insertButton(), delay);
		ctx.onInvalidated(() => clearTimeout(timer));
	}
}

export default defineContentScript({
	matches: ["https://github.com/*"],
	runAt: "document_idle",

	main(ctx) {
		insertButton();

		let lastUrl = location.href;
		const observer = new MutationObserver(() => {
			insertButton();

			const currentUrl = location.href;
			if (currentUrl !== lastUrl) {
				lastUrl = currentUrl;
				startRetry(ctx);
			}
		});
		observer.observe(document.body, { childList: true, subtree: true });
		ctx.onInvalidated(() => observer.disconnect());
	},
});
