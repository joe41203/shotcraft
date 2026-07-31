<div align="center">

<img src="public/icon/128.png" width="96" height="96" alt="shotcraft のアイコン">

# shotcraft

**撮って、その場で注釈・モザイク・クロップ。完全ローカル動作のスクリーンショット編集ツール**

[![version](https://img.shields.io/badge/version-0.1.0-22c55e)](./package.json)
[![Manifest V3](https://img.shields.io/badge/Manifest-V3-4285F4)](https://developer.chrome.com/docs/extensions/mv3/intro/)
[![Built with WXT](https://img.shields.io/badge/built%20with-WXT-67d4f8)](https://wxt.dev/)
[![Konva](https://img.shields.io/badge/canvas-Konva-0d83cd)](https://konvajs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-strict-3178c6)](https://www.typescriptlang.org/)
[![font: SIL OFL 1.1](https://img.shields.io/badge/font-SIL%20OFL%201.1-informational)](public/fonts/OFL.txt)
[![license: MIT](https://img.shields.io/badge/license-MIT-yellow)](./LICENSE)

<!--
  Chrome ウェブストアの審査を通過してストア公開されたら、ストアリンクのバッジをここに足す:
  [![Chrome Web Store](https://img.shields.io/chrome-web-store/v/<EXTENSION_ID>)](https://chromewebstore.google.com/detail/<EXTENSION_ID>)
-->

</div>

---

shotcraft は、いま見ているタブを撮影し、そのまま**矢印・矩形・テキスト・モザイク・クロップ**などの注釈を描き込んで PNG で書き出せる Chrome 拡張です。撮影から書き出しまでがブラウザ内で完結し、画像データを外部サーバーへ送信しません。バグ報告のスクショ、ダッシュボードの共有、手順書づくりなど、「撮って・隠して・強調して・渡す」を一気通貫でこなします。

[WXT](https://wxt.dev/) + vanilla TypeScript で構築し、キャンバス描画は [Konva](https://konvajs.org/) を使っています。

## スクリーンショット

撮影した画像に注釈・モザイク・強調を施したところ。矢印で注目点を示し、伏せたい箇所はモザイクで隠し、重要な行を矩形で囲んでいます。

![注釈・モザイク・矩形強調を施した編集画面](docs/images/editor-annotations.png)

クロップツールを選ぶと画像の内側にトリミング枠が現れます。ハンドルをドラッグして範囲を決め、`Enter` で確定します。

![クロップ枠を表示した編集画面](docs/images/editor-crop.png)

## 特長

### 撮影

- **表示範囲をキャプチャ**: アクティブなタブの表示領域全体をワンクリックで撮影します。
- **範囲を選択してキャプチャ**: ページ上にオーバーレイを重ね、ドラッグで選んだ矩形だけを撮影します。ドラッグ中は選択領域とサイズ（幅 x 高さ）を表示し、`Esc` でキャンセルできます。

### 編集

- **9 種類のツール**: 選択・矢印・矩形・楕円・テキスト・ペン・蛍光マーカー・モザイク・クロップ。
- **モザイク**: ドラッグした矩形をピクセル化して情報を伏せます。粗さは範囲の大きさから自動で決まり、移動・リサイズすると都度計算し直します。
- **クロップ**: トリミング枠で不要部分を切り落とします。確定後にさらに絞り込むこともでき、元に戻すで解除できます。
- **テキスト注釈**: キャンバス上に直接文字を書き込めます。書体は丸ゴシック（同梱の Zen Maru Gothic）・ゴシック・明朝・等幅の 4 種、サイズは小・中・大・特大（14 / 18 / 24 / 32px）から選べます。
- **やり直し自在**: すべての操作を undo / redo でき、色や線の太さも選べます。

### 出力

- **PNG 保存**: クロップ適用後の画像を PNG ファイルとしてダウンロードします。
- **クリップボードへコピー**: `Ctrl` / `Cmd` + `C` で画像を直接コピーし、そのまま貼り付けられます。
- 出力はベース画像・モザイク・注釈を合成したもので、常にキャプチャ原寸です。選択枠やトリミング枠は含まれません。

### プライバシー

- **完全ローカル動作**: 撮影・編集・書き出しのすべてがブラウザ内で完結します。画像データを外部サーバーへ送信しません。
- **外部リクエストなし**: フォントも含めて拡張に同梱しており、実行時に外部へ通信しません。
- **最小権限**: 要求する権限は `activeTab` / `scripting` / `storage` の 3 つだけです。`host_permissions` は要求しません。
- **ディスクに残さない**: 撮影データと編集内容は `storage.session`（ブラウザを閉じるまで有効なセッションストレージ）に保存し、明示的な保存操作をするまでディスクへは書き出しません。

## インストール

### Chrome ウェブストアから

現在 Chrome ウェブストアの審査中です。公開され次第、ここにインストールリンクを掲載します。

### ローカルに読み込む（開発版）

```bash
pnpm install
pnpm build
```

`pnpm build` すると `.output/chrome-mv3/` に MV3 拡張一式が生成されます。これを Chrome に読み込みます。

1. Chrome で `chrome://extensions` を開く
2. 右上の「デベロッパーモード」を ON にする
3. 「パッケージ化されていない拡張機能を読み込む」をクリックし、`.output/chrome-mv3` を選択する

## 使い方

ツールバーの拡張アイコンをクリックしてポップアップを開き、2 つのボタンから選びます。

| ボタン | 動作 |
| --- | --- |
| 表示範囲をキャプチャ | 現在アクティブなタブの表示領域全体を撮影します。 |
| 範囲を選択してキャプチャ | オーバーレイをドラッグして選んだ矩形を撮影します（`Esc` でキャンセル）。 |

どちらもキャプチャ後に新しいタブでエディタが開きます。上部のツールバーからツール・色・線の太さを選び、画像の上にドラッグやクリックで注釈を描きます。

- **描画**: 矢印・矩形・楕円はドラッグで描画します。ペンと蛍光マーカーはフリーハンドで、マーカーは太く半透明に描かれます。
- **テキスト**: テキストツールでクリックした位置に入力欄が開きます。`Enter` で確定、`Shift+Enter` で改行、`Esc` でキャンセルです。図形をダブルクリックすると再編集できます。テキストツールまたはテキストを選択している間はツールバーにフォント欄が現れ、書体（丸ゴシック・ゴシック・明朝・等幅の 4 種）とサイズ（小 / 中 / 大 / 特大 = 14 / 18 / 24 / 32px）を選べます。ここで選んだ値は次に作るテキストの既定になり、テキストを選択中に変更した場合はそのテキストへ即座に反映されます。
- **モザイク**: モザイクツール（`X`）でドラッグした矩形範囲をピクセル化します。選択ツールで移動・リサイズ・削除でき、変形するとピクセル化を計算し直します。
- **クロップ**: クロップツール（`C`）でトリミング枠を出し、ハンドルや枠をドラッグして範囲を調整して `Enter` で確定します。もう一度クロップするとさらに絞り込め、元に戻すで解除できます。
- **選択・変形**: 選択ツールで図形をクリックすると、周囲のハンドルで移動・リサイズ・回転できます（モザイクは回転できません）。
- **出力**: ツールバー右端の「PNG保存」でダウンロード、「コピー」でクリップボードへコピーします。
- 編集内容（注釈・モザイク・クロップ）は自動保存され、エディタのタブをリロードしても復元されます。

### キーボードショートカット

| キー | 動作 |
| --- | --- |
| `V` | 選択ツール |
| `A` | 矢印ツール |
| `R` | 矩形ツール |
| `E` | 楕円ツール |
| `T` | テキストツール |
| `P` | ペンツール |
| `M` | 蛍光マーカーツール |
| `X` | モザイクツール |
| `C` | クロップツール |
| `Enter` | クロップ範囲を確定（クロップ操作中） |
| `Delete` / `Backspace` | 選択中の図形を削除 |
| `Esc` | 選択解除／クロップのキャンセル（未選択なら選択ツールへ戻る） |
| `0` | 全体フィット表示 |
| `Ctrl` / `Cmd` + `C` | 画像をクリップボードへコピー |
| `Ctrl` / `Cmd` + `Z` | 元に戻す |
| `Ctrl` / `Cmd` + `Shift` + `Z`（または `Ctrl` / `Cmd` + `Y`） | やり直し |
| `Ctrl` / `Cmd` + ホイール | カーソル位置を中心にズーム |
| ホイール / トラックパッド | パン（スクロール） |

テキストの入力中は、上記のツール切り替え・削除などのショートカットは無効になります。

## アーキテクチャ

### 描画の正はドキュメントモデル、Konva ノードはその投影

図形はすべて**シリアライズ可能なプレーンオブジェクト（`Shape`）**で表現します（`lib/editor/doc.ts`）。画面に見えている Konva ノードは、このドキュメント（`EditorDoc`）を描画に投影したものにすぎず、使い捨てです。「正はデータ側、Konva は描画結果」と役割を分けることで、保存・復元・undo/redo をすべてデータの操作として一貫して扱えます。

### スナップショット履歴による undo / redo

undo / redo は `EditorDoc` のスナップショット履歴で実現します（`lib/editor/history.ts`）。確定済みの過去（past）・現在（present）・やり直し用の未来（future）を持つ純粋なデータ構造で、ドラッグ中の中間状態は commit せず、操作の確定時に 1 回だけ commit します。これにより履歴が中間状態で埋まりません。

### storage.session による一時保存

キャプチャ画像（`capture-store.ts`）と編集内容（`doc-store.ts`）は `browser.storage.session` に保存します。ブラウザを閉じるまで有効なセッションストレージなので、タブのリロードや誤操作からは復元でき、かつディスクには残りません。

### ディレクトリ構成

```text
entrypoints/
  background.ts            バックグラウンド（Service Worker）。キャプチャ処理の中核
  popup/                   拡張アイコンのポップアップ（撮影の起点）
  editor/                  編集タブ。Konva ステージ・ツールバー・各ツール
    tools/                 ツール実装（矢印・矩形・テキスト・モザイクなど）
    render.ts              Shape から Konva ノードへの描画
    crop-controller.ts     クロップ枠の UI とライフサイクル
    export.ts              PNG 合成・書き出し・ファイル名生成
  region-select.content.ts 範囲選択オーバーレイ（scripting で動的注入）
lib/
  editor/
    doc.ts                 ドキュメントモデル（Shape / EditorDoc）
    history.ts             undo/redo のスナップショット履歴
    doc-store.ts           編集内容の storage.session 保存
    crop.ts / mosaic.ts    クロップ・モザイクの座標／ピクセル計算
  capture-store.ts         キャプチャの storage.session 保存
  geometry.ts              座標変換（CSS px から画像 px へ）
  theme.ts                 デザイントークンの TS 定数（Shadow DOM 用に値を複製）
  icons.ts / messages.ts   アイコン定義・メッセージ型
assets/
  tokens.css               デザイントークン（CSS 変数）と @font-face
public/
  fonts/                   同梱フォント（Zen Maru Gothic の WOFF2）と OFL.txt
  icon/                    拡張アイコン
```

## 権限

| 権限 | 用途 |
| --- | --- |
| `activeTab` | アクティブなタブの表示領域をキャプチャするために使います。 |
| `scripting` | 範囲選択オーバーレイをアクティブタブに注入するために使います。 |
| `storage` | キャプチャ結果と編集内容をセッションストレージへ一時保存するために使います。 |

`host_permissions` は要求しません。範囲選択のオーバーレイは、静的な content script ではなく、ボタン操作の時点で `scripting.executeScript` によりアクティブタブへ注入します。

## 開発

```bash
pnpm install       # 依存をインストール
pnpm dev           # 専用プロファイルの Chrome を自動起動し、ホットリロードで開発
pnpm build         # .output/chrome-mv3 に本番ビルドを生成
pnpm zip           # 配布用の zip を生成
pnpm compile       # tsc --noEmit で型チェック
pnpm test          # Vitest でユニットテストを実行
```

`pnpm dev` を実行すると、[web-ext](https://github.com/mozilla/web-ext) 経由で拡張を読み込んだ専用プロファイルの Chrome が自動起動し、ソースの変更がホットリロードされます。

### テスト

座標変換（CSS px から画像 px への変換）、ドキュメントモデルと undo/redo 履歴、ズーム/フィット計算、モザイクのピクセルサイズ決定、クロップの座標合成、出力ファイル名の生成について、[Vitest](https://vitest.dev/) でユニットテストを用意しています。

```bash
pnpm test
```

## 既知の制限

<details>
<summary>キャプチャできないページがある</summary>

`chrome://` などのブラウザ内部ページ、Chrome ウェブストア、拡張機能の管理ページ、他拡張のページでは、Chrome の制約によりキャプチャ・範囲選択ができません。これらのページで範囲選択を実行しても何も起きず、拡張の Service Worker のコンソールに警告を出して終了します。
</details>

<details>
<summary>連続キャプチャはブラウザ側で制限される</summary>

`captureVisibleTab` はブラウザ側で 2 回 / 秒に制限されます。短時間に連続でキャプチャした場合、超過分は破棄せず、スロットが空くまで待ってから実行します。
</details>

<details>
<summary>モザイクはベース画像だけを対象にする</summary>

モザイクはベース画像（キャプチャ元の画像）だけをピクセル化します。モザイクの下に注釈図形を重ねても、その注釈にはモザイクが掛かりません。注釈を隠したい場合はモザイクを最後（最前面）に置いてください。
</details>

<details>
<summary>書き出し形式は PNG のみ</summary>

書き出し形式は PNG のみです。PNG のダウンロードとクリップボードへのコピーは拡張タブでの操作を起点にするため、`downloads` やクリップボード書き込みの追加権限は要求しません。
</details>

<details>
<summary>色・太さの適用範囲</summary>

色と線の太さは、新しく描く図形にのみ適用されます。既存図形への適用は今後対応予定です。
</details>

## クレジット

- **フォント**: [Zen Maru Gothic](https://fonts.google.com/specimen/Zen+Maru+Gothic)（Copyright 2021 The Zen Maru Gothic Project Authors、[SIL Open Font License 1.1](https://openfontlicense.org/) のもとで配布）を拡張に同梱しています。UI とテキスト注釈の書体に使っています。ライセンス全文は [`public/fonts/OFL.txt`](public/fonts/OFL.txt) を参照してください。外部リクエストを避けるため CSS の Web フォント読み込みは使わず、WOFF2 を同梱しています。
- **アイコン**: 本リポジトリオリジナルの拡張アイコン（`public/icon/`）を使用しています。

## ライセンス

このプロジェクトのソースコードは [MIT License](./LICENSE) のもとで公開しています。同梱フォント Zen Maru Gothic は SIL Open Font License 1.1（[`public/fonts/OFL.txt`](public/fonts/OFL.txt)）のもとで配布されており、ソースコードのライセンスとは独立にこの条件が適用されます。
