const PREVIEW_BUTTON_CLASS = "diff-preview-btn";

// The Files tab exists in two shapes: the React diff GitHub is rolling out and
// the classic server-rendered one it still falls back to. Both are matched so a
// switch either way doesn't take the button away.
const SELECTORS = {
	fileHeader: '[class*="DiffFileHeader-module__diff-file-header"]',
	fileName: '[class*="DiffFileHeader-module__file-name"]',
	diffEntry: '[class*="PullRequestDiffsList-module__diffEntry"]',
	diffContainer: '[class*="Diff-module__diff__"]',
	headerActions: ".flex-justify-end",
	moreOptionsButton: "button",
	viewFileLink: 'a[href*="/blob/"]',
	classicFileHeader: "div.file.js-file .file-header[data-path]",
	classicFileActions: ".file-actions",
} as const;

// GitHub wraps file path text in U+200E (LRM) marks; strip them before use.
const BIDI_MARK_RE = /[‎‏]/g;

export type FileRef = {
	owner: string;
	repo: string;
	sha: string;
	path: string;
};

type DiffContent = {
	path: string;
	pathDigest: string;
	oldCommitOid: string | null;
	newCommitOid: string | null;
	status: string;
	diffLines?: unknown[];
};

type DiffSummary = {
	path: string;
	pathDigest: string;
	changeType?: string;
};

type RepoInfo = {
	owner: string;
	repo: string;
};

function readJsonIslandData(): {
	diffContents: DiffContent[];
	diffSummaries: DiffSummary[];
	repo: RepoInfo;
	baseOid: string | null;
	headOid: string | null;
} | null {
	const scripts = document.querySelectorAll<HTMLScriptElement>(
		'script[type="application/json"]',
	);
	for (const script of scripts) {
		let data: unknown;
		try {
			data = JSON.parse(script.textContent ?? "");
		} catch {
			continue;
		}
		const route = (data as Record<string, unknown>)?.payload as
			| Record<string, unknown>
			| undefined;
		const changesRoute = route?.pullRequestsChangesRoute as
			| Record<string, unknown>
			| undefined;
		if (!changesRoute) continue;

		const repository = changesRoute.repository as
			| Record<string, unknown>
			| undefined;
		const pullRequest = changesRoute.pullRequest as
			| Record<string, unknown>
			| undefined;
		const diffContents = changesRoute.diffContents as DiffContent[] | undefined;
		if (!repository || !diffContents) continue;

		const owner =
			(pullRequest?.headRepositoryOwnerLogin as string | undefined) ??
			(repository.ownerLogin as string);
		const repo =
			(pullRequest?.headRepositoryName as string | undefined) ??
			(repository.name as string);

		const fullDiff = (
			changesRoute.comparison as Record<string, unknown> | undefined
		)?.fullDiff as Record<string, unknown> | undefined;

		return {
			diffContents,
			diffSummaries:
				(changesRoute.diffSummaries as DiffSummary[] | undefined) ?? [],
			repo: { owner, repo },
			baseOid: (fullDiff?.baseOid as string | undefined) ?? null,
			headOid: (fullDiff?.headOid as string | undefined) ?? null,
		};
	}
	return null;
}

export function findFileHeaders(): HTMLElement[] {
	return Array.from(
		document.querySelectorAll<HTMLElement>(
			`${SELECTORS.fileHeader}, ${SELECTORS.classicFileHeader}`,
		),
	);
}

/** Classic headers carry the untruncated path, so they need no JSON island. */
function classicPath(header: HTMLElement): string | null {
	return header.getAttribute("data-path");
}

function findDiffEntry(header: HTMLElement): HTMLElement | null {
	return header.closest<HTMLElement>(SELECTORS.diffEntry);
}

function findDiffContainer(header: HTMLElement): HTMLElement | null {
	return (
		findDiffEntry(header)?.querySelector<HTMLElement>(
			SELECTORS.diffContainer,
		) ?? null
	);
}

/** The file's path as displayed in the header. Long paths come back
 * prefix-truncated ("…/foo/bar.json"), so only rely on the suffix — for the
 * real path use getFileRef. */
export function getFilePath(header: HTMLElement): string | null {
	const classic = classicPath(header);
	if (classic) return classic;

	const nameEl = header.querySelector<HTMLElement>(SELECTORS.fileName);
	if (!nameEl) return null;

	// Skip the sr-only "old renamed to new" text; the visible span wraps each
	// path in U+200E marks, and a rename shows "old → new", so the file's
	// current path is the last marked segment.
	const visible =
		nameEl.querySelector<HTMLElement>('[aria-hidden="true"]') ?? nameEl;
	const segments = (visible.textContent ?? "")
		.split(BIDI_MARK_RE)
		.map((s) => s.trim())
		.filter(Boolean);
	return segments.at(-1) ?? null;
}

function findDiffContent(header: HTMLElement): DiffContent | null {
	const container = findDiffContainer(header);
	const pathDigest = container?.id?.replace(/^diff-/, "");
	if (!pathDigest) return null;
	return (
		readJsonIslandData()?.diffContents.find(
			(d) => d.pathDigest === pathDigest,
		) ?? null
	);
}

/** The file's diff text as inlined into GitHub's page data, or null when the
 * page doesn't carry it (file not inlined, or diff too big / binary). */
