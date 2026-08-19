---
format: 1920x1080
duration: 20s
message: "撮ったスクショを、その場で仕上げて渡せる"
arc: "Hook（手間）→ Answer（価値）→ Demo（実演・保存まで）→ CTA（導線）"
audience: "Chrome 拡張を探している開発者・デザイナー（GitHub README の読者）"
mode: autonomous
music: none
---

## Frame 1 — そのスクショ、加工するの面倒くない？

- status: animated
- src: compositions/frames/01-hook.html
- duration: 2.8s
- transition_in: cut
- scene: 「そのスクショ、加工するの面倒くない？」を全画面のタイプで打ち出し、手間の面倒さを一息で提示する
- voiceover: （無音・画面テキストのみ）そのスクショ、加工するの面倒くない？
- blueprint: kinetic-type-beats
- narrative_role: hook — 視聴者の言葉で「なぜ気にすべきか」を提示する

暗い地（ink-black）に大きな日本語のタイプだけ。別アプリを開いて貼って加工して…という
手間を、素朴な疑問として置く。ロゴも UI もまだ出さない。

**プライバシー訴求はしない**（ユーザー指示）。「外部送信」「権限」の話は初見では
何のことか分からず離脱を招くため、動画では機能の価値だけを見せる。

Adapt: 署名の「フルスクリーンのビートで文が組み上がる」構造は保つ。英語想定の
per-word stagger は日本語に合わないため、**文節単位**のチャンク送りに置き換える。

- Scene 1 (0.0–0.8s): 地のみ。中央やや上に「そのスクショ、」がチャンク送りで入る
  （下から 24px、power3.out、0.5s）。Layout: 中央寄せ 1 カラム、左右マージン 14cqw。
- Scene 2 (0.8–1.6s): 直下に「加工するの面倒くない？」が同じ入り方で続き、問いが完成する。
  文字は cream `#f2f5f9`。2 行目が 11 字と長いためステージ幅 72cqw に収まる 6.0cqw を使う
  （7.5cqw だと 82.5cqw ではみ出す）。行間は 15cqh。
- Scene 3 (1.6–2.8s): 静止して読ませる。「？」にだけ低振幅の jitter。

`handoff_out:` 見出し 2 行 — x: center, y: 50%, scale 1.0, opacity 1, 静止。

## Frame 2 — ぜんぶ、この 1 タブで

- status: animated
- src: compositions/frames/02-value.html
- duration: 3.0s
- transition_in: cut
- scene: 問いに答える一行が入れ替わりで着地し、エメラルドのルールバーが引かれる
- voiceover: （無音・画面テキストのみ）撮影も、編集も、書き出しも。ぜんぶ、この 1 タブで。
- blueprint: kinetic-type-beats
- narrative_role: value — ブリーフの message をビート 2 で着地させる

Adapt: 署名の「ビートごとに文が組み上がりペイオフに着地する」構造を保つ。
ペイオフは語ではなくアクセント色への**色の反転**で作る。

- Scene 1 (0.0–0.5s): 前フレームの問いが上へ抜けながら opacity 1 → 0（cut-the-curve）。
- Scene 2 (0.5–1.3s): 「撮影も、編集も、書き出しも。」が下から入る（h2 級 4.5cqw、
  cream-muted `#9aa6b8`）。まだ答えではなく前置き。
- Scene 3 (1.3–2.2s): 直下に「ぜんぶ、この 1 タブで。」が入る。**「この 1 タブ」だけ
  emerald `#10b981`**、他は cream。文字数があるため 6.0cqw（fit-to-measure で 7.5cqw から
  段階を下げる）。scale 1.04 → 1.0 で着地。ここは「外に出さない」ではなく
  **「別アプリに移らず済む」**という手間の解決として読ませる。
- Scene 4 (2.2–3.0s): 見出し下に emerald のルールバーが中央から左右へ引かれる。

`handoff_in:` 前フレームの見出しが上へ抜ける。
`handoff_out:` エメラルドのルールバー — 静止。次フレームで画面上端のラインへ変形。

## Frame 3 — 実物のエディタ（撮った直後）

- status: animated
- src: compositions/frames/03-editor.html
- duration: 3.4s
- transition_in: crossfade
- scene: 実物どおりのエディタが持ち上がり、撮ったばかりのダッシュボードが素の状態で載っている
- voiceover: （無音・画面テキストのみ）撮ると、すぐこの画面。
- blueprint: device-surface-showcase
- roles: エディタ板 = hero · ツールバー = supporting · 地 = background
- narrative_role: demo-setup — 実物を見せて「これから何が起きるか」の舞台を作る

**ここが作り直しの核**。エディタ UI を実物どおりに HTML/CSS で再現する
（`capture/assets/editor-annotations.png` が見本。実キャプチャは埋め込まない）。

