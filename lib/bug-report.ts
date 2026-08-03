/**
 * バグ報告テンプレート（Markdown）の純粋生成ロジック。
 *
 * DOM・ブラウザ API・クリップボードには一切触れない（呼び出し側で navigator や
 * browser.runtime から値を集めてここへ渡す）。値が無い環境行は行ごと出力しない。
 * 撮影日時のフォーマットもタイムゾーン非依存（ローカル時刻のゲッター経由）で組み立てる。
 */

/** 画面・画像のサイズ（幅 x 高さ）。 */
export interface BugReportSize {
	width: number;
	height: number;
}

/** buildBugReportMarkdown の入力。省略可のフィールドは値が取れなかったときに欠落する。 */
export interface BugReportInput {
	/** 撮影元ページの URL（chrome:// 等で取れなければ省略）。 */
	pageUrl?: string;
	/** 撮影元ページのタイトル（取れなければ省略）。 */
	pageTitle?: string;
	/** 撮影時刻（epoch ms）。取れなければ省略。 */
	capturedAt?: number;
	/** 撮影時のビューポート（CSS px）。取れる経路のみ。 */
	viewport?: BugReportSize;
	/** navigator.userAgent（呼び出し側で渡す）。 */
	userAgent: string;
	/** browser.runtime.getManifest().version（呼び出し側で渡す）。 */
	extensionVersion: string;
	/** 出力画像のサイズ（クロップ適用後の原寸）。 */
	imageSize: BugReportSize;
}

/**
 * epoch ms を "YYYY-MM-DD HH:mm"（ローカル時刻）へ整形する純粋関数。
 * Date のローカルゲッター（getFullYear 等）で組み立てるため、実行環境の TZ に応じた
 * ローカル時刻になる（UTC 固定ではない）。無効な値（非有限）は null を返す。
 */
export function formatCapturedAt(epochMs: number): string | null {
	if (!Number.isFinite(epochMs)) return null;
	const d = new Date(epochMs);
	const p2 = (n: number): string => String(n).padStart(2, "0");
	const date = `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}`;
	const time = `${p2(d.getHours())}:${p2(d.getMinutes())}`;
	return `${date} ${time}`;
}

/** 環境表の 1 行（`| 項目 | 値 |`）を組み立てる。 */
function tableRow(label: string, value: string): string {
	return `| ${label} | ${value} |`;
}

/**
 * バグ報告用の Markdown テンプレートを組み立てる。
 *
 * 環境表は値が取れた行だけを出力する（pageUrl・pageTitle・capturedAt・viewport は
 * 省略され得るため、欠落時はその行を丸ごと落とす）。userAgent・extensionVersion・
 * imageSize は常に渡される想定なので常に出力する。
 */
export function buildBugReportMarkdown(input: BugReportInput): string {
	const rows: string[] = [];
	if (input.pageUrl) rows.push(tableRow("URL", input.pageUrl));
	if (input.pageTitle) rows.push(tableRow("ページ", input.pageTitle));
	if (input.capturedAt != null) {
		const captured = formatCapturedAt(input.capturedAt);
		if (captured != null) rows.push(tableRow("撮影日時", captured));
	}
	if (input.viewport) {
		rows.push(
			tableRow(
				"画面サイズ",
				`${input.viewport.width} x ${input.viewport.height} (CSS px)`,
			),
		);
	}
	rows.push(
		tableRow(
			"画像サイズ",
			`${input.imageSize.width} x ${input.imageSize.height} px`,
		),
	);
	rows.push(tableRow("ブラウザ", input.userAgent));
	rows.push(tableRow("shotcraft", `v${input.extensionVersion}`));

	return `## 発生した問題

(ここに問題の内容を書いてください)

## 再現手順

1.
2.
3.

## 期待する動作

(期待した結果を書いてください)

## スクリーンショット

(shotcraft の「コピー」ボタンでコピーした画像をここに貼り付けてください)

## 環境

| 項目 | 値 |
| --- | --- |
${rows.join("\n")}
`;
}
