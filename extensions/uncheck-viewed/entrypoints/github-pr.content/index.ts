import "./style.css";

export default defineContentScript({
	matches: [
		"https://github.com/*/pull/*/files*",
		"https://github.com/*/pull/*/changes*",
	],
	runAt: "document_idle",

	main(ctx) {
		const BUTTON_ID = "uncheck-viewed-btn";

		function findViewedButtons(): HTMLElement[] {
			// New UI (2025~): aria-pressed toggle buttons
			const buttons = document.querySelectorAll<HTMLElement>(
				'button[aria-label="Viewed"][aria-pressed="true"]',
			);
			if (buttons.length > 0) {
				return Array.from(buttons);
			}

			// Fallback: old UI with checkbox
			const checkboxes = document.querySelectorAll<HTMLInputElement>(
				".js-reviewed-checkbox:checked",
			);
			return Array.from(checkboxes);
		}

		async function uncheckAllViewed() {
			const button = document.getElementById(BUTTON_ID);
			if (!button) return;

			button.textContent = "Unchecking...";
			button.setAttribute("disabled", "");

			try {
				const viewed = findViewedButtons();

				for (const el of viewed) {
					el.scrollIntoView({ block: "center", behavior: "instant" });
					// Small delay for virtualized lists to render
					await new Promise((r) => setTimeout(r, 100));
					el.click();
					await new Promise((r) => setTimeout(r, 150));
				}

				// Retry: scroll and check if more appeared
				await new Promise((r) => setTimeout(r, 500));
				const remaining = findViewedButtons();
				for (const el of remaining) {
					el.scrollIntoView({ block: "center", behavior: "instant" });
					await new Promise((r) => setTimeout(r, 100));
					el.click();
					await new Promise((r) => setTimeout(r, 150));
				}

				const finalCount = findViewedButtons().length;
				button.textContent =
					finalCount === 0
						? "Uncheck All Viewed"
						: `Uncheck All Viewed (${finalCount} remaining)`;
			} catch (e) {
				console.error("[uncheck-viewed]", e);
				button.textContent = "Error - Retry";
			} finally {
				button.removeAttribute("disabled");
			}
		}

		function insertButton() {
			if (document.getElementById(BUTTON_ID)) return;

			// Insert before the "X/Y viewed" progress indicator
			const viewedProgress = document.querySelector<HTMLElement>(
				'[class*="ViewedFileProgress-module__ProgressContainer"]',
			);

			if (!viewedProgress) return;

			const btn = document.createElement("button");
			btn.id = BUTTON_ID;
			btn.type = "button";
			btn.className = "uncheck-viewed-btn";
			btn.textContent = "Uncheck All Viewed";
			btn.addEventListener("click", uncheckAllViewed);

			viewedProgress.insertAdjacentElement("afterend", btn);
		}

		// Initial insertion
		insertButton();

		// SPA navigation: observe DOM changes to re-insert button
		const observer = new MutationObserver(() => {
			if (
				window.location.pathname.match(/\/pull\/\d+\/(files|changes)/) &&
				!document.getElementById(BUTTON_ID)
			) {
				insertButton();
			}
		});

		observer.observe(document.body, { childList: true, subtree: true });
		ctx.onInvalidated(() => observer.disconnect());
	},
});
