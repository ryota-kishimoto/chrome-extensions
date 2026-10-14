/**
 * The PR list exists in two shapes: the classic server-rendered rows and the
 * React list GitHub is rolling out. Everything that differs between them is
 * isolated here so the grouping logic works on rows, not on markup.
 */

const CLASSIC_ROW_SELECTOR = 'div[id^="issue_"]';

const STACK_ICON_SELECTOR = ".octicon-stack";
const CLASSIC_TITLE_SELECTOR =
	'a[id^="issue_"][data-hovercard-type="pull_request"]';
const NEW_TITLE_SELECTOR = '[data-testid="listitem-title-link"]';

const CLASSIC_PAGE_LINK_SELECTOR = '.paginate-container a[href*="page="]';
const NEW_PAGE_LINK_SELECTOR = 'nav[aria-label="Pagination"] a[href*="page="]';

/**
 * The new list's row is found from its title link rather than by selecting the
 * row: its class names are CSS-module hashes that change between deploys,
 * while `data-testid` is stable.
 */
export function listRows(root: ParentNode = document): HTMLElement[] {
	const classic = root.querySelectorAll<HTMLElement>(CLASSIC_ROW_SELECTOR);
	if (classic.length > 0) return [...classic];

	return [...root.querySelectorAll(NEW_TITLE_SELECTOR)].flatMap((link) => {
		const row = link.closest<HTMLElement>("li");
		return row ? [row] : [];
	});
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
