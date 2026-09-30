/**
 * The PR list exists in two shapes: the classic server-rendered rows and the
 * React list GitHub is rolling out. Everything that differs between them is
 * isolated here so the grouping logic works on rows, not on markup.
 */

const CLASSIC_ROW_SELECTOR = 'div[id^="issue_"]';
const NEW_ROW_SELECTOR = 'li[class*="PullsListItem-module__listItem"]';

const STACK_ICON_SELECTOR = ".octicon-stack";
const CLASSIC_TITLE_SELECTOR =
	'a[id^="issue_"][data-hovercard-type="pull_request"]';
const NEW_TITLE_SELECTOR = '[data-testid="listitem-title-link"]';

const CLASSIC_PAGE_LINK_SELECTOR = '.paginate-container a[href*="page="]';
const NEW_PAGE_LINK_SELECTOR = 'nav[aria-label="Pagination"] a[href*="page="]';

export function isNewList(root: ParentNode = document): boolean {
	return root.querySelector(NEW_ROW_SELECTOR) !== null;
}

export function rowSelector(root: ParentNode = document): string {
	return isNewList(root) ? NEW_ROW_SELECTOR : CLASSIC_ROW_SELECTOR;
}

export function listRows(root: ParentNode = document): HTMLElement[] {
	return [...root.querySelectorAll<HTMLElement>(rowSelector(root))];
}

/** The row's PR number, or null when the row isn't one we can identify. */
export function rowNumber(row: HTMLElement): number | null {
	if (row.id.startsWith("issue_")) return Number(row.id.replace("issue_", ""));

	const href = row
		.querySelector<HTMLAnchorElement>(NEW_TITLE_SELECTOR)
		?.getAttribute("href");
	const match = href?.match(/\/pull\/(\d+)/);
	return match ? Number(match[1]) : null;
}

/**
 * Rows GitHub itself marks as part of a stack. Only these need a hovercard
 * fetch, which keeps the request count to the stacked PRs on the page.
 */
export function listStackedRows(root: ParentNode = document): HTMLElement[] {
	return listRows(root).filter((row) => row.querySelector(STACK_ICON_SELECTOR));
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
