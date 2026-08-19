# セキュリティポリシー

[English](#security-policy) · [简体中文](#安全政策)

## 報告方法

脆弱性を見つけた場合は、**公開の Issue ではなく**、GitHub の非公開報告フォームからお知らせください。

**→ [Security Advisories から報告する](https://github.com/joe41203/shotcraft/security/advisories/new)**

（リポジトリの「Security」タブ →「Report a vulnerability」からも開けます）

報告は修正が公開されるまで非公開のまま扱われます。個人開発のため対応にお時間をいただくことがありますが、**7 日以内を目安に受領の返信をするよう努めます**。それを過ぎても返信がない場合は、お手数ですが Issue で「セキュリティの件で連絡した」とだけ書いてお知らせください（詳細は書かないでください）。

## 対象バージョン

| バージョン | サポート |
| --- | --- |
| Chrome ウェブストアの最新版（現在 0.10.0） | ✅ |
| それ以前 | ❌ |

個人開発のため、修正は最新版に対してのみ行います。旧バージョンへのバックポートはしません。

## 報告に含めていただきたい情報

- 再現手順（可能であれば最小限の手順）
- 影響の内容（何が漏れうるか、何が改ざんされうるか）
- 対象のバージョンと Chrome のバージョン
- 該当するページの URL や条件（`chrome://` などの特殊なページかどうか）

## このプロジェクトで特に重要な範囲

shotcraft は「画像を外部に送信しない」ことを設計上の約束にしています。次のようなものは**重大**として扱います。

- 画像データや編集内容が外部へ送信される経路の存在
- `storage.session` にあるはずのデータがディスクへ書き出される挙動
- 宣言した 3 権限（`activeTab` / `scripting` / `storage`）を超える権限の実質的な取得
- 範囲選択オーバーレイの注入を悪用した、閲覧中ページのデータ窃取
- ブラウザ風のフチで、意図せず URL のクエリやハッシュが画像へ写り込む不具合

## 対象外

次のものは脆弱性として扱いません。

- Chrome 自体の制約による動作（`chrome://` などでキャプチャできない、`captureVisibleTab` の 2 回/秒制限）
- 拡張機能が正当な権限の範囲で行う動作（アクティブなタブのキャプチャそのもの）
- 利用者が明示的に保存・コピーした画像の取り扱い
- 開発用依存パッケージのみに影響する問題で、配布物（`.output/chrome-mv3`）に含まれないもの
- 端末への物理アクセス、または既に侵害された OS・ブラウザ環境を前提とする攻撃

## 開示について

修正版を Chrome ウェブストアで公開したのち、原則として GitHub Security Advisory を公開します。ご希望であれば謝辞にお名前を記載します（不要な場合はその旨をお知らせください）。

---

# Security Policy

[日本語](#セキュリティポリシー) · [简体中文](#安全政策)

## Reporting a vulnerability

If you find a vulnerability, please report it through GitHub's private form rather than a **public issue**.

**→ [Report via Security Advisories](https://github.com/joe41203/shotcraft/security/advisories/new)**

(You can also reach it from the repository's "Security" tab → "Report a vulnerability".)

Reports stay private until a fix ships. This is a personal project, so a fix may take some time; I aim to **acknowledge reports within 7 days**, though that is a target rather than a guarantee. If you hear nothing after that, please open an issue saying only that you contacted me about a security matter — do not include any details there.

## Supported versions

| Version | Supported |
| --- | --- |
| Latest Chrome Web Store release (currently 0.10.0) | ✅ |
| Anything older | ❌ |

As a personal project, fixes land on the latest release only. There are no backports.

## What to include

- Steps to reproduce (minimal steps if possible)
- Impact — what could leak, what could be tampered with
- The extension version and your Chrome version
- The URL or conditions involved (for example, whether it is a special page such as `chrome://`)

## What matters most here

shotcraft promises by design that images never leave your browser. The following are treated as **severe**:

- Any path by which image data or edits reach an external destination
- Data that should live in `storage.session` being written to disk
- Effectively obtaining permissions beyond the three declared (`activeTab` / `scripting` / `storage`)
- Abusing the region-select overlay injection to exfiltrate data from the page being viewed
- The browser-style frame leaking a URL's query string or hash into the image unintentionally

## Out of scope

- Behavior imposed by Chrome itself (capture blocked on `chrome://` pages, the two-per-second `captureVisibleTab` limit)
- The extension doing what its declared permissions allow (capturing the active tab, by itself)
- What happens to an image after the user explicitly saves or copies it
- Issues affecting development dependencies only, absent from the shipped `.output/chrome-mv3`
- Attacks that presuppose physical access to the device, or an already-compromised OS or browser

## Disclosure

Once a fixed version is live on the Chrome Web Store, the GitHub Security Advisory is normally published. I will credit you by name on request — just say so if you would rather stay anonymous.

---

# 安全政策

[English](#security-policy) · [日本語](#セキュリティポリシー)

## 报告方式

如果你发现了安全漏洞，请**不要提交公开 Issue**，而是通过 GitHub 的非公开报告表单告知。

**→ [通过 Security Advisories 报告](https://github.com/joe41203/shotcraft/security/advisories/new)**

（也可以从仓库的「Security」标签页 →「Report a vulnerability」进入。）

报告在修复发布前会一直保持非公开。本项目由个人开发，处理可能需要一些时间，我会**尽量在 7 天内回复确认收到**（这是努力目标而非承诺）。若超过该期限仍未收到回复，请开一个 Issue，仅说明「已就安全问题联系过」即可（请勿在其中写出细节）。

## 支持的版本

| 版本 | 是否支持 |
| --- | --- |
| Chrome 应用商店的最新版（当前为 0.10.0） | ✅ |
| 更早的版本 | ❌ |

由于是个人开发，修复只针对最新版本进行，不会向旧版本回溯移植。

## 希望你提供的信息

- 复现步骤（尽可能给出最小步骤）
- 影响范围——什么可能泄露、什么可能被篡改
- 扩展版本和你的 Chrome 版本
- 相关页面的 URL 或触发条件（例如是否为 `chrome://` 这类特殊页面）

## 本项目特别重视的范围

shotcraft 在设计上承诺「图片不会离开你的浏览器」。以下情况将被视为**严重**问题：

- 存在任何可使图片数据或编辑内容发送到外部的途径
- 本应保存在 `storage.session` 中的数据被写入磁盘
- 实际获取了超出已声明的三项权限（`activeTab` / `scripting` / `storage`）的能力
- 滥用区域选择浮层的注入机制，窃取所浏览页面中的数据
- 浏览器样式边框意外将 URL 的查询字符串或哈希写入图片

## 不在范围内

- 由 Chrome 自身限制导致的行为（`chrome://` 等页面无法截图、`captureVisibleTab` 每秒 2 次的限制）
- 扩展在已声明权限范围内的正当行为（截取当前标签页本身）
- 用户主动保存或复制图片之后对该图片的处理
- 仅影响开发依赖、不包含在发布产物（`.output/chrome-mv3`）中的问题
- 以设备物理访问，或已被入侵的操作系统 / 浏览器环境为前提的攻击

## 披露

修复版本在 Chrome 应用商店上线后，原则上会公开对应的 GitHub Security Advisory。如你希望，会在致谢中署名（如不需要请告知）。
