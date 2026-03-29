# Chrome Extensions

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](./LICENSE)

A monorepo of Chrome extensions built with WXT and TypeScript.

## Extensions

| Extension | Description |
|-----------|-------------|
| [Copy from X](./extensions/copy-tweet/) | Copy tweets and articles as Markdown with embedded images |
| [Hide Draft PR](./extensions/hide-draft-pr/) | Hide draft pull requests on GitHub PR list |
| [Uncheck Viewed](./extensions/uncheck-viewed/) | Uncheck all Viewed files on GitHub PR Files Changed tab |

## Tech Stack

- [WXT](https://wxt.dev/) — Chrome extension framework (Vite-based, Manifest V3)
- [TypeScript](https://www.typescriptlang.org/)
- [pnpm workspaces](https://pnpm.io/workspaces) — monorepo management
- [Biome](https://biomejs.dev/) — lint / format

## Development

```bash
pnpm install

# build a specific extension
pnpm --filter <extension-name> build

# dev mode with hot reload
pnpm --filter <extension-name> dev

# lint
pnpm -w lint
pnpm -w lint:fix
```

After building, load the extension in Chrome:

1. Open `chrome://extensions`
2. Enable **Developer mode**
3. Click **Load unpacked** and select `extensions/<extension-name>/.output/chrome-mv3`

## License

[MIT](./LICENSE)
