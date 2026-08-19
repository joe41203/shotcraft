---
workflow: product-launch-video
flow: automation
storyboard: no
message: "スクショの加工を、外に出さずにブラウザの中だけで終わらせる"
angle: privacy-first
destination: readme
aspect: 1920x1080
language: ja
length: 15s
audience: "Chrome 拡張を探している開発者・デザイナー（GitHub README の読者）"
style_preset: broadside
---

## Intent

shotcraft の README 冒頭に載せる、訴求重視のプロモ。実操作のツアーではなく、
**「そのスクショ、どこに送ってる？」→「shotcraft は全部ブラウザの中で完結」→
「権限は 3 つだけ・外部送信ゼロ」→ ロゴとウェブストア導線** というコピー主導の構成。

エディタ UI は実キャプチャではなく HTML/CSS で再現する（ユーザー指定）。
実物の docs/images/*.png は色・レイアウトの参照に使うが、画面そのものは組み直す。

## Customizations

- **完全無音**: `music: none` かつ `SCRIPT.md` なし。README の GIF は無音で見られるため、
  コピーはすべて画面上のテキストで成立させる。
- **GIF 前提の尺**: 15 秒前後。README にインライン埋め込みして自動ループさせる。
  MP4 も同時に出力し、LP・CWS へ流用できるようにする。
- **no-capture パス**: 対象はローカルの Chrome 拡張で、クロールできる URL がない。
  capture/extracted/ は手で作る。

## Assets

- `docs/images/editor-annotations.png` — 注釈・モザイク済みのエディタ画面（配色の参照）
- `docs/images/editor-crop.png` — クロップ枠表示のエディタ画面（配色の参照）
- `public/icon/128.png` — 拡張アイコン（クロージングのロゴ）
- `assets/tokens.css` — 製品本体のデザイントークン（配色の正）

## Notes

- 事実は README とコードで検証済み: 権限は activeTab / scripting / storage の 3 つのみ、
  host_permissions なし、外部リクエストなし、画像は storage.session のみ。
  **これらは誇張せずそのまま使う**（README の公約と一致させる）。
- ツールは 15 種類。線の太さは 4px 固定。
- Chrome ウェブストアで公開中（v0.10.0）。
