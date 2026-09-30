// Page-side check for this extension; bundled and run by scripts/check.mjs.
({
	applies: (url) => /\/pull\/\d+\/(files|changes)/.test(url.pathname),
	async run({ $$, waitFor }) {
		return {
			markup: {
				insertTarget:
					$$(
						'[class*="ViewedFileProgress-module__ProgressContainer"], .pr-review-tools > div:has(#copilot-diff-header-button), .diffbar-item.hide-md.hide-sm',
					).length > 0,
				viewedCount:
					$$('[class*="FilesCountText"], .diffbar-item.hide-md.hide-sm')
						.length > 0,
			},
			injected: {
				button: await waitFor(() => $$("#uncheck-viewed-btn").length > 0),
			},
		};
	},
});
