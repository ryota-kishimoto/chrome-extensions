interface TweetData {
	displayName: string;
	handle: string;
	timestamp: string;
	text: string;
	imageUrls: string[];
	articleTitle?: string;
}

function buildMarkdown(data: TweetData): string {
	const lines: string[] = [];

	lines.push(`**${data.displayName}** (${data.handle}) - ${data.timestamp}`);
	lines.push("");

	if (data.articleTitle) {
		lines.push(`## ${data.articleTitle}`);
		lines.push("");
	}

	if (data.text) {
		lines.push(data.text);
		lines.push("");
	}

	for (const url of data.imageUrls) {
		lines.push(`![image](${url})`);
	}

	return lines.join("\n").trimEnd();
}

function blobToDataUrl(blob: Blob): Promise<string> {
	return new Promise((resolve, reject) => {
		const reader = new FileReader();
		reader.onload = () => resolve(reader.result as string);
		reader.onerror = () => reject(reader.error);
		reader.readAsDataURL(blob);
	});
}

async function fetchImageDataUrl(url: string): Promise<string | null> {
	try {
		const res = await fetch(url);
		if (!res.ok) return null;
		return await blobToDataUrl(await res.blob());
	} catch {
		return null;
	}
}

function escapeHtml(text: string): string {
	return text
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;")
		.replace(/"/g, "&quot;");
}

function buildHtml(data: TweetData, imageDataUrls: (string | null)[]): string {
	const parts: string[] = [];

	parts.push(
		`<p><strong>${escapeHtml(data.displayName)}</strong> (${escapeHtml(data.handle)}) - ${escapeHtml(data.timestamp)}</p>`,
	);

	if (data.articleTitle) {
		parts.push(`<h2>${escapeHtml(data.articleTitle)}</h2>`);
	}

	if (data.text) {
		const escaped = escapeHtml(data.text).replace(/\n/g, "<br>");
		parts.push(`<p>${escaped}</p>`);
	}

	for (const dataUrl of imageDataUrls) {
		if (dataUrl) {
			parts.push(`<img src="${dataUrl}" />`);
		}
	}

	return parts.join("\n");
}

export async function copyTweetToClipboard(data: TweetData): Promise<void> {
	const markdown = buildMarkdown(data);

	const imageDataUrls = await Promise.all(
		data.imageUrls.map(fetchImageDataUrl),
	);

	const html = buildHtml(data, imageDataUrls);

	await navigator.clipboard.write([
		new ClipboardItem({
			"text/plain": new Blob([markdown], { type: "text/plain" }),
			"text/html": new Blob([html], { type: "text/html" }),
		}),
	]);
}