実物の構造（見本より）:
- **上部のダークなツールバー**（面 `#161b26`、高さは板の約 6%）。左から 15 個のツール
  アイコンが並び、選択ツールがアクティブ（emerald の面 + 濃い文字）。区切りのあと
  **丸い色スウォッチ 7 個**（コーラル `#fb7185` / アンバー `#fbbf24` / エメラルド `#34d399` /
  スカイ `#38bdf8` / バイオレット `#a78bfa` / 黒 `#18181b` / 白 `#fafafa`。先頭が選択中で
  二重リング付き）、太さの点 3 つ、undo/redo、右端に「コピー」と emerald の「PNG保存」
  ボタン、さらに右に `1280 x 800 px` と `Weekly Report`。
- **中身は明るいダッシュボード**（`#f4f6fa` 地に白カード）。ここが最重要 —
  実物は「暗い枠の中に明るいページが載っている」。前回これを全部暗くしたため質素に見えた。
  - 見出し「Weekly Report」、右肩に「2026年7月 第5週」
  - 上段に KPI カード 4 枚（アクティブユーザー / 新規登録 **1,204** / 継続率 **92.7%** /
    問い合わせ **37**）。増減は緑 `+3.1%` `+0.8pt` と赤 `-18%` の小さな文字。
  - 下段左に棒グラフ「日次アクティブユーザー」（月〜日の 7 本。紫 `#7c5cf0` と
    スカイ `#38bdf8` を交互、高さはばらつかせる）。
  - 下段右に「最近のデプロイ」表（v2.14.0 / v2.13.2 / v2.13.1 / v2.13.0 / v2.12.4 の 5 行。
    状態は緑の「成功」ピル、v2.13.1 だけアンバーの「再試行」ピル）。

- Scene 1 (0.0–0.9s): 前フレームのルールバーが画面上端へ移り、その下にエディタ板が
  下から入る（scale 0.96 → 1.0, opacity 0 → 1, 0.6s power3.out）。板は 78cqw 幅・中央、
  角丸 10px。**この時点では注釈は 1 つも無い**（撮ったそのまま）。
- Scene 2 (0.9–2.0s): 何も動かさず読ませる。ダッシュボードの情報量そのものが画になる。
- Scene 3 (2.0–3.4s): 板の下に「撮ると、すぐこの画面。」が小さくフェードイン
  （h3 級 2.8cqw、cream-muted）。次フレームの実演へ引き渡す。

`handoff_in:` ルールバーが上端ラインへ拡張。
`handoff_out:` エディタ板 — x: center, y: 46%, scale 1.0, opacity 1。次フレームも同じ位置
・同じ大きさで**板は動かさない**（中身だけが変わる）。

## Frame 4 — 注釈が乗る（実演）

- status: animated
- src: compositions/frames/04-annotate.html
- duration: 8.0s
- transition_in: cut
- scene: 同じ板の中で注釈が順に足され、最後に PNG保存 を押して仕上がりを渡すところまで見せる
- voiceover: （無音・画面テキストのみ）伏せる。指す。囲む。番号を振る。そして保存。
- blueprint: cursor-ui-demo
- roles: エディタ板 = hero · ツールバーのアクティブ状態 = supporting
- narrative_role: demo — 「何ができる拡張なのか」をこのフレームだけで伝える

**板は Frame 3 とまったく同じ位置・同じ描画**（カットで繋いで動かさない）。
変わるのは**ツールバーのアクティブなツール**と、**ダッシュボード上に足されていく注釈**だけ。
ツールが切り替わるたび、そのアイコンが emerald になり、画面に対応する注釈が現れる。
1 手ごとに板の下へ小さなラベル（IBM Plex Mono のキー＋日本語のツール名）を出し、
前のラベルは消す。

- Scene 1 (0.0–1.5s): **モザイク**。ツールバーのモザイクアイコンが emerald に。
  KPI カード 1 枚目（アクティブユーザー）の数値の上にモザイク矩形が現れる（0.35s）。
  細かい市松ではなく**粗いピクセルのブロック**として描く。ラベル「X ── モザイクで伏せる」。
- Scene 2 (1.5–3.2s): **矢印とテキスト**。矢印アイコンが emerald に。棒グラフの上に
  コーラル `#fb7185` の「週末に急伸」が先に出て、そこから金曜の棒へ**コーラルの矢印が伸びる**
  （0.45s で伸長。頭が潰れないよう width で描く）。ラベル「A ── 矢印で指す」。
- Scene 3 (3.2–4.7s): **矩形強調**。矩形アイコンが emerald に。デプロイ表の「再試行」の行に
  コーラルの角丸矩形が描かれる（線幅 4px、0.4s で広がる）。ラベル「R ── 矩形で囲む」。
- Scene 4 (4.7–6.4s): **ステップ**。ステップアイコンが emerald に。KPI カードの上に
  emerald の丸バッジ ① ② が 0.3s 間隔で置かれる（scale 0.6 → 1.0, back.out(1.6)）。
  ラベル「S ── 番号を振る」。
