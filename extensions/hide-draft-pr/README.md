# Hide Draft PR

A Chrome extension that hides draft pull requests on GitHub PR list pages.

## Features

- Adds a toggle to the extension popup to show/hide draft PRs
- State is persisted across page navigations

## Usage

1. Navigate to a GitHub PR list (e.g. `github.com/owner/repo/pulls`)
2. Click the extension icon
3. Toggle **Hide draft pull requests**

## Development

```bash
pnpm install
pnpm dev    # hot reload
pnpm build  # production build → .output/chrome-mv3/
```
