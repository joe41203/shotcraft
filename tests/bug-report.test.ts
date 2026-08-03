import { describe, expect, it } from "vitest";
import {
	type BugReportLabelInput,
	buildBugReportLabelText,
	formatCapturedAt,
	shortenUserAgent,
	UA_FALLBACK_MAX_LENGTH,
} from "../lib/bug-report";

// 代表的な userAgent サンプル（短縮表記の検証用）。
const UA_CHROME_MAC =
	"Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36";
const UA_EDGE_WIN =
	"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36 Edg/130.0.0.0";
const UA_FIREFOX_LINUX =
	"Mozilla/5.0 (X11; Linux x86_64; rv:128.0) Gecko/20100101 Firefox/128.0";
const UA_SAFARI_MAC =
	"Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Safari/605.1.15";

/** UA だけを持つ最小入力（各テストで省略可フィールドを足す）。 */
const base: BugReportLabelInput = {
	userAgent: UA_CHROME_MAC,
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

describe("shortenUserAgent", () => {
	it("Chrome + macOS を短縮表記にする", () => {
		expect(shortenUserAgent(UA_CHROME_MAC)).toBe("Chrome 150 (macOS)");
	});

	it("Edge は Chrome より優先して判定する（Windows）", () => {
		expect(shortenUserAgent(UA_EDGE_WIN)).toBe("Edge 130 (Windows)");
	});

	it("Firefox + Linux を短縮表記にする", () => {
		expect(shortenUserAgent(UA_FIREFOX_LINUX)).toBe("Firefox 128 (Linux)");
	});

	it("Safari は Version/x を実バージョンとして拾う（macOS）", () => {
		expect(shortenUserAgent(UA_SAFARI_MAC)).toBe("Safari 17 (macOS)");
	});

	it("空入力は '不明'", () => {
		expect(shortenUserAgent("")).toBe("不明");
		expect(shortenUserAgent("   ")).toBe("不明");
	});

	it("ブラウザ名を判定できない短い UA は生のまま返す（丸めない）", () => {
		expect(shortenUserAgent("totally-unknown-agent")).toBe(
			"totally-unknown-agent",
		);
	});

	it("ブラウザ名を判定できない長い UA は先頭 60 文字＋… に丸める", () => {
		const long = "x".repeat(100);
		const out = shortenUserAgent(long);
		expect(out).toBe(`${"x".repeat(UA_FALLBACK_MAX_LENGTH)}…`);
		// 丸め後は 60 文字 + 省略記号 1 文字。
		expect(out.length).toBe(UA_FALLBACK_MAX_LENGTH + 1);
	});
});

describe("buildBugReportLabelText", () => {
	it("全項目あり: タイトル・URL・（撮影日時 | 画面サイズ）・ブラウザ行を順に出す", () => {
		const d = new Date(2026, 6, 31, 9, 5, 3);
		const text = buildBugReportLabelText({
			pageTitle: "サンプルページ",
			pageUrl: "https://example.com/page",
			capturedAt: d.getTime(),
			viewport: { width: 1280, height: 720 },
			userAgent: UA_CHROME_MAC,
		});
		// ブラウザは独立した 4 行目（3 行目は撮影日時 | 画面サイズ）。
		expect(text).toBe(
			"サンプルページ\n" +
				"https://example.com/page\n" +
				"2026-07-31 09:05 | 1280x720\n" +
				"Chrome 150 (macOS)",
		);
	});

	it("タイトル・URL が無ければその行を出さない（メタ行＋ブラウザ行のみ）", () => {
		const d = new Date(2026, 0, 2, 3, 4, 5);
		const text = buildBugReportLabelText({
			capturedAt: d.getTime(),
			viewport: { width: 800, height: 600 },
			userAgent: UA_CHROME_MAC,
		});
		expect(text).toBe("2026-01-02 03:04 | 800x600\nChrome 150 (macOS)");
	});

	it("撮影日時・viewport が無ければメタ行を省きブラウザ行だけ残す", () => {
		const text = buildBugReportLabelText({
			pageTitle: "タイトルのみ",
			userAgent: UA_EDGE_WIN,
		});
		expect(text).toBe("タイトルのみ\nEdge 130 (Windows)");
	});

	it("空文字の pageTitle・pageUrl は falsy として行を出さない", () => {
		const text = buildBugReportLabelText({
			pageTitle: "",
			pageUrl: "",
			userAgent: UA_CHROME_MAC,
		});
		// ブラウザ行だけになる。
		expect(text).toBe("Chrome 150 (macOS)");
	});

	it("非有限な撮影日時はメタ行から日時要素を落とす（画面サイズだけ残る）", () => {
		const text = buildBugReportLabelText({
			capturedAt: Number.NaN,
			viewport: { width: 640, height: 480 },
			userAgent: UA_CHROME_MAC,
		});
		expect(text).toBe("640x480\nChrome 150 (macOS)");
	});

	it("UA だけの最小入力でもブラウザ行が必ず出る", () => {
		expect(buildBugReportLabelText(base)).toBe("Chrome 150 (macOS)");
	});
});
