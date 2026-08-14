const STORAGE_KEY = "groupStackedPR";

const ROW_SELECTOR = 'div[id^="issue_"]';
const STACK_ICON_SELECTOR = ".octicon-stack";
const BASE_REF_SELECTOR = ".commit-ref.base-ref";
const COMMIT_REF_SELECTOR = ".commit-ref";
const PAGE_LINK_SELECTOR = '.paginate-container a[href*="page="]';

const HEADER_CLASS = "stack-pr-header";
const MEMBER_CLASS = "stack-pr-member";
const LAST_MEMBER_CLASS = "stack-pr-member-last";
const IMPORTED_CLASS = "stack-pr-imported";
const STYLE_ID = "stack-pr-style";

/** base/head branch names of a single pull request. */
type PullRefs = {
	number: number;
	base: string;
	head: string;
};

type Stack = {
	/** Pull request closest to the base branch, used as the stack's identity. */
	rootNumber: number;
	/** Members ordered from the base branch upwards. */
	members: PullRefs[];
};

function rowNumber(row: HTMLElement): number {
	return Number(row.id.replace("issue_", ""));
}

function listRows(): HTMLElement[] {
	return [...document.querySelectorAll<HTMLElement>(ROW_SELECTOR)];
}

/**
 * Identity of the list GitHub itself rendered. Imported rows are excluded so
 * the signature is unchanged by our own edits and by clearing them again —
 * otherwise toggling the extension off would look like a fresh navigation.
 */
function pageSignature(): string {
	return listRows()
		.filter((row) => !row.classList.contains(IMPORTED_CLASS))
		.map(rowNumber)
		.join(",");
}

/**
 * Rows GitHub itself marks as part of a stack. Only these need a hovercard
 * fetch, which keeps the request count to the stacked PRs on the page.
 */
function listStackedRows(root: ParentNode): HTMLElement[] {
	return [...root.querySelectorAll<HTMLElement>(ROW_SELECTOR)].filter((row) =>
		row.querySelector(STACK_ICON_SELECTOR),
	);
}

function repoPath(): string {
	return location.pathname.split("/").slice(1, 3).join("/");
}

async function fetchDocument(url: string): Promise<Document | null> {
	const response = await fetch(url, {
		headers: { "x-requested-with": "XMLHttpRequest" },
	});
	if (!response.ok) return null;
	return new DOMParser().parseFromString(await response.text(), "text/html");
}

/**
 * GitHub's hovercard partial is the cheapest authenticated source of a pull
 * request's base and head branch names — the PR list itself omits them.
 */
async function fetchRefs(number: number): Promise<PullRefs | null> {
	const doc = await fetchDocument(`/${repoPath()}/pull/${number}/hovercard`);
	if (!doc) return null;

	const base = doc
		.querySelector<HTMLElement>(BASE_REF_SELECTOR)
		?.innerText.trim();
	const head = [...doc.querySelectorAll<HTMLElement>(COMMIT_REF_SELECTOR)]
		.map((el) => el.innerText.trim())
		.find((ref) => ref !== base);

	if (!base || !head) return null;
	return { number, base, head };
}

function currentPage(): number {
	return Number(new URLSearchParams(location.search).get("page") ?? "1");
}

/**
 * Every page of the list. GitHub's pager links the last page as well as the
 * neighbouring ones, so reading the current page's links is enough to know the
 * full range.
 */
function listPageNumbers(): number[] {
	const pages = [
		...document.querySelectorAll<HTMLAnchorElement>(PAGE_LINK_SELECTOR),
	].map((link) =>
		Number(new URL(link.href, location.origin).searchParams.get("page") ?? "1"),
	);
	const last = Math.max(currentPage(), ...pages.filter(Number.isFinite));
	return Array.from({ length: last }, (_, index) => index + 1);
}

/**
 * Keeps every filter (`q`, label, sort) from the current URL so the fetched
 * pages describe the same list the user is looking at.
 */
