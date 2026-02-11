import { copyTweetToClipboard } from "./clipboard";
import {
	createCopyButton,
	findTweets,
	getActionBar,
	getArticleTitle,
	getImageUrls,
	getTimestamp,
	getTweetText,
	getUserName,
	hasCopyButton,
	isArticle,
} from "./dom";
import "./style.css";

function handleCopy(tweet: HTMLElement, button: HTMLButtonElement): void {
	const { displayName, handle } = getUserName(tweet);
	const text = getTweetText(tweet);
	const timestamp = getTimestamp(tweet);
	const imageUrls = getImageUrls(tweet);
	const articleTitle = isArticle(tweet) ? getArticleTitle(tweet) : undefined;

	button.textContent = "Copying...";
	button.disabled = true;

	copyTweetToClipboard({
		displayName,
		handle,
		timestamp,
		text,
		imageUrls,
		articleTitle,
	})
		.then(() => {
			button.textContent = "Copied!";
			setTimeout(() => {
				button.textContent = "Copy";
				button.disabled = false;
			}, 1500);
		})
		.catch(() => {
			button.textContent = "Failed";
			setTimeout(() => {
				button.textContent = "Copy";
				button.disabled = false;
			}, 1500);
		});
}

function insertButtons(): void {
	for (const tweet of findTweets()) {
		if (hasCopyButton(tweet)) continue;

		const actionBar = getActionBar(tweet);
		if (!actionBar) continue;

		const btn = createCopyButton(() => handleCopy(tweet, btn));
		actionBar.appendChild(btn);
	}
}

export default defineContentScript({
	matches: ["https://x.com/*", "https://twitter.com/*"],
	runAt: "document_idle",

	main(ctx) {
		insertButtons();

		let scheduled = false;
		const observer = new MutationObserver(() => {
			if (scheduled) return;
			scheduled = true;
			requestAnimationFrame(() => {
				insertButtons();
				scheduled = false;
			});
		});
		observer.observe(document.body, { childList: true, subtree: true });
		ctx.onInvalidated(() => observer.disconnect());
	},
});
