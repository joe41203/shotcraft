import { describe, expect, it } from "vitest";
import {
	type BugReportInput,
	buildBugReportMarkdown,
	formatCapturedAt,
} from "../lib/bug-report";

/** 常に埋まるフィールドだけを持つ最小入力（各テストで省略可フィールドを足す）。 */
const base: BugReportInput = {
	userAgent: "Mozilla/5.0 Test",
	extensionVersion: "0.3.0",
	imageSize: { width: 800, height: 600 },
};

describe("formatCapturedAt", () => {
	it("YYYY-MM-DD HH:mm 形式（ローカル時刻）で整形する", () => {
		// ローカル時刻の年月日時分から Date を作れば、TZ に依らず同じ表記に戻るはず。
		const d = new Date(2026, 6, 31, 9, 5, 3);
		expect(formatCapturedAt(d.getTime())).toBe("2026-07-31 09:05");
	});

	it("月・日・時・分をゼロ埋めする", () => {
		const d = new Date(2026, 0, 2, 3, 4, 5);
		expect(formatCapturedAt(d.getTime())).toBe("2026-01-02 03:04");
	});

	it("TZ 非依存: 出力は同じ Date のローカルゲッターから組み立てた値と一致する", () => {
		// 固定 TZ を前提にせず、フォーマッタが「ローカルゲッター経由」であることを検証する。
		const ms = Date.now();
		const d = new Date(ms);
		const p2 = (n: number): string => String(n).padStart(2, "0");
		const expected =
			`${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}` +
			` ${p2(d.getHours())}:${p2(d.getMinutes())}`;
		expect(formatCapturedAt(ms)).toBe(expected);
	});

	it("非有限な値は null", () => {
		expect(formatCapturedAt(Number.NaN)).toBeNull();
		expect(formatCapturedAt(Number.POSITIVE_INFINITY)).toBeNull();
	});
});

describe("buildBugReportMarkdown", () => {
	it("各見出し（発生した問題・再現手順・期待する動作・スクリーンショット・環境）を含む", () => {
		const md = buildBugReportMarkdown(base);
		expect(md).toContain("## 発生した問題");
		expect(md).toContain("## 再現手順");
		expect(md).toContain("## 期待する動作");
		expect(md).toContain("## スクリーンショット");
		expect(md).toContain("## 環境");
		// 貼り付け案内文（「コピー」ボタンへの誘導）を含む。
		expect(md).toContain(
			"(shotcraft の「コピー」ボタンでコピーした画像をここに貼り付けてください)",
		);
	});

	it("常に埋まる行（画像サイズ・ブラウザ・shotcraft）を出力する", () => {
		const md = buildBugReportMarkdown(base);
		expect(md).toContain("| 画像サイズ | 800 x 600 px |");
		expect(md).toContain("| ブラウザ | Mozilla/5.0 Test |");
		expect(md).toContain("| shotcraft | v0.3.0 |");
	});

	it("省略フィールド（URL・ページ・撮影日時・画面サイズ）は行ごと出力しない", () => {
		const md = buildBugReportMarkdown(base);
		expect(md).not.toContain("| URL |");
		expect(md).not.toContain("| ページ |");
		expect(md).not.toContain("| 撮影日時 |");
		expect(md).not.toContain("| 画面サイズ |");
	});

	it("値がある行だけを出力する（全フィールドあり）", () => {
		const d = new Date(2026, 6, 31, 9, 5, 3);
		const md = buildBugReportMarkdown({
			...base,
			pageUrl: "https://example.com/page",
			pageTitle: "サンプルページ",
			capturedAt: d.getTime(),
			viewport: { width: 1280, height: 720 },
		});
		expect(md).toContain("| URL | https://example.com/page |");
		expect(md).toContain("| ページ | サンプルページ |");
		expect(md).toContain("| 撮影日時 | 2026-07-31 09:05 |");
		expect(md).toContain("| 画面サイズ | 1280 x 720 (CSS px) |");
	});

	it("空文字の pageUrl・pageTitle は falsy として行を出さない", () => {
		const md = buildBugReportMarkdown({
			...base,
			pageUrl: "",
			pageTitle: "",
		});
		expect(md).not.toContain("| URL |");
		expect(md).not.toContain("| ページ |");
	});

	it("環境表のヘッダ行は 1 度だけ・区切り行を伴う", () => {
		const md = buildBugReportMarkdown(base);
		expect(md).toContain("| 項目 | 値 |\n| --- | --- |");
	});
});