function pageUrl(page: number): string {
	const params = new URLSearchParams(location.search);
	params.set("page", String(page));
	return `${location.pathname}?${params}`;
}

/** A stacked row found on another page, kept so it can be imported later. */
type RemoteRow = {
	number: number;
	page: number;
	row: HTMLElement;
};

/** Stacked rows of one page, paired with the refs needed to chain them. */
type PageHarvest = {
	rows: RemoteRow[];
	refs: PullRefs[];
};

async function harvestPage(page: number): Promise<PageHarvest> {
	const doc = await fetchDocument(pageUrl(page));
	if (!doc) return { rows: [], refs: [] };

	const rows = listStackedRows(doc).map((row) => ({
		number: rowNumber(row),
		page,
		row,
	}));
	const refs = (
		await Promise.all(rows.map((row) => fetchRefs(row.number)))
	).filter((pull): pull is PullRefs => pull !== null);
	return { rows, refs };
}

/**
 * Stacked rows from every other page of the list. Chasing only the pages a
 * chain seems to reach into would still cost a probe in each direction — a
 * chain's outermost base and head are unmatched whether or not a neighbour
 * continues them — so the whole list is read instead.
 *
 * `local` is excluded because the list can shift between fetches: a PR already
 * on this page may also come back from another, and counting it twice both
 * inflates the chain and hides the fact that it is present here.
 */
async function fetchRemoteRows(local: Set<number>): Promise<PageHarvest> {
	const pages = listPageNumbers().filter((page) => page !== currentPage());
	const harvests = await Promise.all(pages.map(harvestPage));
	const seen = new Set(local);

	const rows: RemoteRow[] = [];
	const refs: PullRefs[] = [];
	for (const harvest of harvests) {
		const byNumber = new Map(harvest.refs.map((pull) => [pull.number, pull]));
		for (const row of harvest.rows) {
			const pull = byNumber.get(row.number);
			if (!pull || seen.has(row.number)) continue;
			seen.add(row.number);
			rows.push(row);
			refs.push(pull);
		}
	}
	return { rows, refs };
}

/**
 * Walks from a pull request down to the bottom of its chain by following
 * base → head links. `seen` guards against a cycle from a retargeted branch.
 */
function walkToRoot(
	pull: PullRefs,
	byHead: Map<string, PullRefs>,
): { root: PullRefs; depth: number } {
	let current = pull;
	let depth = 0;
	const seen = new Set<string>();

	while (byHead.has(current.base) && !seen.has(current.base)) {
		seen.add(current.base);
		current = byHead.get(current.base) as PullRefs;
		depth++;
	}
	return { root: current, depth };
}

/**
 * Reconstructs each stack by chaining base branches to head branches. A PR
 * whose base is another open PR's head sits directly on top of it.
 */
function buildStacks(pulls: PullRefs[]): Stack[] {
	const byHead = new Map(pulls.map((pull) => [pull.head, pull]));
	const depths = new Map<number, number>();
	const grouped = new Map<number, PullRefs[]>();

	for (const pull of pulls) {
		const { root, depth } = walkToRoot(pull, byHead);
		depths.set(pull.number, depth);
		const members = grouped.get(root.number) ?? [];
		members.push(pull);
		grouped.set(root.number, members);
	}

	return [...grouped.entries()]
		.filter(([, members]) => members.length > 1)
		.map(([rootNumber, members]) => ({
			rootNumber,
			members: members.sort(
				(a, b) => (depths.get(a.number) ?? 0) - (depths.get(b.number) ?? 0),
			),
		}));
}

