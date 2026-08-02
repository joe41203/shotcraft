/**
 * 新規図形用スタイル（色・線種・フォントサイズ）の永続化。
 *
 * エディタで最後に選んだ「これから描く図形のスタイル」を browser.storage.local に
 * 保存し、次回エディタを開いたときに前回の設定で始められるようにする。
 * 画像データ・編集内容（doc）は storage.session のままで、ここで扱うのは設定だけ。
 *
 * 保存形式の検証・正規化（normalizeStylePrefs）は純粋関数として分離し、ユニット
 * テスト対象にする。不正値・欠損時は現行のデフォルトへフォールバックする
 * （壊れた保存値や旧バージョンの値でもエディタが必ず既定で立ち上がる）。
 */

import { clampFontSize, DEFAULT_FONT_SIZE } from "./text";

/** 新規図形に適用する記憶対象のスタイル。app.ts の EditorContext.style の永続化部分。 */
export interface StylePrefs {
	/** 線・輪郭の色（CSS カラー文字列）。 */
	stroke: string;
	/** 新規の線系図形（矢印・矩形・楕円・ペン）を破線にするか。 */
	dash: boolean;
	/** 新規テキストの既定フォントサイズ（px）。 */
	fontSize: number;
}

/** 保存値が無い・壊れているときに使う既定スタイル（app.ts の初期値と一致させる）。 */
export const DEFAULT_STYLE_PREFS: StylePrefs = {
	stroke: "#fb7185",
	dash: false,
	fontSize: DEFAULT_FONT_SIZE,
};

/** storage.local のキー。capture/doc（storage.session）とは名前空間を分ける。 */
export const STYLE_PREFS_KEY = "style-prefs";

/**
 * 任意の値を StylePrefs へ正規化する純粋関数。
 * - stroke: 非空文字列ならそのまま。それ以外（未設定・数値・空文字など）は既定色。
 * - dash: boolean ならそのまま。それ以外は false（＝実線）。
 * - fontSize: 有限数なら clampFontSize で [MIN, MAX] にクランプ。数値でなければ既定。
 * 部分的に壊れていても、壊れたキーだけ既定へ落として全体は必ず有効な値を返す。
 */
export function normalizeStylePrefs(raw: unknown): StylePrefs {
	const source =
		typeof raw === "object" && raw !== null
			? (raw as Record<string, unknown>)
			: {};

	const stroke = source.stroke;
	const dash = source.dash;
	const fontSize = source.fontSize;

	return {
		stroke:
			typeof stroke === "string" && stroke.length > 0
				? stroke
				: DEFAULT_STYLE_PREFS.stroke,
		dash: typeof dash === "boolean" ? dash : DEFAULT_STYLE_PREFS.dash,
		fontSize:
			typeof fontSize === "number" && Number.isFinite(fontSize)
				? clampFontSize(fontSize)
				: DEFAULT_STYLE_PREFS.fontSize,
	};
}

/** 2 つのスタイル設定が同値か（過剰な書き込みを避ける同値判定用）。 */
export function stylePrefsEqual(a: StylePrefs, b: StylePrefs): boolean {
	return (
		a.stroke === b.stroke && a.dash === b.dash && a.fontSize === b.fontSize
	);
}

/**
 * 保存済みスタイル設定を storage.local から読み込んで正規化する。
 * 保存値が無い・読み取りに失敗した場合も既定値を返す（エディタ起動を止めない）。
 */
export async function loadStylePrefs(): Promise<StylePrefs> {
	try {
		const result = await browser.storage.local.get(STYLE_PREFS_KEY);
		return normalizeStylePrefs(result[STYLE_PREFS_KEY]);
	} catch {
		return { ...DEFAULT_STYLE_PREFS };
	}
}

/** スタイル設定を storage.local に保存する。 */
export async function saveStylePrefs(prefs: StylePrefs): Promise<void> {
	await browser.storage.local.set({ [STYLE_PREFS_KEY]: prefs });
}

/**
 * スタイル設定の保存を「同値なら書かない」形にまとめたセーバを作る。
 * 色・線種・フォントサイズが変わったときに save() を呼べば、直前に書いた値と
 * 同値のときは storage への書き込みをスキップする（過剰な書き込みを避ける）。
 * initial には読み込み時の値を渡し、起動直後の同値保存を抑止する。
 */
export function createStylePrefsSaver(initial: StylePrefs): {
	save(prefs: StylePrefs): void;
} {
	let last: StylePrefs = { ...initial };
	return {
		save(prefs: StylePrefs): void {
			const next = normalizeStylePrefs(prefs);
			if (stylePrefsEqual(next, last)) return;
			last = next;
			void saveStylePrefs(next);
		},
	};
}
