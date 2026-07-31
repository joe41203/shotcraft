# shotcraft 📸

スクリーンショットを撮影・編集できる Chrome 拡張です（開発中）。[WXT](https://wxt.dev/) + vanilla TypeScript で構築しており、現時点では最小構成のポップアップと background のみを備えています。

## セットアップ

```bash
pnpm install
pnpm build
```

`pnpm build` すると `.output/chrome-mv3/` にビルド成果物（MV3 拡張一式）が生成されます。

## ローカルの Chrome に読み込む

1. Chrome で `chrome://extensions` を開く
2. 右上の「デベロッパーモード」を ON にする
3. 「パッケージ化されていない拡張機能を読み込む」をクリックし、`.output/chrome-mv3` を選択する

## 開発

```bash
pnpm dev
```

`pnpm dev` を実行すると、拡張機能を読み込んだ専用プロファイルの Chrome が自動起動し、ソースの変更がホットリロードされます。
