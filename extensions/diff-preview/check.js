// Page-side check for this extension; bundled and run by scripts/check.mjs.
({
	applies: (url) => /\/pull\/\d+\/(files|changes)/.test(url.pathname),
	async run({ $$, waitFor }) {
		const HEADER =
			'[class*="DiffFileHeader-module__diff-file-header"], div.file.js-file .file-header[data-path]';
		await waitFor(() => $$(HEADER).length > 0);
		const headers = $$(HEADER);
		// Lottie detection needs the file contents, so only HTML files give a
		// certain expectation of a Preview button.
		const html = headers.filter((header) =>
			/\.html?$/i.test(
				header.getAttribute("data-path") ??
					header.querySelector('[class*="DiffFileHeader-module__file-name"]')
						?.textContent ??
					"",
			),
		);
		return {
			markup: {
				fileHeaders: headers.length > 0,
				headerActions: headers.every((header) =>
					header.querySelector(".flex-justify-end, .file-actions"),
				),
			},
			injected: {
				previewButtons:
					html.length === 0 ||
					(await waitFor(() => $$(".diff-preview-btn").length > 0)),
			},
			info: { files: headers.length, htmlFiles: html.length },
		};
	},
});
