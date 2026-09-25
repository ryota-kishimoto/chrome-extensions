/**
 * The PR list exists in two shapes: the classic server-rendered rows and the
 * React list GitHub is rolling out. Everything that differs between them is
 * isolated here so the grouping logic works on rows, not on markup.
 */

const CLASSIC_ROW_SELECTOR = 'div[id^="issue_"]';
const NEW_ROW_SELECTOR = 'li[class*="PullsListItem-module__listItem"]';

const CLASSIC_STACK_ICON_SELECTOR = ".octicon-stack";
const CLASSIC_TITLE_SELECTOR =
	'a[id^="issue_"][data-hovercard-type="pull_request"]';
const NEW_TITLE_SELECTOR = '[data-testid="listitem-title-link"]';

const CLASSIC_PAGE_LINK_SELECTOR = '.paginate-container a[href*="page="]';
const NEW_PAGE_LINK_SELECTOR = 'nav[aria-label="Pagination"] a[href*="page="]';

/** The per-PR data the React list hangs off each row's fiber. */
type ReactPull = {
	number: number;
	stackSize: number | null;
};

export function isNewList(root: ParentNode = document): boolean {
	return root.querySelector(NEW_ROW_SELECTOR) !== null;
}

export function rowSelector(root: ParentNode = document): string {
	return isNewList(root) ? NEW_ROW_SELECTOR : CLASSIC_ROW_SELECTOR;
}

export function listRows(root: ParentNode = document): HTMLElement[] {
	return [...root.querySelectorAll<HTMLElement>(rowSelector(root))];
}

/**
 * React keeps the row's props on the fiber rather than in the DOM, so the PR
 * number and stack membership are read from there. Walking up is needed
 * because the props live on an ancestor component, not on the <li> itself.
 */
function reactPull(row: HTMLElement): ReactPull | null {
	const key = Object.keys(row).find((k) => k.startsWith("__reactFiber"));
	if (!key) return null;

	let node = (
		row as unknown as Record<
			string,
			{ memoizedProps?: { pull?: ReactPull }; return?: unknown }
		>
	)[key];
	for (let depth = 0; node && depth < 30; depth++) {
		const pull = node.memoizedProps?.pull;
		if (pull) return pull;
		node = node.return as typeof node;
	}
	return null;
}

/** The row's PR number, or null when the row isn't one we can identify. */
export function rowNumber(row: HTMLElement): number | null {
	if (row.id.startsWith("issue_")) return Number(row.id.replace("issue_", ""));

	const fromReact = reactPull(row)?.number;
	if (typeof fromReact === "number") return fromReact;

	// Falls back to the title link so a props shape change only costs the
	// stack filter below, not the ability to see rows at all.
	const href = row
		.querySelector<HTMLAnchorElement>(NEW_TITLE_SELECTOR)
		?.getAttribute("href");
	const match = href?.match(/\/pull\/(\d+)/);
	return match ? Number(match[1]) : null;
}

/**
 * Rows GitHub itself marks as part of a stack. Only these need a hovercard
 * fetch, which keeps the request count to the stacked PRs on the page.
 *
 * The classic list shows an icon; the React list drops it and exposes
 * `stackSize` on the row's props instead. When neither is available the page
 * gives no way to tell, so every row is treated as a candidate rather than
 * silently grouping nothing.
 */
export function listStackedRows(root: ParentNode = document): HTMLElement[] {
	const rows = listRows(root);
	if (!isNewList(root))
		return rows.filter((row) => row.querySelector(CLASSIC_STACK_ICON_SELECTOR));

	const marked = rows.filter((row) => reactPull(row)?.stackSize != null);
	return marked.length > 0 || rows.every((row) => reactPull(row) !== null)
		? marked
		: rows;
}

export function titleLink(row: HTMLElement): HTMLElement | null {
	return (
		row.querySelector<HTMLElement>(CLASSIC_TITLE_SELECTOR) ??
		row.querySelector<HTMLElement>(NEW_TITLE_SELECTOR)
	);
}

export function listPageLinks(): HTMLAnchorElement[] {
	return [
		...document.querySelectorAll<HTMLAnchorElement>(
			`${CLASSIC_PAGE_LINK_SELECTOR}, ${NEW_PAGE_LINK_SELECTOR}`,
		),
	];
}
