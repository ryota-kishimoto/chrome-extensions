const SELECTORS = {
	tweet: 'article[data-testid="tweet"]',
	tweetText: '[data-testid="tweetText"]',
	userName: '[data-testid="User-Name"]',
	tweetPhoto: '[data-testid="tweetPhoto"] img',
	timestamp: "time[datetime]",
	actionBar: '[role="group"]',
	copyButton: "button.copy-tweet-btn",
	// X Article specific
	articleTitle: '[data-testid="twitter-article-title"]',
	articleBody: '[data-testid="longformRichTextComponent"]',
	articleReadView: '[data-testid="twitterArticleReadView"]',
} as const;

export function findTweets(): HTMLElement[] {
	return Array.from(document.querySelectorAll<HTMLElement>(SELECTORS.tweet));
}

export function hasCopyButton(tweet: HTMLElement): boolean {
	return tweet.querySelector(SELECTORS.copyButton) !== null;
}

export function isArticle(tweet: HTMLElement): boolean {
	return tweet.querySelector(SELECTORS.articleTitle) !== null;
}

export function getArticleTitle(tweet: HTMLElement): string {
	const el = tweet.querySelector(SELECTORS.articleTitle);
	return el?.textContent?.trim() ?? "";
}

function extractBlockText(el: Element): string {
	if (el.tagName === "UL" || el.tagName === "OL") {
		return Array.from(el.querySelectorAll("li"))
			.map((li) => li.textContent?.trim() ?? "")
			.filter(Boolean)
			.map((text) => `- ${text}`)
			.join("\n");
	}

	return el.textContent?.trim() ?? "";
}

export function getTweetText(tweet: HTMLElement): string {
	// X Article: extract text per block to preserve line breaks
	const articleBody = tweet.querySelector(SELECTORS.articleBody);
	if (articleBody) {
		const wrapper = articleBody.querySelector(":scope > div");
		if (!wrapper) return articleBody.textContent?.trim() ?? "";

		const blocks = wrapper.querySelectorAll(":scope > *");
		return Array.from(blocks).map(extractBlockText).filter(Boolean).join("\n");
	}

	// Normal tweet
	const el = tweet.querySelector(SELECTORS.tweetText);
	return el?.textContent?.trim() ?? "";
}

export function getUserName(tweet: HTMLElement): {
	displayName: string;
	handle: string;
} {
	const container = tweet.querySelector(SELECTORS.userName);
	if (!container) return { displayName: "", handle: "" };

	const links = container.querySelectorAll("a");
	const displayName = links[0]?.textContent?.trim() ?? "";
	const handle = links[1]?.textContent?.trim() ?? "";
	return { displayName, handle };
}

export function getTimestamp(tweet: HTMLElement): string {
	const time = tweet.querySelector<HTMLTimeElement>(SELECTORS.timestamp);
	return time?.dateTime ?? "";
}

function extractSrcs(imgs: NodeListOf<HTMLImageElement>): string[] {
	return Array.from(imgs)
		.map((img) => img.src)
		.filter(Boolean);
}

export function getImageUrls(tweet: HTMLElement): string[] {
	const tweetPhotos = tweet.querySelectorAll<HTMLImageElement>(
		SELECTORS.tweetPhoto,
	);
	if (tweetPhotos.length > 0) return extractSrcs(tweetPhotos);

	const readView = tweet.querySelector(SELECTORS.articleReadView);
	if (readView) return extractSrcs(readView.querySelectorAll("img"));

	return [];
}

export function getActionBar(tweet: HTMLElement): HTMLElement | null {
	return tweet.querySelector<HTMLElement>(SELECTORS.actionBar);
}

export function createCopyButton(onClick: () => void): HTMLButtonElement {
	const btn = document.createElement("button");
	btn.type = "button";
	btn.className = "copy-tweet-btn";
	btn.textContent = "Copy";
	btn.addEventListener("click", (e) => {
		e.stopPropagation();
		onClick();
	});
	return btn;
}
