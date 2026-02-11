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

async function fetchImageAsBase64(
	url: string,
): Promise<{ base64: string; mimeType: string } | null> {
	try {
		const res = await fetch(url);
		if (!res.ok) return null;

		const blob = await res.blob();
		const mimeType = blob.type || "image/jpeg";

		return new Promise((resolve) => {
			const reader = new FileReader();
			reader.onloadend = () => {
				const dataUrl = reader.result as string;
				resolve({ base64: dataUrl, mimeType });
			};
			reader.onerror = () => resolve(null);
			reader.readAsDataURL(blob);
		});
	} catch {
		return null;
	}
}

function buildHtmlWithImages(
	data: TweetData,
	images: ({ base64: string; mimeType: string } | null)[],
): string {
	const parts: string[] = [];

	parts.push(
		`<p><strong>${escapeHtml(data.displayName)}</strong> (${escapeHtml(data.handle)}) - ${escapeHtml(data.timestamp)}</p>`,
	);

	if (data.articleTitle) {
		parts.push(`<h2>${escapeHtml(data.articleTitle)}</h2>`);
	}

	if (data.text) {
		parts.push(`<p>${escapeHtml(data.text)}</p>`);
	}

	for (const img of images) {
		if (img) {
			parts.push(`<img src="${img.base64}" />`);
		}
	}

	return parts.join("\n");
}

function escapeHtml(text: string): string {
	return text
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;")
		.replace(/"/g, "&quot;");
}

export async function copyTweetToClipboard(data: TweetData): Promise<void> {
	const markdown = buildMarkdown(data);

	const images = await Promise.all(
		data.imageUrls.map((url) => fetchImageAsBase64(url)),
	);

	const html = buildHtmlWithImages(data, images);

	await navigator.clipboard.write([
		new ClipboardItem({
			"text/plain": new Blob([markdown], { type: "text/plain" }),
			"text/html": new Blob([html], { type: "text/html" }),
		}),
	]);
}
