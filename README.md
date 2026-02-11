# Chrome Extensions

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](./LICENSE)

Chrome 拡張機能のモノレポ。

## Tech Stack

- **pnpm workspaces** — モノレポ管理
- **WXT** — ビルド (Vite ベース, Manifest V3)
- **TypeScript**
- **Biome** — Lint / Format

## Extensions

### [Copy from X](./extensions/copy-tweet/)

X（Twitter）のツイートや記事をワンクリックでコピーする拡張機能。

- 各ツイートのアクションバーに「Copy」ボタンを追加
- Markdown 形式でクリップボードにコピー（`text/plain`）
- 画像を base64 埋め込み HTML としてもコピー（`text/html`）
- X Article（長文記事）に対応

### [Uncheck Viewed](./extensions/uncheck-viewed/)

GitHub PR の Files Changed タブで「Viewed」チェックを一括解除する拡張機能。

- viewed カウンター横に「Uncheck All Viewed」ボタンを追加

## Getting Started

```bash
# インストール
pnpm install

# 拡張機能をビルド
pnpm --filter <extension-name> build

# 開発モード（ホットリロード）
pnpm --filter <extension-name> dev

# lint
pnpm -w lint
pnpm -w lint:fix
```

ビルド後、`chrome://extensions` でデベロッパーモードを有効にし、「パッケージ化されていない拡張機能を読み込む」から選択：

```
extensions/<extension-name>/.output/chrome-mv3
```

## License

[MIT](./LICENSE)
