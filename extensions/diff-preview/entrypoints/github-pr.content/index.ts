import {
	isHtmlFile,
	isJsonFile,
	isLottieFile,
	looksLikeLottie,
} from "../../utils/fileTypes";
import { rawFileUrl } from "../../utils/rawContent";
import {
	createPreviewButton,
	findFileHeaders,
	findPreviewButton,
	flashButton,
	getDiffText,
	getFilePath,
	getFileRef,
	getFileRefSync,
	insertPreviewButton,
} from "./dom";
import { viewerUrl } from "./preview";
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

function insertButton(header: HTMLElement): void {
	const btn = createPreviewButton((button) => {
		handlePreviewClick(header, button);
	});
	insertPreviewButton(header, btn);
}

// Marks .json headers whose content check already ran, so the MutationObserver
// re-runs of insertButtons don't kick off duplicate checks or fetches.
const JSON_CHECKED_ATTR = "data-diff-preview-checked";

/**
 * .json files only get a button when they actually contain a Lottie animation
 * — a button on every package.json would be noise. The diff text GitHub
 * already inlined into the page decides it for free; only files whose diff
 * isn't inlined (e.g. too big) cost a fetch.
 */
async function checkJsonForLottie(header: HTMLElement): Promise<void> {
	const diffText = getDiffText(header);
	if (diffText) {
		if (looksLikeLottie(diffText)) insertButton(header);
		return;
	}

	const ref = getFileRefSync(header);
	if (!ref) return;
	try {
		const res = await fetch(rawFileUrl(ref));
		if (res.ok && looksLikeLottie(await res.text())) insertButton(header);
	} catch {
		// No button; the file just isn't previewable right now.
	}
}

function insertButtons(): void {
	for (const header of findFileHeaders()) {
		if (findPreviewButton(header)) continue;

		const path = getFilePath(header);
		if (!path) continue;

		if (isHtmlFile(path) || isLottieFile(path)) {
			insertButton(header);
		} else if (isJsonFile(path) && !header.hasAttribute(JSON_CHECKED_ATTR)) {
			header.setAttribute(JSON_CHECKED_ATTR, "");
			checkJsonForLottie(header);
		}
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
