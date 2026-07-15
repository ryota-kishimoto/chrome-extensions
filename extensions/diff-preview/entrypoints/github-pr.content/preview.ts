import type { FileRef } from "./dom";

const HTML_EXTENSIONS = new Set(["html", "htm"]);

export function isHtmlFile(path: string): boolean {
	const ext = path.split(".").pop()?.toLowerCase();
	return !!ext && HTML_EXTENSIONS.has(ext);
}

// The extension's own viewer page runs under the extension's origin, not
// github.com, so it isn't subject to GitHub's strict script-src CSP the way a
// blob: URL opened from a GitHub page would be.
export function viewerUrl(ref: FileRef): string {
	const params = new URLSearchParams(ref);
	return `${browser.runtime.getURL("/viewer.html")}?${params}`;
}
