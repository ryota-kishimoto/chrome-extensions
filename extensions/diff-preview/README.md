# Diff Preview

A Chrome extension that adds a **Preview** button to HTML and Lottie files on GitHub PR Files Changed tab, opening the rendered output in a new tab instead of just the raw diff.

Scoped to what GitHub doesn't cover: its own "Preview" diff view already renders SVG, images, and Markdown natively (via the code/rendered toggle on each file header), but HTML and Lottie animations only ever show as source.

## Features

- Adds a **Preview** button to each HTML, `.lottie`, and Lottie-`.json` file's diff header
- HTML opens fully rendered — scripts and relative image assets working — in a new tab
- Lottie animations play in a loop against a checkerboard, with image layers resolved (bundled in the `.lottie` archive or fetched from the repo)
- `.json` files only get the button when they actually contain a Lottie animation, decided from the diff text GitHub already embeds in the page (no extra requests for ordinary JSON)
- Works with GitHub's SPA navigation and its React-based "Preview" Files Changed view
- Works on private repos too

## How it works

Each file's commit SHA and path are read from GitHub's embedded page data. For files GitHub didn't inline there (large PRs), it falls back to briefly opening the file header's "More options" menu to read the "View file" link.

Clicking **Preview** opens the extension's own viewer page (`viewer.html`) in a new tab, passing the file reference as query params. The viewer fetches the file from `github.com/{owner}/{repo}/raw/{sha}/{path}` — the same cookie-authenticated session as the PR itself, so it works on private repos — then renders by file type.

**Lottie** (`.lottie`, Lottie `.json`): parsed and validated, then played with `lottie-web`'s eval-free `lottie_light` build, bundled into the viewer itself. A `.lottie` is unpacked as a zip per the dotLottie spec when it actually is one (plain JSON renamed to `.lottie` is common in the wild, so the bytes are sniffed rather than trusting the extension). Raster image layers referenced by relative asset paths are inlined as `data:` URIs, resolved from inside the archive or fetched from the repo.

**HTML**: rendered in a nested `sandbox.pages` frame (`renderer.html`), handed over via `postMessage`. Regular extension pages can't run inline `<script>` tags — Chrome enforces `script-src 'self'` as a floor that can't be relaxed — but a page listed under manifest `sandbox.pages` gets its own separate CSP that does allow it, at the cost of losing access to extension APIs (hence the postMessage handoff). Before the handoff, the viewer inlines every relative image referenced in the file (both `<img src>` attributes and string literals inside inline scripts) as `data:` URIs: the sandboxed frame's opaque origin means its own cross-origin image requests get blocked by CORB, and `blob:` URLs wouldn't survive the frame boundary. A small watcher script injected ahead of the page's own scripts swaps in the matching `data:` URI whenever a script reassigns an `<img>` src to one of those relative paths at runtime. Rendering couldn't happen on the GitHub tab itself either: `raw.githubusercontent.com` always serves HTML as `text/plain` (an XSS guard), and a `blob:` URL opened from a GitHub tab inherits GitHub's own strict CSP.

## Usage

1. Open a GitHub PR and go to the **Files changed** tab
2. Click **Preview** next to an HTML or Lottie file to open its rendered output in a new tab

## Development

```bash
pnpm install
pnpm dev    # hot reload
pnpm build  # production build → .output/chrome-mv3/
```
