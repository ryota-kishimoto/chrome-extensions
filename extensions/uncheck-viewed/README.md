# Uncheck Viewed

A Chrome extension that adds an **Uncheck All Viewed** button to GitHub PR Files Changed tab.

## Features

- Adds an **Uncheck All Viewed** button next to the viewed file counter
- Supports both the new GitHub PR experience and the classic view
- Works with GitHub's SPA navigation

## Usage

1. Open a GitHub PR and go to the **Files changed** tab
2. Click **Uncheck All Viewed** to reset all viewed checkmarks at once

## Development

```bash
pnpm install
pnpm dev    # hot reload
pnpm build  # production build → .output/chrome-mv3/
```
