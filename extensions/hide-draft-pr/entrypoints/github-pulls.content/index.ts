const STORAGE_KEY = "hideDraftPR";
const DRAFT_ROW_SELECTOR = '.Box-row:has([aria-label="Draft Pull Request"])';

async function getHidden(): Promise<boolean> {
	const result = await browser.storage.local.get(STORAGE_KEY);
	return result[STORAGE_KEY] ?? false;
}

function applyVisibility(hidden: boolean): void {
	for (const el of document.querySelectorAll<HTMLElement>(DRAFT_ROW_SELECTOR)) {
		el.style.display = hidden ? "none" : "";
	}
}

export default defineContentScript({
	matches: ["https://github.com/*/*/pulls", "https://github.com/*/*/pulls?*"],
	runAt: "document_idle",

	async main(ctx) {
		const hidden = await getHidden();
		applyVisibility(hidden);

		const observer = new MutationObserver(async () => {
			const h = await getHidden();
			applyVisibility(h);
		});
		observer.observe(document.body, { childList: true, subtree: true });
		ctx.onInvalidated(() => observer.disconnect());

		browser.storage.onChanged.addListener((changes) => {
			if (STORAGE_KEY in changes) {
				applyVisibility(changes[STORAGE_KEY].newValue);
			}
		});
	},
});
