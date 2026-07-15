import { fetchRawFile, prepareRelativeImages } from "../../utils/rawContent";

const statusEl = document.getElementById("status") as HTMLDivElement;
const frameEl = document.getElementById("frame") as HTMLIFrameElement;

function showError(message: string): void {
	statusEl.textContent = message;
	statusEl.classList.add("error");
}

// This page is web-accessible from https://github.com/*, so any GitHub page
// can open it with arbitrary query params. Constrain each one to the shape a
// real file reference has, so the fetch URL can't be bent toward anything
// other than a commit-pinned raw file.
const OWNER_REPO_RE = /^[A-Za-z0-9_.-]+$/;
const SHA_RE = /^[0-9a-f]{40}$/i;

function parseFileRef(params: URLSearchParams) {
	const owner = params.get("owner") ?? "";
	const repo = params.get("repo") ?? "";
	const sha = params.get("sha") ?? "";
	const path = params.get("path") ?? "";

	const valid =
		OWNER_REPO_RE.test(owner) &&
		OWNER_REPO_RE.test(repo) &&
		SHA_RE.test(sha) &&
		path.length > 0 &&
		!path.split("/").includes("..");
	return valid ? { owner, repo, sha, path } : null;
}

async function main(): Promise<void> {
	const ref = parseFileRef(new URLSearchParams(location.search));
	if (!ref) {
		showError("Missing or invalid file reference.");
		return;
	}
	const { path } = ref;

	document.title = path.split("/").pop() ?? "Diff Preview";

	try {
		const html = await prepareRelativeImages(await fetchRawFile(ref), ref);

		// The renderer frame is a sandboxed extension page (its own CSP allows
		// inline scripts, unlike this page's), so hand it the HTML over
		// postMessage rather than writing to its document directly.
		frameEl.addEventListener(
			"load",
			() => frameEl.contentWindow?.postMessage(html, "*"),
			{ once: true },
		);
		frameEl.src = browser.runtime.getURL("/renderer.html");
		frameEl.style.display = "block";
		statusEl.style.display = "none";
	} catch (err) {
		showError(
			`Failed to load preview: ${err instanceof Error ? err.message : String(err)}`,
		);
	}
}

main();