- Scene 5 (6.4–8.0s): **保存**。ラベル列が引き、ツールバー右端の emerald「PNG保存」が
  押される（scale 0.96 まで沈んで back.out で戻る press-release-spring）。続いて板の下に
  `Weekly Report.png を保存しました` がせり上がる（IBM Plex Mono、ファイル名だけ emerald）。
  最後は静止して全体を読ませる。

`handoff_in:` cut。板は Frame 3 と同一の見え方から始まる。
`handoff_out:` 注釈が全部乗った板 — x: center, y: 46%, scale 1.0, opacity 1。

## Frame 5 — shotcraft / ウェブストアで公開中

- status: animated
- src: compositions/frames/05-cta.html
- duration: 3.0s
- transition_in: crossfade
- scene: アイコンとワードマークが中央に組み上がり、下にウェブストアの導線が出る
- voiceover: （無音・画面テキストのみ）shotcraft — Chrome ウェブストアで公開中
- blueprint: logo-assemble-lockup
- roles: アイコン = hero · ワードマーク = supporting
- asset_candidates: assets/icon-128.png
- narrative_role: cta — 次の行動先を一つだけ示す

Adapt: パーツからの組み上げではなく、**前フレームの板が消えた中心からスプリングで実体化**
する scale-swap で受ける（尺が短いため組み上げの尺がない）。

- Scene 1 (0.0–0.7s): 注釈入りの板が scale 0.92 まで縮みながら opacity 0 へ。同じ中心にアイコンが
  scale 0.6 → 1.0 のスプリングで着地（back.out(1.6), 0.5s）。アイコンは 8cqw 角。
- Scene 2 (0.7–1.3s): アイコンが左へ寄り、空いた右にワードマーク「shotcraft」が
  スライドインしてフェード（h1 級 7.5cqw、cream）。**ロックアップ全体が中央に来るよう
  fit-content + xPercent で寄せる**（固定 px 移動だと中心がずれる）。
- Scene 3 (1.3–2.2s): ロックアップ下に「Chrome ウェブストアで公開中」がフェードイン
  （h3 級 2.8cqw、emerald）。CTA はこの一つだけ。
- Scene 4 (2.2–3.0s): さらに下に `MIT License · 無料 · v0.10.0` が IBM Plex Mono の
  label 級、cream-hint で控えめに入る。以後静止。終端は暗い地・中央構図のまま終わり、
  Frame 1 へループでつながる。

`handoff_in:` 前フレームの注釈入りの板を opacity 1 / scale 1 のまま受け取り、
縮めながら消す。同じ中心にアイコンが scale-swap で入る。

## Video direction

- **一貫した地**: 全フレーム ink-black `#0b0f19`。register は `dark` のみ。
  emerald 全面の register は使わない。
- **エディタの中身は明るい**: 実物どおり、暗いツールバーの中に明るいダッシュボードが載る。
  この明暗差が画の情報量を作る（前回はここを暗くして質素に見えた）。
- **板は Frame 3〜4 で動かさない**: 同じ位置・同じ大きさに置き続け、中身の変化だけを見せる。
  カメラは静止（GIF でフレームが間引かれるため）。
- **アクセントの節約**: emerald は「アクティブなツール」「保存ボタン」「保存したファイル名」
  「CTA」に限る。注釈自体はコーラル `#fb7185` を主に使い、emerald と役割を分ける。
- **プライバシー訴求はしない**（ユーザー指示）: 「外部送信ゼロ」「権限は 3 つだけ」
  「host_permissions なし」は初見では文脈が分からず離脱を招くため、動画では扱わない。
  これらは README とストア掲載文で説明する。
- **モーションの原則**: 動きは 0.3〜0.6s、power3 系。GIF で間引かれるため微細で長い
  イージングは使わない。
- **可読性**: GIF は 960px 幅程度に縮む。UI の細部（KPI の数値等）は読めなくてよいが、
  **注釈・ラベル・権限チップは読める大きさ**にする。最小 h3（2.8cqw）。
- **ループ設計**: Frame 5 の終端と Frame 1 の始端はどちらも暗い地・中央構図。
- **書体**: 表示は Noto Sans JP（400/700 のみ）、ラベル・英数字は IBM Plex Mono。
  Mochiy Pop One は製品の注釈書体であり動画では使わない。
- **フォント宣言禁止**: Noto Sans JP / IBM Plex Mono はコンパイラのプリバンドル対象。
  `@font-face` を書かない（プロジェクトにフォントファイルは無い）。
- **id は英字始まり**: 数字始まりの id は CSS セレクタとして不正。クラスか英字接頭辞を使う。
- **クリップの同一トラック重複禁止**: 同時に見える要素は別の `data-track-index` に置く。
