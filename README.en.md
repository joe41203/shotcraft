<div align="center">

<img src="public/icon/128.png" width="96" height="96" alt="shotcraft icon">

# shotcraft

**Capture, then annotate, pixelate, and crop right there. A fully local screenshot editor.**

[![CI](https://github.com/joe41203/shotcraft/actions/workflows/ci.yml/badge.svg)](https://github.com/joe41203/shotcraft/actions/workflows/ci.yml)
[![version](https://img.shields.io/badge/version-0.10.0-22c55e)](./package.json)
[![Chrome Web Store](https://img.shields.io/chrome-web-store/v/pkhbgheiebgdikjbhegjfbidgbphccfo)](https://chromewebstore.google.com/detail/shotcraft/pkhbgheiebgdikjbhegjfbidgbphccfo)
[![license: MIT](https://img.shields.io/badge/license-MIT-yellow)](./LICENSE)

![shotcraft overview: capture, annotate, and export entirely inside the browser, with only three permissions](docs/images/demo.gif)

**English** · [日本語](./README.md) · [简体中文](./README.zh-CN.md)

</div>

> **Note:** The extension's interface is currently Japanese only. This document translates the Japanese labels so you can match them against what you see on screen, but the buttons themselves are not localized yet.

A Chrome extension (MV3) that captures the tab you're looking at and lets you draw **arrows, pixelation, text, crops** and more straight onto it before exporting. Everything from capture to export happens inside your browser, so your images are never sent anywhere.

Useful for bug-report screenshots, sharing dashboards, and writing step-by-step guides — capture, hide, highlight, and hand off without leaving the tab.

![Editor with arrow, pixelation, and rectangle annotations applied](docs/images/editor-annotations.png)

![Editor showing the crop frame](docs/images/editor-crop.png)

## Install

Install from the [Chrome Web Store](https://chromewebstore.google.com/detail/shotcraft/pkhbgheiebgdikjbhegjfbidgbphccfo) with "Add to Chrome". The project page is [shotcraft.pages.dev](https://shotcraft.pages.dev).

<details>
<summary>Load locally (development build)</summary>

```bash
pnpm install && pnpm build
```

1. Open `chrome://extensions` in Chrome
2. Turn on "Developer mode" in the top right
3. Click "Load unpacked" and select `.output/chrome-mv3`
</details>

## Usage

Click the extension icon and pick one of the two buttons in the popup.

| Button | What it does |
| --- | --- |
| 表示範囲をキャプチャ (Capture viewport) | Captures the entire visible area of the active tab. |
| 範囲を選択してキャプチャ (Capture a region) | Click the element under the cursor to capture its exact bounds, or drag to select a rectangle (`Esc` cancels). |

After capture, the editor opens in a new tab. Pick a tool and color from the toolbar, then drag or click on the image to draw. Your edits are saved automatically and survive a tab reload.

- **Changing style**: Selecting a tool opens a small panel (a flyout) right below its button, showing only the options that apply to that tool — line style, arrow head, text size, fill, pixelation strength, and so on.

  What you pick becomes the default for the next shape you draw. If you select an existing shape with the select tool and then change a setting, it applies to that shape immediately ("number" and "ratio" only appear while the tool itself is active). Settings persist the next time you open the editor.
- **Color**: The color swatches in the toolbar set the color for your next shape. Select a shape first and the change applies to it as well. For colors outside the palette, use the eyedropper button on the right to pick one from anywhere on screen — including other windows.
- **Export**: Use the 形式 (format) button to choose PNG / JPEG / WebP — with a quality setting for JPEG and WebP — then 保存 (save) to download. コピー (copy) always produces PNG so it pastes anywhere.
- **Stroke width**: Fixed at 4px (there is no UI to change it).

## Tools

| Tool | Key | Description |
| --- | --- | --- |
| 選択 (Select) | `V` | Move, resize, and rotate shapes. Supports multi-select and grouping. |
| 矢印 (Arrow) | `A` | Arrow heads can be single, double, or curved. |
| 直線 (Line) | `L` | Draws a straight line with no arrow head. |
| 矩形 (Rectangle) | `R` | Fill can be none or translucent. |
| 楕円 (Ellipse) | `E` | Fill can be none or translucent. |
| スポットライト (Spotlight) | `O` | Keeps the region you outline bright and dims everything else. No matter how many you place there is only ever one dimming layer, and annotations always stay bright. |
| テキスト (Text) | `T` | Typeface is fixed to the bundled Mochiy Pop One. Sizes S / M / L, or drag the corner handles to scale freely. |
| ペン (Pen) | `P` | Draws freehand, with stroke smoothing. |
| マーカー (Marker) | `M` | Draws thick, translucent strokes like a highlighter, with stroke smoothing. |
| ステップ (Step) | `S` | Each click drops a numbered circular badge (①②③…). "次を1に戻す" resets the counter to 1. |
| フキダシ (Callout) | `B` | A rounded speech bubble with text. Each of the four tails toggles independently; with all of them off you get text on a background plate. |
| モザイク (Pixelate) | `X` | Pixelates the region you outline. Coarseness is derived from the region size and can be tuned with the strength setting. |
| ぼかし (Blur) | `U` | Blurs the region you outline. Corners are rounded. |
| スマート消しゴム (Smart eraser) | `D` | Fills the region using an inverse-distance-weighted blend of the surrounding colors. Unlike pixelation or blur it leaves no trace of "something was hidden here", so it suits erasing notification badges or cursors into the background (works best on flat or gently graded backgrounds). |
| クロップ (Crop) | `C` | Trims away what you don't need. Ratios: free / 1:1 / 4:3 / 16:9. `Enter` confirms, undo reverts. |

Line style (solid / dashed) is available for arrow, line, rectangle, ellipse, and pen. Pixelate, blur, smart eraser, and spotlight act on **the base image only** and never affect annotations (bring one to the front if you want to hide an annotation).

### Frames

You can wrap the whole screenshot in a frame. This keeps the image from dissolving into the page when you paste it onto a white background, and generally makes it look more finished. It's a per-image setting rather than a tool, switchable at any time from the frame button in the toolbar.

| Type | Appearance | Additional options |
| --- | --- | --- |
| 枠線 (Border) | A solid outline | Width (thin 2px / normal 6px / thick 12px) and color |
| ブラウザ (Browser) | Window style with traffic-light buttons and an address bar (rounded) | The URL shown in the address bar |
| ダーク (Dark) | Window style with a dark title bar (rounded) | The text in the title bar |

Frames are added **outside** the content, so nothing gets covered — the output just grows accordingly. For the browser frame the URL defaults to where the screenshot came from, but **the query string (`?...`) and hash (`#...`) are stripped** so tokens don't leak into the image. The URL and title belong to that specific image, so they are not saved as settings.

## Keyboard shortcuts

Tool switching uses the keys in the [tools table](#tools) above. These are the editing shortcuts (all disabled while typing text).

| Key | Action |
| --- | --- |
| `Shift` (while drawing) | Snaps arrow and line angles to 0 / 45 / 90°, constrains rectangle to a square and ellipse to a circle |
| While dragging (automatic) | Snaps to the edges of other shapes and of the image, showing red guide lines (`Shift` disables it) |
| Drag from empty space | Rubber-band selection for selecting multiple shapes |
| `Shift` + click | Add / remove a shape from the selection |
| `Ctrl` / `Cmd` + `D` | Duplicate the selection, offset slightly to the bottom right |
| `Alt` (`Option`) + drag | Drag off a duplicate, leaving the original in place |
| `Ctrl` / `Cmd` + `G` | Group (add `Shift` to ungroup) |
| Arrow keys | Nudge by 1px (10px with `Shift`) |
| `]` / `[` | Bring forward / send backward (add `Shift` for front / back) |
| `Delete` / `Backspace` | Delete the selection |
| `Enter` | Confirm crop / insert a newline while typing text |
| `Ctrl` / `Cmd` + `Enter` | Commit text |
| `Esc` | Clear selection, cancel crop (returns to the select tool if nothing is selected). While typing text it **commits** the input |
| `Ctrl` / `Cmd` + `Z` | Undo (add `Shift`, or use `Ctrl` / `Cmd` + `Y`, to redo) |
| `Ctrl` / `Cmd` + `C` | Copy the image to the clipboard |
| `Ctrl` / `Cmd` + wheel | Zoom centered on the cursor (`0` fits the whole image) |
| Wheel / trackpad | Pan |

## Privacy

- **Fully local**: Capture, editing, and export all happen inside the browser. No image data is sent anywhere.
- **No external requests**: Even the annotation font (Mochiy Pop One) is bundled, so nothing is fetched at runtime.
- **Nothing left on disk**: Captures and edits live in `storage.session` and are never written to disk until you explicitly save. Only your settings (color, line style, size, export format, frame type, and so on) go to `storage.local` — never image data.
- **Minimal permissions**: Only the following three, and no `host_permissions`.

| Permission | Why |
| --- | --- |
| `activeTab` | Capturing the visible area of the active tab |
| `scripting` | Injecting the region-select overlay (no static content script — it is injected via `scripting.executeScript` at the moment you press the button) |
| `storage` | Session storage for the capture and your edits |

## Architecture

Built with [WXT](https://wxt.dev/) and vanilla TypeScript (no framework), using [Konva](https://konvajs.org/) for canvas rendering.

**The document model is the source of truth; Konva is a projection of it.** Every shape is a serializable plain object `Shape` (`lib/editor/doc.ts`), and the Konva nodes on screen are disposable projections of `EditorDoc`. That makes saving, restoring, and undo/redo uniformly a matter of manipulating data.

**Undo/redo is snapshot history** (`lib/editor/history.ts`) — a pure data structure holding past / present / future. Intermediate states during a drag are never committed; exactly one commit happens when the operation settles, so a single drag costs one undo step rather than hundreds.

**Temporary storage is `storage.session`.** Captured images (`capture-store.ts`) and edits (`doc-store.ts`) last until the browser closes, survive a tab reload, and leave nothing on disk. Style settings for new shapes are the one exception, stored in `storage.local` (`style-prefs.ts`).

```text
entrypoints/
  background.ts            Service worker; the core of capture handling
  popup/                   Toolbar popup (where a capture starts)
  editor/                  Editor tab; Konva stage, toolbar, and the tools
  region-select.content.ts Region-select overlay (injected via scripting)
lib/
  editor/                  Document model, history, persistence, pure computation
                           (crop / mosaic / blur / spotlight / erase / border /
                            snap / selection / callout / step, and more)
  capture-store.ts         storage.session persistence for captures
  geometry.ts              Coordinate conversion (CSS px to image px)
  theme.ts                 Design tokens as TS constants (for the Shadow DOM)
assets/tokens.css          Design tokens (CSS variables) and @font-face
public/                    Bundled font (WOFF2 and OFL.txt) and extension icons
```

## Development

```bash
pnpm install       # Install dependencies
pnpm dev           # Launch Chrome with a dedicated profile and hot reload
pnpm build         # Production build into .output/chrome-mv3
pnpm zip           # Build a distributable zip
pnpm compile       # Type-check with tsc --noEmit
pnpm test          # Run unit tests with Vitest
```

Pure computations — crop coordinates, pixelation granularity, blur radius, the smart eraser's IDW blend, frame dimensions, alignment snapping, callout text wrapping, step numbering — live in `lib/editor/` and are covered by [Vitest](https://vitest.dev/). CI runs compile → test → build → zip.

## Known limitations

<details>
<summary>Some pages cannot be captured</summary>

Chrome itself blocks capture and region selection on internal pages such as `chrome://`, the Chrome Web Store, the extensions management page, and other extensions' pages. If you try, the extension icon shows a failure badge (a red `!` that disappears after a few seconds) and a warning is logged to the service worker console.
</details>

<details>
<summary>Rapid captures are rate-limited by the browser</summary>

`captureVisibleTab` is limited to twice per second by the browser. When captures come in faster than that, the extra ones are not dropped — they wait for the next available slot.
</details>

<details>
<summary>JPEG cannot preserve transparency</summary>

Because JPEG has no alpha channel, the image is composited onto a white background before export (this keeps transparent areas from turning black). The same applies to the corners of rounded frames; PNG and WebP keep them transparent.
</details>

<details>
<summary>Resize and rotate are unavailable with a multi-selection</summary>

To keep things simple, a multi-selection or group selection supports only move, delete, duplicate, and nudge (the handles return once you go back to a single selection). Pixelate, blur, smart eraser, and spotlight cannot be rotated even when selected alone; text scales only via its corner handles; and step badges are fixed size, supporting only move and delete.
</details>

## Feedback

Please report bugs and feature requests via [Issues](https://github.com/joe41203/shotcraft/issues). For reports like "this page can't be captured", including the page URL and your Chrome version makes it much easier to reproduce. Issues in English are welcome.

Found a vulnerability? Please report it privately per the [security policy](./SECURITY.md) rather than in a public issue.

## Credits

- **Font**: Text annotations use the bundled [Mochiy Pop One](https://fonts.google.com/specimen/Mochiy+Pop+One) (SIL OFL 1.1, Copyright 2020 The Mochiypop Project Authors). To avoid external requests, the WOFF2 is bundled rather than loaded as a web font; it comes to about 2.1 MB. The full license text is at [`public/fonts/mochiy-pop-one/OFL.txt`](public/fonts/mochiy-pop-one/OFL.txt). The UI itself uses your OS system fonts.
- **Icons**: The extension icons (`public/icon/`) are original to this repository.

## License

The source code is under the [MIT License](./LICENSE). The bundled Mochiy Pop One font is covered independently by the SIL Open Font License 1.1.
