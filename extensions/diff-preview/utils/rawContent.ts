export type FileRef = {
	owner: string;
	repo: string;
	sha: string;
	path: string;
};

// Goes through github.com (cookie-authenticated, works for private repos too)
// rather than raw.githubusercontent.com directly, which 404s without a token.
export function rawFileUrl(ref: FileRef): string {
	return `https://github.com/${ref.owner}/${ref.repo}/raw/${ref.sha}/${ref.path}`;
}

function rawDirUrl(ref: FileRef): string {
	const dir = ref.path.slice(0, ref.path.lastIndexOf("/") + 1);
	return `https://github.com/${ref.owner}/${ref.repo}/raw/${ref.sha}/${dir}`;
}

export async function fetchRawFile(ref: FileRef): Promise<string> {
	const res = await fetch(rawFileUrl(ref));
	if (!res.ok) throw new Error(`Failed to fetch: ${res.status}`);
	return res.text();
}

function blobToDataUrl(blob: Blob): Promise<string> {
	return new Promise((resolve, reject) => {
		const reader = new FileReader();
		reader.onload = () => resolve(reader.result as string);
		reader.onerror = () => reject(reader.error);
		reader.readAsDataURL(blob);
	});
}

function isRelativePath(src: string): boolean {
	return !/^(?:[a-z]+:)?\/\//i.test(src) && !src.startsWith("data:");
}

// Inserted before every other <script> in the document (see prepareRelativeImages),
// so the observer is watching before any of the page's own scripts run. Those
// scripts sometimes assign an <img>'s src to the same relative path used in the
// initial HTML (e.g. cycling through a character's sprites) rather than ever
// pointing at an absolute URL — those assignments can't be rewritten ahead of
// time, since document.write executes each <script> as the parser reaches it,
// so any src mutation is intercepted here instead and swapped for the
// pre-fetched data: URI.
function watchScript(imageMap: Record<string, string>): string {
	return `<script>(${(
		(map) => {
			new MutationObserver((mutations) => {
				for (const mutation of mutations) {
					if (
						mutation.type !== "attributes" ||
						mutation.attributeName !== "src"
					)
						continue;
					const img = mutation.target;
					if (!(img instanceof HTMLImageElement)) continue;
					const src = img.getAttribute("src");
					if (src && map[src]) img.src = map[src];
				}
			}).observe(document.documentElement, {
				attributes: true,
				attributeFilter: ["src"],
				subtree: true,
			});
		}
	).toString()})(${JSON.stringify(imageMap)})</script>`;
}

/**
 * The sandboxed renderer frame has an opaque (null) origin: its own
 * cross-origin <img> requests get blocked by CORB, and a blob: URL created
 * here (in the non-sandboxed viewer page) can't be dereferenced from a
 * different frame's postMessage payload — blob: URLs only resolve within the
 * document that created them. So every relative image src referenced in the
 * page is fetched here instead (a normal same-tab fetch to a
 * host_permissions-granted origin) and converted to a data: URI, both to
 * rewrite the initial <img> tags and to feed the injected watchScript (see
 * above) for paths a script reassigns to an <img>'s src at runtime.
 */
export async function prepareRelativeImages(
	html: string,
	ref: FileRef,
): Promise<string> {
	const doc = new DOMParser().parseFromString(html, "text/html");
	const dirUrl = rawDirUrl(ref);

	const paths = new Set<string>();
	for (const img of Array.from(doc.querySelectorAll("img"))) {
		const src = img.getAttribute("src");
		if (src && isRelativePath(src)) paths.add(src);
	}
	// Scripts commonly reference the same relative paths as string literals
	// (e.g. an array of character sprites) without them ever appearing in an
	// <img> tag's initial src, so scan those too.
	for (const script of Array.from(doc.querySelectorAll("script:not([src])"))) {
		const matches = (script.textContent ?? "").matchAll(
			/['"]([^'"]+\.(?:png|jpe?g|gif|webp|svg))['"]/gi,
		);
		for (const [, path] of matches) {
			if (isRelativePath(path)) paths.add(path);
		}
	}

	const imageMap: Record<string, string> = {};
	await Promise.all(
		Array.from(paths).map(async (path) => {
			try {
				const res = await fetch(new URL(path, dirUrl));
				if (!res.ok) return;
				imageMap[path] = await blobToDataUrl(await res.blob());
			} catch {
				// Leave this path unmapped; the image just won't load.
			}
		}),
	);

	for (const img of Array.from(doc.querySelectorAll("img"))) {
		const src = img.getAttribute("src");
		if (src && imageMap[src]) img.src = imageMap[src];
	}

	const watcher = watchScript(imageMap);
	const outerHtml = doc.documentElement.outerHTML;
	return /<head[^>]*>/i.test(outerHtml)
		? outerHtml.replace(/<head[^>]*>/i, (tag) => `${tag}${watcher}`)
		: watcher + outerHtml;
}
