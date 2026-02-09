# Chrome Extensions

個人用 Chrome 拡張機能のモノレポ。

## Tech Stack

- **pnpm workspaces** - モノレポ管理
- **WXT** - ビルド (Vite ベース, Manifest V3)
- **TypeScript**
- **Biome** - Lint / Format

## Extensions

### [uncheck-viewed](./extensions/uncheck-viewed/)

GitHub PR の Files Changed タブで「Viewed」チェックを一括解除する拡張機能。

ツールバーの viewed カウンター横に「Uncheck All Viewed」ボタンを追加する。

#### インストール

```bash
pnpm install
pnpm --filter uncheck-viewed build
```

Chrome で `chrome://extensions` を開き、デベロッパーモードを有効にして「パッケージ化されていない拡張機能を読み込む」から以下を選択：

```
extensions/uncheck-viewed/.output/chrome-mv3
```

#### 開発

```bash
pnpm --filter uncheck-viewed build  # ビルド
pnpm -w lint                        # lint チェック
pnpm -w lint:fix                    # lint 自動修正
```

ビルド後、`chrome://extensions` でリロードボタンを押してページを更新。
