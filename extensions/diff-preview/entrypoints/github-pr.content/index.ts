import {
	createPreviewButton,
	findFileHeaders,
	findPreviewButton,
	flashButton,
	getFilePath,
	getFileRef,
	insertPreviewButton,
} from "./dom";
import { isHtmlFile, viewerUrl } from "./preview";
import "./style.css";

async function handlePreviewClick(
	header: HTMLElement,
	button: HTMLButtonElement,
): Promise<void> {
	flashButton(button);

	// Open the tab synchronously (as a direct result of the click) so browsers
	// don't treat it as a blocked popup, then navigate it once the ref resolves.
	const newTab = window.open("about:blank", "_blank");
	if (!newTab) return;

	const ref = await getFileRef(header);
	if (!ref) {
		newTab.close();
		return;
	}

	newTab.location.href = viewerUrl(ref);
}

function insertButtons(): void {
	for (const header of findFileHeaders()) {
		if (findPreviewButton(header)) continue;

		const path = getFilePath(header);
		if (!path || !isHtmlFile(path)) continue;

		const btn = createPreviewButton((button) => {
			handlePreviewClick(header, button);
		});
		insertPreviewButton(header, btn);
	}
}

const RETRY_DELAYS_MS = [1000, 2000];

function startRetry(ctx: ContentScriptContext): void {
	for (const delay of RETRY_DELAYS_MS) {
		const timer = setTimeout(() => insertButtons(), delay);
		ctx.onInvalidated(() => clearTimeout(timer));
	}
}

export default defineContentScript({
	matches: ["https://github.com/*"],
	runAt: "document_idle",

	main(ctx) {
		insertButtons();

		let lastUrl = location.href;
		const observer = new MutationObserver(() => {
			insertButtons();

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
