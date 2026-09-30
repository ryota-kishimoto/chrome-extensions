#!/usr/bin/env node
/**
 * Bundles each extension's check.js into one snippet to run in the page:
 *
 *   node scripts/check.mjs              # every extension
 *   node scripts/check.mjs stack-pr     # only the named ones
 *
 * Paste the output into DevTools, or pass it to Claude in Chrome's
 * javascript tool. Extensions that don't target the current page are skipped.
 *
 * Each check.js is a single object expression — `applies(url)` and
 * `run({ $$, waitFor })` returning `markup` (does GitHub still render what the
 * extension reads?) and `injected` (did the extension do its job?). They are
 * inlined rather than imported because the page can't load files from here,
 * and GitHub's CSP forbids injecting a <script> that could.
 */
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const root = join(import.meta.dirname, "..", "extensions");
const requested = process.argv.slice(2);
const names = (requested.length > 0 ? requested : readdirSync(root)).filter(
	(name) => existsSync(join(root, name, "check.js")),
);
const missing = requested.filter((name) => !names.includes(name));
if (missing.length > 0) {
	console.error(`No check.js for: ${missing.join(", ")}`);
	process.exit(1);
}
// Every extension is expected to ship a check, so a new one without it is
// flagged here rather than silently left out of the bundle.
const unchecked = readdirSync(root).filter(
	(name) =>
		existsSync(join(root, name, "package.json")) &&
		!existsSync(join(root, name, "check.js")),
);
if (requested.length === 0 && unchecked.length > 0)
	console.error(`Warning: no check.js in ${unchecked.join(", ")}`);

const checks = names
	.map((name) => {
		// Biome formats the file as an expression statement, so the trailing `;`
		// has to go before the object can sit inside a literal.
		const body = readFileSync(join(root, name, "check.js"), "utf8")
			.trim()
			.replace(/;$/, "");
		return `${JSON.stringify(name)}: ${body},`;
	})
	.join("\n");

console.log(`await (async () => {
	// Extensions work asynchronously after the page settles, so give them a
	// moment before judging that they did nothing.
	const WAIT_MS = 8000;
	const $$ = (selector) => [...document.querySelectorAll(selector)];
	const waitFor = async (predicate) => {
		const deadline = Date.now() + WAIT_MS;
		while (Date.now() < deadline) {
			if (predicate()) return true;
			await new Promise((resolve) => setTimeout(resolve, 250));
		}
		return predicate();
	};
	const checks = {
${checks}
	};

	const report = {};
	for (const [name, check] of Object.entries(checks)) {
		if (!check.applies(new URL(location.href))) continue;
		const result = await check.run({ $$, waitFor });
		const failed = Object.entries({ ...result.markup, ...result.injected })
			.filter(([, ok]) => !ok)
			.map(([key]) => key);
		report[name] = { ok: failed.length === 0, failed, ...result };
	}
	return Object.keys(report).length > 0
		? report
		: "No extension targets this page. Open a PR list or a PR's Files tab.";
})();`);