function injectStyle(): void {
	if (document.getElementById(STYLE_ID)) return;

	const style = document.createElement("style");
	style.id = STYLE_ID;
	// The header opens a stack and a thick band under the last member closes it.
	// The band is deliberately heavier than a hairline: at GitHub's own border
	// weight the boundary reads as just another row separator.
	style.textContent = `
		.${HEADER_CLASS} {
			display: flex;
			align-items: center;
			gap: 6px;
			padding: 6px 16px;
			font-size: 12px;
			font-weight: 600;
			color: var(--fgColor-muted, #59636e);
			background: var(--bgColor-muted, #f6f8fa);
			border-top: 1px solid var(--borderColor-default, #d1d9e0);
		}
		.${MEMBER_CLASS} {
			box-shadow: inset 2px 0 0 var(--borderColor-accent-emphasis, #0969da);
		}
		.${LAST_MEMBER_CLASS} {
			border-bottom: 10px solid var(--borderColor-default, #d1d9e0);
		}
		.${MEMBER_CLASS} .${MEMBER_CLASS}-position {
			display: inline-block;
			min-width: 1.4em;
			margin-right: 4px;
			font-variant-numeric: tabular-nums;
			color: var(--fgColor-muted, #59636e);
		}
		/* Imported rows are real list rows on another page, so they are dimmed to
		   keep the current page's own contents readable as the page's contents. */
		.${IMPORTED_CLASS} {
			opacity: 0.62;
		}
		.${IMPORTED_CLASS}-badge {
			margin-left: 6px;
			padding: 0 5px;
			border: 1px solid var(--borderColor-default, #d1d9e0);
			border-radius: 10px;
			font-size: 10px;
			font-weight: 500;
			color: var(--fgColor-muted, #59636e);
		}
	`;
	document.head.append(style);
}

function buildHeader(
	stack: Stack,
	shownCount: number,
	importedCount: number,
): HTMLElement {
	const header = document.createElement("div");
	header.className = HEADER_CLASS;
	const imported =
		importedCount > 0 ? `<span>· ${importedCount} from other pages</span>` : "";
	header.innerHTML = `
		<svg aria-hidden="true" height="14" viewBox="0 0 16 16" width="14" fill="currentColor">
			<path d="M7.122.392a1.75 1.75 0 0 1 1.756 0l5.003 2.902c.83.481.83 1.68 0 2.162L8.878 8.358a1.75 1.75 0 0 1-1.756 0L2.119 5.456a1.25 1.25 0 0 1 0-2.162Z"></path>
			<path d="M1.235 8.354a.75.75 0 0 1 1.024-.273L8 11.416l5.741-3.335a.75.75 0 1 1 .756 1.297l-6.119 3.556a.75.75 0 0 1-.756 0L1.503 9.378a.75.75 0 0 1-.268-1.024Z"></path>
		</svg>
		<span>Stack #${stack.rootNumber}</span>
		<span>· ${shownCount} PRs</span>
		${imported}
	`;
	return header;
}

function titleLink(row: HTMLElement): HTMLElement | null {
	return row.querySelector<HTMLElement>(
		'a[id^="issue_"][data-hovercard-type="pull_request"]',
	);
}

function decorate(
	row: HTMLElement,
	position: number,
	page: number | null,
): void {
	row.classList.add(MEMBER_CLASS);

	const title = titleLink(row);
	if (
		!title ||
		title.previousElementSibling?.classList.contains(`${MEMBER_CLASS}-position`)
	)
		return;

	const marker = document.createElement("span");
	marker.className = `${MEMBER_CLASS}-position`;
	marker.textContent = `${position}.`;
	title.before(marker);

	if (page === null) return;
	row.classList.add(IMPORTED_CLASS);
	const badge = document.createElement("span");
	badge.className = `${IMPORTED_CLASS}-badge`;
	badge.textContent = `page ${page}`;
	title.after(badge);
}

/**
 * Moves each stack's members so they sit together in base-to-top order,
 * anchored at whichever member GitHub already placed highest in the list.
 * Members living on another page are imported so the whole chain is visible.
 */
