# Copy from X

A Chrome extension that copies tweets and X Articles as Markdown with embedded images.

## Features

- Adds a **Copy** button to each tweet's action bar
- Copies as Markdown (`text/plain`) — paste into any text editor
- Copies as HTML with base64-embedded images (`text/html`) — paste into Notion, Google Docs, etc.
- Supports X Articles (long-form posts)

## Usage

1. Open [x.com](https://x.com)
2. Click the **Copy** button on any tweet or article
3. Paste wherever you like

## Copied format

```
**Display Name** (@handle) - 2026-01-01T00:00:00.000Z

Tweet text here.

![image](data:image/jpeg;base64,...)
```

## Development

```bash
pnpm install
pnpm dev    # hot reload
pnpm build  # production build → .output/chrome-mv3/
```
