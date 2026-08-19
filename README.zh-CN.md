<div align="center">

<img src="public/icon/128.png" width="96" height="96" alt="shotcraft 图标">

# shotcraft

**截图后当场标注、打码、裁剪。完全本地运行的截图编辑工具。**

[![CI](https://github.com/joe41203/shotcraft/actions/workflows/ci.yml/badge.svg)](https://github.com/joe41203/shotcraft/actions/workflows/ci.yml)
[![version](https://img.shields.io/badge/version-0.10.0-22c55e)](./package.json)
[![Chrome Web Store](https://img.shields.io/chrome-web-store/v/pkhbgheiebgdikjbhegjfbidgbphccfo)](https://chromewebstore.google.com/detail/shotcraft/pkhbgheiebgdikjbhegjfbidgbphccfo)
[![license: MIT](https://img.shields.io/badge/license-MIT-yellow)](./LICENSE)

![shotcraft 介绍：在截取的仪表盘上依次添加马赛克、箭头、矩形和序号徽章，最后保存为 PNG](docs/images/demo.gif)

[English](./README.en.md) · [日本語](./README.md) · **简体中文**

</div>

> **提示：** 扩展界面目前仅提供日语。本文档在按钮名称后附上了中文翻译，方便你与屏幕上看到的内容对应，但界面本身尚未本地化。

这是一个 Chrome 扩展（MV3）：截取你正在浏览的标签页，直接在上面画**箭头、马赛克、文字、裁剪框**等内容，然后导出。从截图到导出的整个过程都在浏览器内完成，图片不会被发送到任何地方。

适合用来做缺陷报告的截图、分享仪表盘、编写操作手册——截图、遮挡、强调、交付，全部在一个标签页里搞定。

![已添加箭头、马赛克和矩形标注的编辑器界面](docs/images/editor-annotations.png)

![显示裁剪框的编辑器界面](docs/images/editor-crop.png)

## 安装

可从 [Chrome 应用商店](https://chromewebstore.google.com/detail/shotcraft/pkhbgheiebgdikjbhegjfbidgbphccfo)点击「添加至 Chrome」进行安装。项目介绍页：[shotcraft.pages.dev](https://shotcraft.pages.dev)。

<details>
<summary>本地加载（开发版）</summary>

```bash
pnpm install && pnpm build
```

1. 在 Chrome 中打开 `chrome://extensions`
2. 打开右上角的「开发者模式」
3. 点击「加载已解压的扩展程序」并选择 `.output/chrome-mv3`
</details>

## 使用方法

点击扩展图标，在弹出窗口的两个按钮中选择截图方式。

| 按钮 | 功能 |
| --- | --- |
| 表示範囲をキャプチャ（截取可见区域） | 截取当前标签页的整个可见区域。 |
| 範囲を選択してキャプチャ（选择区域截图） | 点击光标下的元素以按其边界截图，或拖拽选择一个矩形区域（按 `Esc` 取消）。 |

截图后会在新标签页中打开编辑器。在工具栏选择工具和颜色，然后在图片上拖拽或点击进行绘制。编辑内容会自动保存，重新加载标签页也不会丢失。

- **修改样式**：选择某个工具后，其按钮正下方会展开一个小面板（悬浮面板），只显示与该工具相关的选项——线型、箭头样式、文字大小、填充、马赛克强度等。

  这里的选择会成为下次绘制的默认值。如果先用选择工具选中已有图形再修改，则会立即应用到该图形（「番号」（编号）和「比率」（比例）仅在工具处于选中状态时显示）。设置会保留到下次打开编辑器。
- **颜色**：工具栏的色板决定下一个图形的颜色。若先选中图形再选颜色，该图形的颜色也会随之改变。色板以外的颜色可以用右侧的吸管按钮直接从屏幕上拾取（也可从其他窗口拾取）。
- **导出**：用「形式」（格式）按钮选择 PNG / JPEG / WebP（JPEG 和 WebP 还可设置质量），然后点「保存」下载。「コピー」（复制）始终输出 PNG，以确保能粘贴到任何地方。
- **线条粗细**：固定为 4px（没有提供修改界面）。

## 工具

| 工具 | 快捷键 | 说明 |
| --- | --- | --- |
| 選択（选择） | `V` | 移动、缩放、旋转图形。支持多选和分组。 |
| 矢印（箭头） | `A` | 箭头可选单向 / 双向 / 曲线三种样式。 |
| 直線（直线） | `L` | 绘制没有箭头的直线。 |
| 矩形（矩形） | `R` | 填充可选无 / 半透明。 |
| 楕円（椭圆） | `E` | 填充可选无 / 半透明。 |
| スポットライト（聚光灯） | `O` | 只让框选区域保持明亮，其余部分变暗。无论放置多少个，遮罩始终只有一层，标注也始终保持明亮。 |
| テキスト（文字） | `T` | 字体固定为内置的 Mochiy Pop One。大小可选 S / M / L，也可拖拽四角控制点自由缩放。 |
| ペン（画笔） | `P` | 自由手绘，带防抖处理。 |
| マーカー（马克笔） | `M` | 像荧光笔一样粗而半透明，带防抖处理。 |
| ステップ（步骤） | `S` | 每次点击放置一个带序号的圆形徽章（①②③…）。点「次を1に戻す」（重置编号）可让下一个徽章从 1 开始。 |
| フキダシ（气泡框） | `B` | 圆角气泡框加文字。四个方向的尾巴可分别开关，全部关闭时即为带背景板的文字。 |
| モザイク（马赛克） | `X` | 将框选区域像素化以遮挡信息。粗细根据区域大小自动决定，也可通过强度调整。 |
| ぼかし（模糊） | `U` | 将框选区域模糊化以遮挡信息。四角为圆角。 |
| スマート消しゴム（智能橡皮擦） | `D` | 采集周边颜色，用反距离加权（IDW）混合自然填充该区域。与马赛克和模糊不同，它不会留下「这里遮挡过什么」的痕迹，适合把通知角标、鼠标指针等抹掉并融入背景（在纯色或渐变平缓的背景上效果最佳）。 |
| クロップ（裁剪） | `C` | 裁掉多余部分。比例可选自由 / 1:1 / 4:3 / 16:9。按 `Enter` 确定，可用撤销还原。 |

线型（实线 / 虚线）适用于箭头、直线、矩形、椭圆和画笔。马赛克、模糊、智能橡皮擦和聚光灯**只作用于底图**，不会影响标注（如果想遮挡标注，请把它移到最前面）。

### 边框

可以为整张截图加上边框。这样把图片贴到白色背景的文档中时，边界不会与背景融为一体，整体观感也更完整。它是与工具无关的、逐张图片单独设置的选项，可随时从工具栏的边框按钮切换。

| 类型 | 外观 | 可另行设置的项目 |
| --- | --- | --- |
| 枠線（描边） | 单色线条包围 | 粗细（细 2px / 标准 6px / 粗 12px）和颜色 |
| ブラウザ（浏览器） | 带红绿灯按钮和地址栏的窗口样式（圆角） | 地址栏中显示的 URL |
| ダーク（深色） | 带深色标题栏的窗口样式（圆角） | 标题栏中显示的文字 |

边框加在内容的**外侧**，因此不会遮挡原有内容，输出尺寸会相应变大。浏览器样式的 URL 默认填入截图来源地址，但**会去掉查询字符串（`?...`）和哈希（`#...`）**，以防令牌等信息意外出现在图中。URL 和标题属于该图片本身的内容，因此不会作为设置保存。

## 键盘快捷键

工具切换请参见上方[工具表](#工具)中的快捷键。以下是编辑操作的快捷键（输入文字时全部失效）。

| 按键 | 操作 |
| --- | --- |
| `Shift`（绘制时） | 箭头和直线的角度吸附到 0 / 45 / 90°，矩形变为正方形、椭圆变为正圆 |
| 拖拽时（自动） | 吸附到其他图形和图片的边缘，并显示红色参考线（按 `Shift` 可禁用） |
| 从空白处拖拽 | 框选（橡皮筋选择）多个图形 |
| `Shift` + 点击 | 将图形加入 / 移出选区 |
| `Ctrl` / `Cmd` + `D` | 复制选中的图形（向右下略微偏移） |
| `Alt`（`Option`）+ 拖拽 | 保留原图形，拖出一个副本 |
| `Ctrl` / `Cmd` + `G` | 分组（加 `Shift` 为取消分组） |
| 方向键 | 移动 1px（加 `Shift` 为 10px） |
| `]` / `[` | 上移 / 下移一层（加 `Shift` 为置于最前 / 最后） |
| `Delete` / `Backspace` | 删除选中的图形 |
| `Enter` | 确定裁剪 / 输入文字时为换行 |
| `Ctrl` / `Cmd` + `Enter` | 确定文字输入 |
| `Esc` | 取消选择、取消裁剪（未选中任何图形时返回选择工具）。输入文字时为**确定**输入 |
| `Ctrl` / `Cmd` + `Z` | 撤销（加 `Shift`，或用 `Ctrl` / `Cmd` + `Y` 重做） |
| `Ctrl` / `Cmd` + `C` | 将图片复制到剪贴板 |
| `Ctrl` / `Cmd` + 滚轮 | 以光标为中心缩放（按 `0` 适应整体） |
| 滚轮 / 触控板 | 平移 |

## 隐私

- **完全本地运行**：截图、编辑、导出全部在浏览器内完成，不会向外部发送图片数据。
- **无外部请求**：连标注字体（Mochiy Pop One）都已内置，运行时不会向外部发起任何通信。
- **不在磁盘留存**：截图数据和编辑内容保存在 `storage.session` 中，在你主动执行保存操作前不会写入磁盘。只有设置项（颜色、线型、大小、导出格式、边框类型等）会保存到 `storage.local`，其中不含任何图片数据。
- **最小权限**：仅申请以下三项权限，不申请 `host_permissions`。

| 权限 | 用途 |
| --- | --- |
| `activeTab` | 截取当前标签页的可见区域 |
| `scripting` | 注入区域选择浮层（不使用静态 content script，而是在按下按钮时通过 `scripting.executeScript` 注入） |
| `storage` | 将截图结果和编辑内容保存到会话存储 |

## 架构

使用 [WXT](https://wxt.dev/) + 原生 TypeScript（无框架）构建，画布绘制采用 [Konva](https://konvajs.org/)。

**文档模型是唯一可信来源，Konva 只是它的投影。** 所有图形都表示为可序列化的普通对象 `Shape`（`lib/editor/doc.ts`），屏幕上的 Konva 节点只是 `EditorDoc` 的一次性投影。这样一来，保存、恢复和撤销/重做都可以统一当作数据操作来处理。

**撤销/重做基于快照历史**（`lib/editor/history.ts`）。这是一个持有 past / present / future 的纯数据结构；拖拽过程中的中间状态不会提交，只在操作确定时提交一次，因此历史记录不会被中间状态填满。

**临时存储使用 `storage.session`。** 截图（`capture-store.ts`）和编辑内容（`doc-store.ts`）在浏览器关闭前有效，重新加载标签页可恢复，且不会留在磁盘上。只有新建图形用的样式设置是例外，保存在 `storage.local`（`style-prefs.ts`）中。

```text
entrypoints/
  background.ts            Service Worker，截图处理的核心
  popup/                   扩展图标的弹出窗口（截图的入口）
  editor/                  编辑标签页。Konva 舞台、工具栏和各个工具
  region-select.content.ts 区域选择浮层（通过 scripting 动态注入）
lib/
  editor/                  文档模型、历史记录、持久化与纯计算
                           （crop / mosaic / blur / spotlight / erase / border /
                            snap / selection / callout / step 等）
  capture-store.ts         截图的 storage.session 持久化
  geometry.ts              坐标转换（CSS px 到图片 px）
  theme.ts                 设计令牌的 TS 常量（供 Shadow DOM 使用）
assets/tokens.css          设计令牌（CSS 变量）与 @font-face
public/                    内置字体（WOFF2 和 OFL.txt）与扩展图标
```

## 开发

```bash
pnpm install       # 安装依赖
pnpm dev           # 以专用配置文件启动 Chrome，支持热重载
pnpm build         # 构建生产版本到 .output/chrome-mv3
pnpm zip           # 生成用于分发的 zip
pnpm compile       # 用 tsc --noEmit 进行类型检查
pnpm test          # 用 Vitest 运行单元测试
```

裁剪坐标、马赛克粒度、模糊半径、智能橡皮擦的 IDW 混合、边框尺寸计算、对齐吸附、气泡框换行、步骤编号等纯计算逻辑都拆分在 `lib/editor/` 中，并有 [Vitest](https://vitest.dev/) 测试覆盖。CI 按 compile → test → build → zip 的顺序执行。

## 已知限制

<details>
<summary>部分页面无法截图</summary>

在 `chrome://` 等浏览器内部页面、Chrome 应用商店、扩展管理页面以及其他扩展的页面上，由于 Chrome 自身的限制，无法进行截图和区域选择。执行时扩展图标会显示失败标记（红底 `!`，几秒后自动消失），同时在 Service Worker 的控制台输出警告并结束。
</details>

<details>
<summary>连续截图受浏览器端限制</summary>

`captureVisibleTab` 被浏览器限制为每秒 2 次。短时间内连续截图时，超出的请求不会被丢弃，而是等待空闲槽位后再执行。
</details>

<details>
<summary>JPEG 无法保留透明度</summary>

由于 JPEG 不支持透明通道，导出前会先与白色背景合成（这是防止透明区域变黑的保护措施）。使用圆角边框时的四角同理；PNG / WebP 则会保留透明。
</details>

<details>
<summary>多选状态下无法缩放和旋转</summary>

在多选或分组选择状态下，为保持操作简洁，仅支持移动、删除、复制和微调（恢复为单选后控制点会重新出现）。马赛克、模糊、智能橡皮擦和聚光灯即使单选也无法旋转；文字只能通过四角控制点缩放；步骤徽章尺寸固定，仅支持移动和删除。
</details>

## 反馈

缺陷报告和功能建议请提交到 [Issue](https://github.com/joe41203/shotcraft/issues)。如果是「某个页面无法截图」这类问题，附上目标页面的 URL 和 Chrome 版本会更容易复现。欢迎使用中文或英文提交。

如果发现安全漏洞，请不要提交公开 Issue，而是按照[安全政策](./SECURITY.md)非公开报告。

## 致谢

- **字体**：文字标注使用内置的 [Mochiy Pop One](https://fonts.google.com/specimen/Mochiy+Pop+One)（SIL OFL 1.1，Copyright 2020 The Mochiypop Project Authors）。为避免外部请求，没有采用 Web 字体加载，而是直接内置 WOFF2 文件，体积约 2.1 MB。许可证全文见 [`public/fonts/mochiy-pop-one/OFL.txt`](public/fonts/mochiy-pop-one/OFL.txt)。界面本身使用操作系统的系统字体。
- **图标**：使用本仓库原创的扩展图标（`public/icon/`）。

## 许可证

源代码采用 [MIT License](./LICENSE)。内置字体 Mochiy Pop One 独立适用 SIL Open Font License 1.1，与源代码许可证无关。