function reorder(stacks: Stack[], remote: Map<number, RemoteRow>): void {
	for (const stack of stacks) {
		const rows = new Map(
			listRows().map((row) => [rowNumber(row), row] as const),
		);
		// A member absent from this page is imported from the page it lives on, so
		// the row keeps its real title, labels and links instead of being faked.
		const present = stack.members
			.map((member) => {
				const local = rows.get(member.number);
				if (local) return { row: local, page: null as number | null };
				const found = remote.get(member.number);
				if (!found) return null;
				return {
					row: document.importNode(found.row, true) as HTMLElement,
					page: found.page,
				};
			})
			.filter(
				(entry): entry is { row: HTMLElement; page: number | null } =>
					entry !== null,
			);

		// A stack whose members all live elsewhere belongs to the other page, not
		// this one; importing all of them would invent a group the user never
		// paged to. It is left for that page to render.
		const local = present.filter((entry) => entry.page === null);
		if (local.length === 0 || present.length < 2) continue;

		const anchor = local.reduce((highest, entry) =>
			entry.row.compareDocumentPosition(highest.row) &
			Node.DOCUMENT_POSITION_FOLLOWING
				? entry
				: highest,
		).row;

		// The header stays put while the member rows move, so inserting before it
		// keeps a stable reference — `anchor.before(anchor)` would be a no-op and
		// would leave the anchor stranded out of order.
		const importedCount = present.length - local.length;
		const header = buildHeader(stack, present.length, importedCount);
		anchor.before(header);
		for (const [index, entry] of present.entries()) {
			header.before(entry.row);
			decorate(entry.row, index + 1, entry.page);
		}
		// Members were inserted above the header; move it back to the top.
		present[0].row.before(header);
		present[present.length - 1].row.classList.add(LAST_MEMBER_CLASS);
	}
}

function clearDecoration(): void {
	for (const header of document.querySelectorAll(`.${HEADER_CLASS}`))
		header.remove();
	// Imported rows belong to another page, so they are removed outright rather
	// than merely undecorated.
	for (const row of document.querySelectorAll(`.${IMPORTED_CLASS}`))
		row.remove();
	for (const marker of document.querySelectorAll(`.${MEMBER_CLASS}-position`))
		marker.remove();
	for (const row of document.querySelectorAll(`.${MEMBER_CLASS}`))
		row.classList.remove(MEMBER_CLASS, LAST_MEMBER_CLASS);
}

async function getEnabled(): Promise<boolean> {
	const result = await browser.storage.local.get(STORAGE_KEY);
	return result[STORAGE_KEY] ?? true;
}

/** Guards against the MutationObserver reacting to our own reordering. */
let applying = false;
/** Signature of the row set we last grouped, so navigations re-run but our own edits do not. */
let lastSignature = "";

async function apply(): Promise<void> {
	if (applying) return;

	const signature = pageSignature();
	if (!signature || signature === lastSignature) return;

	applying = true;
	try {
		clearDecoration();

		if (!(await getEnabled())) {
			lastSignature = signature;
			return;
		}

		const localStacked = listStackedRows(document).map(rowNumber);
		if (localStacked.length === 0) {
			lastSignature = signature;
			return;
		}

		const localRefs = (await Promise.all(localStacked.map(fetchRefs))).filter(
			(pull): pull is PullRefs => pull !== null,
		);
		const remoteHarvest = await fetchRemoteRows(new Set(localStacked));
		const remote = new Map(
			remoteHarvest.rows.map((entry) => [entry.number, entry]),
		);

		injectStyle();
		reorder(buildStacks([...localRefs, ...remoteHarvest.refs]), remote);
		lastSignature = pageSignature();
	} finally {
		applying = false;
	}
}

export default defineContentScript({
	matches: ["https://github.com/*/*/pulls", "https://github.com/*/*/pulls?*"],
	runAt: "document_idle",

	async main(ctx) {
		await apply();

		const observer = new MutationObserver(() => {
			void apply();
		});
		observer.observe(document.body, { childList: true, subtree: true });
		ctx.onInvalidated(() => observer.disconnect());

		browser.storage.onChanged.addListener((changes) => {
			if (STORAGE_KEY in changes) {
				lastSignature = "";
				void apply();
			}
		});
	},
});
