# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## プロジェクト概要

shotcraft は Chrome MV3 拡張。タブを撮影し、Konva キャンバス上で注釈・モザイク・クロップを施して PNG 出力する。[WXT](https://wxt.dev/) + vanilla TypeScript（フレームワークなし）。README.md が機能・制限・アーキテクチャを詳細に記述しており、機能を変えたら README も更新する。コメント・ドキュメント・コミットメッセージ（Conventional Commits）は日本語。

## コマンド

```bash
pnpm install       # 依存インストール（postinstall で wxt prepare が走り .wxt/ を生成）
pnpm dev           # web-ext 経由で専用プロファイルの Chrome を起動、ホットリロード
pnpm build         # .output/chrome-mv3/ に本番ビルド
pnpm compile       # tsc --noEmit（tsconfig は .wxt/tsconfig.json を extends。install 前だと失敗する）
pnpm test          # Vitest 全実行
pnpm test tests/crop.test.ts   # 単一ファイルのテスト
pnpm zip           # ストア提出用 zip
```

CI（.github/workflows/ci.yml）は compile → test → build → zip の順。PR 前にこの 4 つが通ることを確認する。

## アーキテクチャ

### キャプチャフロー（popup → background → editor）

- `lib/messages.ts` の判別可能ユニオン `Message` がメッセージ契約。popup / content script → service worker（`entrypoints/background.ts`）の全通信はここに型を足してから実装する。
- background が `captureVisibleTab` で撮影し、結果を `lib/capture-store.ts` 経由で `storage.session` に保存してエディタタブを開く。エディタは URL パラメータでなくストアから画像を読む。
- `captureVisibleTab` は 2 回/秒制限。background はスロット予約方式（`CAPTURE_MIN_INTERVAL_MS = 600`）で超過分を破棄せず待つ。
- 範囲選択オーバーレイ（`region-select.content.ts`）は静的登録せず、ボタン操作時に `scripting.executeScript` で動的注入する。これは `host_permissions` を要求しないための設計。

### エディタ（正はドキュメントモデル、Konva は投影）

- 図形はすべてシリアライズ可能なプレーンオブジェクト `Shape`（`lib/editor/doc.ts`）。Konva ノードは `entrypoints/editor/render.ts` が `EditorDoc` から描画する使い捨ての投影。状態変更は必ず doc 側を書き換えて再描画する。
- undo/redo は `lib/editor/history.ts` の past / present / future スナップショット履歴。ドラッグ中の中間状態は commit せず、操作確定時に 1 回だけ commit する。
- 各ツール（`entrypoints/editor/tools/`）は `Tool` インターフェース（`tools/types.ts`）を実装し、app 内部に直接触れず `EditorContext` 経由で操作する。`commitDoc()` が doc への唯一の書き込み経路（履歴 commit・再描画・自動保存を一括で行う）。
- 座標系: doc 座標 = 画像 px。CSS px → 画像 px の変換は `lib/geometry.ts`（devicePixelRatio でなくビットマップとの軸別スケール）。ズーム/パンのビュー変換は `entrypoints/editor/geometry-view.ts`。
- 純粋計算（クロップ座標・モザイク粒度・フキダシ折返し・ステップ採番・線種解決など）は `lib/editor/` に分離されておりユニットテスト対象。UI/Konva 依存コードは `entrypoints/editor/` に置く。新しい計算ロジックは `lib/` 側に書き、`tests/` にテストを足す。

### 永続化

キャプチャ画像（`lib/capture-store.ts`）と編集内容（`lib/editor/doc-store.ts`）はどちらも `browser.storage.session`。タブのリロードでは復元され、ブラウザ終了で消え、ディスクには書かれない。

### デザイントークン

`assets/tokens.css`（CSS 変数）が正で、`lib/theme.ts` が Shadow DOM（content script オーバーレイ）用に値を TS 定数として複製している。トークンを変えるときは両方を同期する（`tests/theme.test.ts` あり）。

## 設計上の不変条件（プライバシー）

README で公約している制約。変更にはユーザーの明示的な判断が必要:

- 権限は `activeTab` / `scripting` / `storage` の 3 つのみ。`host_permissions` は要求しない。
- 実行時の外部リクエストなし（フォント Mochiy Pop One も WOFF2 同梱）。
- 画像データは `storage.session` のみで、明示的な保存操作までディスクに書かない。

## その他

- バージョン更新時は `package.json` と README のバージョンバッジの両方を更新する。
- `Shape` に後方互換フィールドが残っている（例: `TextShape.fontFamily`、`dash?` の省略 = 実線）。保存済み doc を読み込めなくする型変更をしない。