export function getDiffText(header: HTMLElement): string | null {
	if (classicPath(header)) {
		// The classic diff is already in the page as table rows; its added lines
		// are enough to spot a Lottie without a fetch. A collapsed diff ("Large
		// diffs are not rendered by default") has no such rows, and returning its
		// placeholder text would read as a diff that simply isn't a Lottie —
		// exactly the big animation files the fetch fallback exists for.
		const lines = header
			.closest("div.file")
			?.querySelectorAll(".js-file-content .blob-code-addition");
		if (!lines?.length) return null;
		return [...lines].map((line) => line.textContent ?? "").join("\n") || null;
	}

	const lines = findDiffContent(header)?.diffLines;
	return lines?.length ? JSON.stringify(lines) : null;
}

/** Resolves the file reference from GitHub's page data only — no menu
 * fallback — so it's safe to call outside a user gesture. */
export function getFileRefSync(header: HTMLElement): FileRef | null {
	const classic = classicRef(header);
	if (classic) return classic;

	const container = findDiffContainer(header);
	const pathDigest = container?.id?.replace(/^diff-/, "");
	if (!pathDigest) return null;

	const data = readJsonIslandData();
	if (!data) return null;

	// diffContents carries per-file commit oids, but only for the first batch
	// of files GitHub inlines. diffSummaries lists every file in the PR, so
	// fall back to it with the comparison's overall head (or, for deletions,
	// base) commit.
	const entry = data.diffContents.find((d) => d.pathDigest === pathDigest);
	const entrySha = entry ? (entry.newCommitOid ?? entry.oldCommitOid) : null;
	if (entry && entrySha) {
		return {
			owner: data.repo.owner,
			repo: data.repo.repo,
			sha: entrySha,
			path: entry.path,
		};
	}

	const summary = data.diffSummaries.find((d) => d.pathDigest === pathDigest);
	if (!summary) return null;
	const sha = summary.changeType === "DELETED" ? data.baseOid : data.headOid;
	if (!sha) return null;

	return {
		owner: data.repo.owner,
		repo: data.repo.repo,
		sha,
		path: summary.path,
	};
}

function parseBlobHref(href: string): FileRef | null {
	const match = new URL(href, location.origin).pathname.match(
		/^\/([^/]+)\/([^/]+)\/blob\/([^/]+)\/(.+)$/,
	);
	if (!match) return null;
	const [, owner, repo, sha, path] = match;
	return { owner, repo, sha, path: decodeURIComponent(path) };
}

/** The classic header links straight to the blob, so owner/repo/sha/path all
 * come from one anchor — no page data and no menu to open. The header can hold
 * more than one blob link (a CODEOWNERS link sits beside the file's own), and
 * only the file's own carries its commit sha, so it's matched on the path. */
function classicRef(header: HTMLElement): FileRef | null {
	const path = classicPath(header);
	if (!path) return null;

	for (const link of header.querySelectorAll<HTMLAnchorElement>(
		SELECTORS.viewFileLink,
	)) {
		const href = link.getAttribute("href");
		const ref = href ? parseBlobHref(href) : null;
		if (ref?.path === path) return ref;
	}
	return null;
}

/**
 * Fallback for files GitHub didn't inline into the JSON island (e.g. large PRs).
 * Briefly opens the header's "More options" menu to read the "View file" link,
 * then closes it via Escape without ever dispatching a body click.
 */
async function getFileRefFromMenu(
	header: HTMLElement,
): Promise<FileRef | null> {
	const moreBtn = Array.from(
		header.querySelectorAll<HTMLButtonElement>(SELECTORS.moreOptionsButton),
	).find((b) => {
		const labelledBy = b.getAttribute("aria-labelledby");
		const label = labelledBy
			? document.getElementById(labelledBy)?.textContent?.trim()
			: null;
		return label === "More options";
	});
	if (!moreBtn) return null;

	moreBtn.click();
	await new Promise((r) => setTimeout(r, 150));

	// The menu renders in a body-level portal, so this assumes only one menu is open at a time.
	const link = document.querySelector<HTMLAnchorElement>(
		SELECTORS.viewFileLink,
	);
	const href = link?.getAttribute("href");

	document.dispatchEvent(
		new KeyboardEvent("keydown", {
			key: "Escape",
			bubbles: true,
			cancelable: true,
		}),
	);

	if (!href) return null;
	return parseBlobHref(href);
}

export async function getFileRef(header: HTMLElement): Promise<FileRef | null> {
	return getFileRefSync(header) ?? (await getFileRefFromMenu(header));
}

export function findPreviewButton(
	header: HTMLElement,
): HTMLButtonElement | null {
	return header.querySelector<HTMLButtonElement>(
		`button.${PREVIEW_BUTTON_CLASS}`,
	);
}

export function createPreviewButton(
	onClick: (button: HTMLButtonElement) => void,
): HTMLButtonElement {
	const btn = document.createElement("button");
	btn.type = "button";
	btn.className = PREVIEW_BUTTON_CLASS;
	btn.textContent = "Preview";
	btn.title = "Open rendered preview in a new tab";
	btn.addEventListener("click", (e) => {
		e.preventDefault();
		e.stopPropagation();
		onClick(btn);
	});
	return btn;
}

/** Briefly flashes the button to confirm the click registered. */
export function flashButton(button: HTMLButtonElement): void {
	button.classList.add("diff-preview-btn--flash");
	setTimeout(() => button.classList.remove("diff-preview-btn--flash"), 300);
}

export function insertPreviewButton(
	header: HTMLElement,
	button: HTMLButtonElement,
): void {
	// Classic .file-actions is a block, so prepending there would stack the
	// button above Viewed instead of beside it; the flex row inside it is what
	// lays the controls out in a line.
	const actions =
		header.querySelector<HTMLElement>(SELECTORS.headerActions) ??
		header.querySelector<HTMLElement>(SELECTORS.classicFileActions);
	if (actions) {
		actions.insertAdjacentElement("afterbegin", button);
	} else {
		header.appendChild(button);
	}
}
