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
	const tag = el.tagName;

	// List: each li on its own line
	if (tag === "UL" || tag === "OL") {
		return Array.from(el.querySelectorAll("li"))
			.map((li) => `- ${li.textContent?.trim() ?? ""}`)
			.filter((t) => t.length > 2)
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
		return Array.from(blocks)
			.map((block) => extractBlockText(block))
			.filter((t) => t.length > 0)
			.join("\n");
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

export function getImageUrls(tweet: HTMLElement): string[] {
	// Normal tweet photos
	const imgs = tweet.querySelectorAll<HTMLImageElement>(SELECTORS.tweetPhoto);
	if (imgs.length > 0) {
		return Array.from(imgs)
			.map((img) => img.src)
			.filter((src) => src.length > 0);
	}

	// X Article: images inside the read view
	const readView = tweet.querySelector(SELECTORS.articleReadView);
	if (readView) {
		return Array.from(readView.querySelectorAll<HTMLImageElement>("img"))
			.map((img) => img.src)
			.filter((src) => src.length > 0);
	}

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
