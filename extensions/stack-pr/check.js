// Page-side check for this extension; bundled and run by scripts/check.mjs.
({
	applies: (url) => /^\/[^/]+\/[^/]+\/pulls$/.test(url.pathname),
	async run({ $$, waitFor }) {
		const ROW =
			'div[id^="issue_"], li[class*="PullsListItem-module__listItem"]';
		await waitFor(() => $$(ROW).length > 0);
		const rows = $$(ROW);
		const stacked = rows.filter((row) => row.querySelector(".octicon-stack"));
		return {
			markup: {
				rows: rows.length > 0,
				titleLinks: rows.every((row) =>
					row.querySelector(
						'a[id^="issue_"][data-hovercard-type="pull_request"], [data-testid="listitem-title-link"]',
					),
				),
			},
			// A lone stacked row whose chain lives on other pages may legitimately
			// produce no header, so only a missing header with two or more stacked
			// rows is treated as a failure.
			injected: {
				headers:
					stacked.length < 2 ||
					(await waitFor(() => $$(".stack-pr-header").length > 0)),
			},
			info: { rows: rows.length, stackedRows: stacked.length },
		};
	},
});
