const STORAGE_KEY = "groupStackedPR";

const ROW_SELECTOR = 'div[id^="issue_"]';
const STACK_ICON_SELECTOR = ".octicon-stack";
const BASE_REF_SELECTOR = ".commit-ref.base-ref";
const COMMIT_REF_SELECTOR = ".commit-ref";

const HEADER_CLASS = "stack-pr-header";
const MEMBER_CLASS = "stack-pr-member";
const LAST_MEMBER_CLASS = "stack-pr-member-last";
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
 * Rows GitHub itself marks as part of a stack. Only these need a hovercard
 * fetch, which keeps the request count to the stacked PRs on the page.
 */
function listStackedRows(): HTMLElement[] {
	return listRows().filter((row) => row.querySelector(STACK_ICON_SELECTOR));
}

function repoPath(): string {
	return location.pathname.split("/").slice(1, 3).join("/");
}

/**
 * GitHub's hovercard partial is the cheapest authenticated source of a pull
 * request's base and head branch names — the PR list itself omits them.
 */
async function fetchRefs(number: number): Promise<PullRefs | null> {
	const response = await fetch(`/${repoPath()}/pull/${number}/hovercard`, {
		headers: { "x-requested-with": "XMLHttpRequest" },
	});
	if (!response.ok) return null;

	const doc = new DOMParser().parseFromString(
		await response.text(),
		"text/html",
	);
	const base = doc
		.querySelector<HTMLElement>(BASE_REF_SELECTOR)
		?.innerText.trim();
	const head = [...doc.querySelectorAll<HTMLElement>(COMMIT_REF_SELECTOR)]
		.map((el) => el.innerText.trim())
		.find((ref) => ref !== base);

	if (!base || !head) return null;
	return { number, base, head };
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
	// The header opens the card and the last member closes it, so a stack reads as
	// one block separated from the unrelated pull requests around it.
	style.textContent = `
		.${HEADER_CLASS} {
			display: flex;
			align-items: center;
			gap: 6px;
			margin-top: 12px;
			padding: 7px 16px;
			font-size: 12px;
			font-weight: 600;
			color: var(--fgColor-muted, #59636e);
			background: var(--bgColor-muted, #f6f8fa);
			border: 1px solid var(--borderColor-default, #d1d9e0);
			border-bottom: none;
			border-radius: 6px 6px 0 0;
			box-shadow: inset 3px 0 0 var(--borderColor-accent-emphasis, #0969da);
		}
		.${MEMBER_CLASS} {
			border-left: 1px solid var(--borderColor-default, #d1d9e0);
			border-right: 1px solid var(--borderColor-default, #d1d9e0);
			box-shadow: inset 3px 0 0 var(--borderColor-accent-emphasis, #0969da);
		}
		.${LAST_MEMBER_CLASS} {
			margin-bottom: 12px;
			border-bottom: 1px solid var(--borderColor-default, #d1d9e0);
			border-radius: 0 0 6px 6px;
		}
		.${MEMBER_CLASS} .${MEMBER_CLASS}-position {
			display: inline-block;
			min-width: 1.4em;
			margin-right: 4px;
			font-variant-numeric: tabular-nums;
			color: var(--fgColor-muted, #59636e);
		}
	`;
	document.head.append(style);
}

function buildHeader(stack: Stack): HTMLElement {
	const header = document.createElement("div");
	header.className = HEADER_CLASS;
	header.innerHTML = `
		<svg aria-hidden="true" height="14" viewBox="0 0 16 16" width="14" fill="currentColor">
			<path d="M7.122.392a1.75 1.75 0 0 1 1.756 0l5.003 2.902c.83.481.83 1.68 0 2.162L8.878 8.358a1.75 1.75 0 0 1-1.756 0L2.119 5.456a1.25 1.25 0 0 1 0-2.162Z"></path>
			<path d="M1.235 8.354a.75.75 0 0 1 1.024-.273L8 11.416l5.741-3.335a.75.75 0 1 1 .756 1.297l-6.119 3.556a.75.75 0 0 1-.756 0L1.503 9.378a.75.75 0 0 1-.268-1.024Z"></path>
		</svg>
		<span>Stack #${stack.rootNumber}</span>
		<span>· ${stack.members.length} PRs</span>
	`;
	return header;
}

function decorate(row: HTMLElement, position: number): void {
	row.classList.add(MEMBER_CLASS);

	const title = row.querySelector<HTMLElement>(
		'a[id^="issue_"][data-hovercard-type="pull_request"]',
	);
	if (
		!title ||
		title.previousElementSibling?.classList.contains(`${MEMBER_CLASS}-position`)
	)
		return;

	const marker = document.createElement("span");
	marker.className = `${MEMBER_CLASS}-position`;
	marker.textContent = `${position}.`;
	title.before(marker);
}

/**
 * Moves each stack's members so they sit together in base-to-top order,
 * anchored at whichever member GitHub already placed highest in the list.
 */
function reorder(stacks: Stack[]): void {
	for (const stack of stacks) {
		const rows = new Map(
			listRows().map((row) => [rowNumber(row), row] as const),
		);
		const memberRows = stack.members
			.map((member) => rows.get(member.number))
			.filter((row): row is HTMLElement => Boolean(row));
		if (memberRows.length < 2) continue;

		const anchor = memberRows.reduce((highest, row) =>
			row.compareDocumentPosition(highest) & Node.DOCUMENT_POSITION_FOLLOWING
				? row
				: highest,
		);

		// The header stays put while the member rows move, so inserting before it
		// keeps a stable reference — `anchor.before(anchor)` would be a no-op and
		// would leave the anchor stranded out of order.
		const header = buildHeader(stack);
		anchor.before(header);
		for (const [index, row] of memberRows.entries()) {
			header.before(row);
			decorate(row, index + 1);
		}
		// Members were inserted above the header; move it back to the top.
		memberRows[0].before(header);
		memberRows[memberRows.length - 1].classList.add(LAST_MEMBER_CLASS);
	}
}

function clearDecoration(): void {
	for (const header of document.querySelectorAll(`.${HEADER_CLASS}`))
		header.remove();
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

	const signature = listRows().map(rowNumber).join(",");
	if (!signature || signature === lastSignature) return;

	applying = true;
	try {
		clearDecoration();

		if (!(await getEnabled())) {
			lastSignature = signature;
			return;
		}

		const stackedNumbers = listStackedRows().map(rowNumber);
		if (stackedNumbers.length < 2) {
			lastSignature = signature;
			return;
		}

		const refs = (await Promise.all(stackedNumbers.map(fetchRefs))).filter(
			(pull): pull is PullRefs => pull !== null,
		);
		injectStyle();
		reorder(buildStacks(refs));
		lastSignature = listRows().map(rowNumber).join(",");
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
