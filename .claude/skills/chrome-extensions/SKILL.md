---
name: chrome-extensions
description: |
  ~/Desktop/chrome-extensions リポジトリのChrome拡張機能開発を支援。
  ビルド・デプロイ・デバッグの手順を提供する。
  「拡張機能を直して」「ビルドして」「リロードして」等で使用。
---

# Chrome Extensions 開発ガイド

## リポジトリ構成

```
~/Desktop/chrome-extensions/
├── extensions/
│   └── uncheck-viewed/   # GitHub PR の Viewed を一括解除
└── biome.json
```

## インストール先

拡張機能は `~/.chrome/extensions/{name}/` に配置されている。
ビルド出力（`.output/chrome-mv3/`）とは別パスなので、ビルド後にコピーが必要。

## ビルド & デプロイ手順

```bash
cd extensions/{name}
npm install   # 初回のみ
npm run build # ビルド + ~/.chrome/extensions/{name}/ へ自動コピー
```

`npm run build` はビルド後に自動でコピーまでやる（package.json に設定済み）。

コピー後は **chrome://extensions でリロードボタン（🔄）を押す**必要がある。

## 動作確認

ビルド・リロード後はブラウザ操作で確認する（chrome-browser-automation スキル参照）。

対象ページ（PR 一覧 / PR の Files タブ）を開き、`node scripts/check.mjs` の出力を Chrome MCP の `javascript_tool` で実行すると、拡張ごとに `markup`（GitHub 側の DOM が変わったか）と `injected`（拡張が動いたか）の結果が返る。`node scripts/check.mjs stack-pr` で1つだけ。

## 新しい拡張を作るとき

`extensions/{name}/check.js` を必ず置く（無いと `scripts/check.mjs` が警告する）。形式は既存の `extensions/stack-pr/check.js` を参照。拡張の `dom.ts` が読むセレクタを `markup`、拡張が差し込む UI を `injected` に書く。

## 各拡張機能のメモ

### uncheck-viewed

- **対象**: `https://github.com/*`
- **機能**: Files Changed タブで「Uncheck All Viewed」ボタンを挿入
- **対応UI**: new experience（`ViewedFileProgress`）と classic view（`.diffbar-item`）の両方
- **SPA対応**: URL変化を検知して1秒後・2秒後にリトライ
