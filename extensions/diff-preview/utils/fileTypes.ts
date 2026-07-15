function extensionOf(path: string): string {
	return path.split(".").pop()?.toLowerCase() ?? "";
}

export function isHtmlFile(path: string): boolean {
	const ext = extensionOf(path);
	return ext === "html" || ext === "htm";
}

export function isLottieFile(path: string): boolean {
	return extensionOf(path) === "lottie";
}

export function isJsonFile(path: string): boolean {
	return extensionOf(path) === "json";
}

// Tolerates the \"-escaped form too, since diff text scanned from GitHub's
// page data arrives as a JSON-stringified structure.
const LAYERS_RE = /\\?"layers\\?":/;
const FR_RE = /\\?"fr\\?":/;

/** Cheap marker test for scanning diff text or fetched content — a false
 * positive only means a Preview button appears; the viewer still validates
 * the parsed JSON before playing it. */
export function looksLikeLottie(text: string): boolean {
	return LAYERS_RE.test(text) && FR_RE.test(text);
}
