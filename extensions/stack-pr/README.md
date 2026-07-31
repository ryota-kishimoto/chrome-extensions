# Stack PR

A Chrome extension that groups [stacked pull requests](https://github.blog/changelog/2026-07-30-stacked-pull-requests-are-now-in-public-preview/) on GitHub PR list pages.

GitHub shows a `2/4` badge on each stacked pull request, but the list stays sorted
by update time, so members of one stack end up scattered among unrelated PRs. This
extension pulls each stack back together and orders it from the base branch upwards.

## Features

- Groups PRs belonging to the same stack into a contiguous block
- Orders members from the base branch upwards (`1.` is closest to the base)
- Frames each stack as a card — header row, accent border, and spacing above and
  below — so it reads as one unit separated from the surrounding PRs
- Toggle in the extension popup

## How it works

The PR list markup includes a stack icon and a position badge, but not which stack a
PR belongs to — so `2/4` alone can't be grouped reliably. To resolve that, the
extension reads the base and head branch names from GitHub's hovercard partial for
each stacked row and chains them: a PR whose base is another PR's head sits directly
on top of it. Fetches are limited to rows that already show a stack badge.

This uses only your existing GitHub session — no access token required.

## Usage

1. Navigate to a GitHub PR list (e.g. `github.com/owner/repo/pulls`)
2. Stacks are grouped automatically
3. Click the extension icon to toggle **Group stacked PRs**

## Development

```bash
npm install
npm run dev    # hot reload
npm run build  # production build → .output/chrome-mv3/
```
