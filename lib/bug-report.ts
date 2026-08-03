/**
 * バグ報告ラベル（画像へ配置する塗りつぶしテキストプレート）の文言を組み立てる
 * 純粋ロジック。
 *
 * DOM・ブラウザ API には一切触れない（呼び出し側で navigator や browser.runtime から
 * 値を集めてここへ渡す）。値が取れなかった項目はその行・その要素を省く。撮影日時の
 * フォーマットもタイムゾーン非依存（ローカル時刻のゲッター経由）で組み立てる。
 */

/** 画面サイズ（幅 x 高さ）。 */
export interface BugReportSize {
	width: number;
	height: number;
}

/** buildBugReportLabelText の入力。省略可のフィールドは値が取れなかったときに欠落する。 */
export interface BugReportLabelInput {
	/** 撮影元ページのタイトル（取れなければ省略）。 */
	pageTitle?: string;
	/** 撮影元ページの URL（chrome:// 等で取れなければ省略）。 */
	pageUrl?: string;
	/** 撮影時刻（epoch ms）。取れなければ省略。 */
	capturedAt?: number;
	/** 撮影時のビューポート（CSS px）。取れる経路（範囲選択・フルページ）のみ。 */
	viewport?: BugReportSize;
	/** navigator.userAgent（呼び出し側で渡す）。短縮表記に変換して必ず 1 行入れる。 */
	userAgent: string;
}

/** 抽出に失敗した userAgent を丸める最大文字数（プレート内に収める）。 */
export const UA_FALLBACK_MAX_LENGTH = 60;

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

/**
 * userAgent 文字列から「ブラウザ名 メジャーバージョン (OS)」の短縮表記を作る純粋関数。
 * 例: "Chrome 150 (macOS)"、"Edge 130 (Windows)"。UA は自由書式のため厳密なパースは
 * せず、主要ブラウザ・OS を素朴なパターンで拾う（ラベルの補助情報なので厳密さより頑健さを
 * 優先する）。ブラウザ名すら判定できないときは生 UA の先頭 UA_FALLBACK_MAX_LENGTH 文字へ
 * 丸めて返す（何も出さないより情報が残る）。空入力は "不明"。
 */
export function shortenUserAgent(userAgent: string): string {
	const ua = (userAgent ?? "").trim();
	if (ua.length === 0) return "不明";

	// ブラウザ名 + メジャーバージョン。Edge/OPR は Chrome も名乗るため先に判定する。
	const browser = ((): string | null => {
		const patterns: { name: string; re: RegExp }[] = [
			{ name: "Edge", re: /Edg(?:e|A|iOS)?\/(\d+)/ },
			{ name: "Opera", re: /OPR\/(\d+)/ },
			{ name: "Firefox", re: /Firefox\/(\d+)/ },
			// Chrome より前に Chromium を拾わないよう Chrome を先に見る。
			{ name: "Chrome", re: /Chrome\/(\d+)/ },
			// Safari は Version/x.y が実バージョン（Safari/605.x はエンジン版）。
			{ name: "Safari", re: /Version\/(\d+)[\d.]*\s+Safari/ },
		];
		for (const p of patterns) {
			const m = ua.match(p.re);
			if (m) return `${p.name} ${m[1]}`;
		}
		return null;
	})();

	// OS 名。代表的なものだけ拾う。
	const os = ((): string | null => {
		if (/Windows NT/.test(ua)) return "Windows";
		// iPhone/iPad は Mac OS X も名乗るため Mac 判定より先に見る。
		if (/iPhone|iPad|iPod/.test(ua)) return "iOS";
		if (/Mac OS X|Macintosh/.test(ua)) return "macOS";
		if (/Android/.test(ua)) return "Android";
		if (/Linux/.test(ua)) return "Linux";
		return null;
	})();

	// ブラウザ名が取れなければ、生 UA を丸めて返す（抽出失敗時のフォールバック）。
	if (!browser) {
		return ua.length > UA_FALLBACK_MAX_LENGTH
			? `${ua.slice(0, UA_FALLBACK_MAX_LENGTH)}…`
			: ua;
	}
	return os ? `${browser} (${os})` : browser;
}

/**
 * バグ報告ラベルの文言（複数行テキスト）を組み立てる。取れた項目だけを順に出す:
 *   1) ページタイトル（1 行）
 *   2) URL（1 行）
 *   3) 「撮影日時 | 画面サイズ」の 1 行（区切りは " | "。両方無ければ行ごと省く）
 *   4) ブラウザ短縮表記（1 行。UA から必ず 1 行入れる）
 * プレート内に収まる簡潔さを優先し、余分な見出し・記号は入れない。
 */
export function buildBugReportLabelText(input: BugReportLabelInput): string {
	const lines: string[] = [];
	if (input.pageTitle) lines.push(input.pageTitle);
	if (input.pageUrl) lines.push(input.pageUrl);

	// 3 行目: 撮影日時・画面サイズを " | " で連結（取れたものだけ）。
	const metaParts: string[] = [];
	if (input.capturedAt != null) {
		const captured = formatCapturedAt(input.capturedAt);
		if (captured != null) metaParts.push(captured);
	}
	if (input.viewport) {
		metaParts.push(`${input.viewport.width}x${input.viewport.height}`);
	}
	if (metaParts.length > 0) lines.push(metaParts.join(" | "));

	// 4 行目: ブラウザ短縮表記（UA から必ず入れる）。
	lines.push(shortenUserAgent(input.userAgent));

	return lines.join("\n");
}
