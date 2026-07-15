const PREVIEW_BUTTON_CLASS = "diff-preview-btn";

const SELECTORS = {
	fileHeader: '[class*="DiffFileHeader-module__diff-file-header"]',
	fileName: '[class*="DiffFileHeader-module__file-name"]',
	diffEntry: '[class*="PullRequestDiffsList-module__diffEntry"]',
	diffContainer: '[class*="Diff-module__diff__"]',
	headerActions: ".flex-justify-end",
	moreOptionsButton: "button",
	viewFileLink: 'a[href*="/blob/"]',
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

type RepoInfo = {
	owner: string;
	repo: string;
};

function readJsonIslandData(): {
	diffContents: DiffContent[];
	repo: RepoInfo;
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

		return { diffContents, repo: { owner, repo } };
	}
	return null;
}

export function findFileHeaders(): HTMLElement[] {
	return Array.from(
		document.querySelectorAll<HTMLElement>(SELECTORS.fileHeader),
	);
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
	const lines = findDiffContent(header)?.diffLines;
	return lines?.length ? JSON.stringify(lines) : null;
}

/** Resolves the file reference from GitHub's page data only — no menu
 * fallback — so it's safe to call outside a user gesture. */
export function getFileRefSync(header: HTMLElement): FileRef | null {
	const entry = findDiffContent(header);
	if (!entry) return null;

	const sha = entry.newCommitOid ?? entry.oldCommitOid;
	if (!sha) return null;

	const data = readJsonIslandData();
	if (!data) return null;

	return {
		owner: data.repo.owner,
		repo: data.repo.repo,
		sha,
		path: entry.path,
	};
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
	const match = new URL(href, location.origin).pathname.match(
		/^\/([^/]+)\/([^/]+)\/blob\/([^/]+)\/(.+)$/,
	);
	if (!match) return null;

	const [, owner, repo, sha, path] = match;
	return { owner, repo, sha, path };
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
	const actions = header.querySelector<HTMLElement>(SELECTORS.headerActions);
	if (actions) {
		actions.insertAdjacentElement("afterbegin", button);
	} else {
		header.appendChild(button);
	}
}
