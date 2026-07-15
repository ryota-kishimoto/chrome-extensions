# Diff Preview

A Chrome extension that adds a **Preview** button to HTML files on GitHub PR Files Changed tab, opening the rendered output in a new tab instead of just the raw diff.

Scoped to HTML only: GitHub's own "Preview" diff view already renders SVG, images, and Markdown natively (via the code/rendered toggle on each file header), so this extension focuses on the one format GitHub doesn't cover.

## Features

- Adds a **Preview** button to each HTML file's diff header
- Opens the file, fully rendered with scripts and relative assets working, in a new tab
- Works with GitHub's SPA navigation and its React-based "Preview" Files Changed view
- Works on private repos too

## How it works

Each file's commit SHA and path are read from GitHub's embedded page data. For files GitHub didn't inline there (large PRs), it falls back to briefly opening the file header's "More options" menu to read the "View file" link.

Clicking **Preview** opens the extension's own viewer page (`viewer.html`) in a new tab, passing the file reference as query params. The viewer:

1. Fetches the file from `github.com/{owner}/{repo}/raw/{sha}/{path}` — the same cookie-authenticated session as the PR itself, so it works on private repos.
2. Finds every relative image path referenced in the file (both `<img src>` attributes and string literals inside inline `<script>` tags, in case a script assigns one to an `<img>` at runtime), fetches each one, and converts it to a `data:` URI. Neither the file's own directory URL nor a `blob:` URL survive being handed to a different frame: the sandboxed renderer frame below has an opaque origin, so its own cross-origin image requests get blocked by CORB, and `blob:` URLs only resolve within the document that created them anyway. A `data:` URI has no such scoping.
3. Hands the rewritten HTML, plus the path → `data:` URI map, to a nested `sandbox.pages` frame (`renderer.html`) over `postMessage`.

The sandboxed frame is what actually renders the file. Regular extension pages can't run inline `<script>` tags — Chrome enforces `script-src 'self'` as a floor that can't be relaxed — but a page listed under manifest `sandbox.pages` gets its own separate CSP that does allow it, at the cost of losing access to extension APIs (hence the postMessage handoff instead of just navigating there directly). It also watches for scripts reassigning an `<img>`'s `src` to one of the mapped relative paths at runtime, swapping in the matching `data:` URI immediately. Rendering couldn't happen on the GitHub tab itself either: `raw.githubusercontent.com` always serves HTML as `text/plain` (an XSS guard), and a `blob:` URL opened from a GitHub tab inherits GitHub's own strict CSP.

## Usage

1. Open a GitHub PR and go to the **Files changed** tab
2. Click **Preview** next to an HTML file to open its rendered output in a new tab

## Development

```bash
pnpm install
pnpm dev    # hot reload
pnpm build  # production build → .output/chrome-mv3/
```
