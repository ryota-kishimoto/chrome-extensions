import lottie from "lottie-web/build/player/lottie_light";
import { isJsonFile, isLottieFile } from "../../utils/fileTypes";
import { loadLottieAnimation } from "../../utils/lottie";
import {
	type FileRef,
	fetchRawFile,
	prepareRelativeImages,
} from "../../utils/rawContent";

const statusEl = document.getElementById("status") as HTMLDivElement;
const frameEl = document.getElementById("frame") as HTMLIFrameElement;
const lottieEl = document.getElementById("lottie") as HTMLDivElement;

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

async function renderHtmlPreview(ref: FileRef): Promise<void> {
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
}

async function renderLottiePreview(ref: FileRef): Promise<void> {
	const animationData = await loadLottieAnimation(ref);
	lottieEl.style.display = "flex";
	lottie.loadAnimation({
		container: lottieEl,
		renderer: "svg",
		loop: true,
		autoplay: true,
		animationData,
	});
}

async function main(): Promise<void> {
	const ref = parseFileRef(new URLSearchParams(location.search));
	if (!ref) {
		showError("Missing or invalid file reference.");
		return;
	}

	document.title = ref.path.split("/").pop() ?? "Diff Preview";

	try {
		if (isLottieFile(ref.path) || isJsonFile(ref.path)) {
			await renderLottiePreview(ref);
		} else {
			await renderHtmlPreview(ref);
		}
		statusEl.style.display = "none";
	} catch (err) {
		showError(
			`Failed to load preview: ${err instanceof Error ? err.message : String(err)}`,
		);
	}
}

main();
