/**
 * 新規図形用スタイル（色・線種・フォントサイズ・塗り・強度・暗さ）の永続化。
 *
 * エディタで最後に選んだ「これから描く図形のスタイル」を browser.storage.local に
 * 保存し、次回エディタを開いたときに前回の設定で始められるようにする。
 * 画像データ・編集内容（doc）は storage.session のままで、ここで扱うのは設定だけ。
 *
 * 保存形式の検証・正規化（normalizeStylePrefs）は純粋関数として分離し、ユニット
 * テスト対象にする。不正値・欠損時は現行のデフォルトへフォールバックする
 * （壊れた保存値や旧バージョンの値でもエディタが必ず既定で立ち上がる）。
 */

import { type ArrowStyle, normalizeArrowStyle } from "./arrow";
import { borderEqual, normalizeBorder } from "./border";
import { type CalloutTail, normalizeCalloutTails } from "./callout";
import { type CropRatio, normalizeCropRatio } from "./crop";
import type { BorderStyle, MosaicBlurIntensity } from "./doc";
import {
	DEFAULT_EXPORT_FORMAT,
	DEFAULT_EXPORT_QUALITY,
	type ExportFormat,
	type ExportQuality,
	normalizeExportFormat,
	normalizeExportQuality,
} from "./export-format";
import { normalizeSpotlightAlpha, SPOTLIGHT_DIM_ALPHA } from "./spotlight";
import { clampFontSize, DEFAULT_FONT_SIZE } from "./text";

/** 新規図形に適用する記憶対象のスタイル。app.ts の EditorContext.style の永続化部分。 */
export interface StylePrefs {
	/** 線・輪郭の色（CSS カラー文字列）。 */
	stroke: string;
	/** 新規の線系図形（矢印・矩形・楕円・ペン）を破線にするか。 */
	dash: boolean;
	/** 新規テキスト・フキダシの既定フォントサイズ（px）。 */
	fontSize: number;
	/** 新規矢印のスタイル（片側 / 両側 / 曲線）。既定は "single"。 */
	arrowStyle: ArrowStyle;
	/** 新規の矩形・楕円に半透明の塗りを付けるか。既定は false（塗りなし）。 */
	fill: boolean;
	/** 新規のモザイク・ぼかしの強度（弱 / 標準 / 強）。既定は "normal"。 */
	intensity: MosaicBlurIntensity;
	/** 新規 doc のスポットライト暗幕の暗さ（不透明度 0〜1）。既定は SPOTLIGHT_DIM_ALPHA。 */
	spotlightAlpha: number;
	/**
	 * 新規フキダシのしっぽの向き（下 / 上 / 左 / 右 の部分集合）。空配列＝しっぽなし。
	 * 既定は ["down"]。旧 calloutTail（単一文字列）の保存値は読み込み時に配列へ変換する。
	 */
	calloutTails: CalloutTail[];
	/** クロップ枠のアスペクト比拘束（自由 / 1:1 / 4:3 / 16:9）。既定は "free"。 */
	cropRatio: CropRatio;
	/** 書き出し形式（PNG / JPEG / WebP）。既定は "png"。 */
	exportFormat: ExportFormat;
	/** 書き出し品質（高 / 標準 / 低。JPEG / WebP のみ有効）。既定は "normal"。 */
	exportQuality: ExportQuality;
	/**
	 * 画像全体を囲むフチ（外枠）。null＝フチなし（既定）。ここに記憶した設定は
	 * 次に開いた画像の初期値になる（前回フチを付けたなら次も付いた状態で始まる）。
	 */
	border: BorderStyle | null;
}

/** 保存値が無い・壊れているときに使う既定スタイル（app.ts の初期値と一致させる）。 */
export const DEFAULT_STYLE_PREFS: StylePrefs = {
	stroke: "#fb7185",
	dash: false,
	fontSize: DEFAULT_FONT_SIZE,
	arrowStyle: "single",
	fill: false,
	intensity: "normal",
	spotlightAlpha: SPOTLIGHT_DIM_ALPHA,
	calloutTails: ["down"],
	cropRatio: "free",
	exportFormat: DEFAULT_EXPORT_FORMAT,
	exportQuality: DEFAULT_EXPORT_QUALITY,
	border: null,
};

/** storage.local のキー。capture/doc（storage.session）とは名前空間を分ける。 */
export const STYLE_PREFS_KEY = "style-prefs";

/**
 * 任意の値を MosaicBlurIntensity へ正規化する純粋関数。
 * "weak" / "normal" / "strong" のいずれかならそのまま、それ以外（未設定・不正値）は
 * "normal"（後方互換の既定）へ落とす。
 */
export function normalizeIntensity(raw: unknown): MosaicBlurIntensity {
	if (raw === "weak" || raw === "normal" || raw === "strong") {
		return raw;
	}
	return "normal";
}

/**
 * 任意の値を StylePrefs へ正規化する純粋関数。
 * - stroke: 非空文字列ならそのまま。それ以外（未設定・数値・空文字など）は既定色。
 * - dash: boolean ならそのまま。それ以外は false（＝実線）。
 * - fontSize: 有限数なら clampFontSize で [MIN, MAX] にクランプ。数値でなければ既定。
 * - arrowStyle: 不正値・未設定は "single"（normalizeArrowStyle が担保）。
 * - fill: boolean ならそのまま。それ以外は false（＝塗りなし）。
 * - intensity: "weak"/"normal"/"strong" のいずれか。それ以外は "normal"。
 * - spotlightAlpha: 有限数なら [0,1] へクランプ。数値でなければ既定（SPOTLIGHT_DIM_ALPHA）。
 * - calloutTails: 4 値の部分集合（空配列＝しっぽなしも許容）。旧 calloutTail（単一文字列）の
 *   保存値は配列へ変換する（両欠落は ["down"]＝後方互換）。
 * - cropRatio: "free"/"1:1"/"4:3"/"16:9" のいずれか。それ以外は "free"。
 * - exportFormat: "png"/"jpeg"/"webp" のいずれか。それ以外は "png"。
 * - exportQuality: "high"/"normal"/"low" のいずれか。それ以外は "normal"。
 * - border: 太さ（正の数）と色を持つオブジェクトのみ有効。未設定・不正値・太さ 0 以下は
 *   null（フチなし＝既定）。
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
	const fill = source.fill;

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
		// 不正値・未設定は "single" へ（normalizeArrowStyle が担保）。
		arrowStyle: normalizeArrowStyle(source.arrowStyle),
		fill: typeof fill === "boolean" ? fill : DEFAULT_STYLE_PREFS.fill,
		intensity: normalizeIntensity(source.intensity),
		spotlightAlpha:
			typeof source.spotlightAlpha === "number" &&
			Number.isFinite(source.spotlightAlpha)
				? normalizeSpotlightAlpha(source.spotlightAlpha)
				: DEFAULT_STYLE_PREFS.spotlightAlpha,
		// tails（新）を優先し、無ければ旧 calloutTail（単一文字列）から変換する。
		// 空配列（しっぽなし）はそのまま通す（各 normalize が担保）。
		calloutTails: normalizeCalloutTails(
			source.calloutTails,
			source.calloutTail,
		),
		cropRatio: normalizeCropRatio(source.cropRatio),
		exportFormat: normalizeExportFormat(source.exportFormat),
		exportQuality: normalizeExportQuality(source.exportQuality),
		// 未設定・不正値・太さ 0 以下はすべて null（フチなし＝後方互換の既定）。
		border: normalizeBorder(source.border),
	};
}

/** しっぽ集合が（順序も含め）同値か。normalize 後は常に同じ並びなので順序比較でよい。 */
function tailsEqual(a: CalloutTail[], b: CalloutTail[]): boolean {
	return a.length === b.length && a.every((t, i) => t === b[i]);
}

/** 2 つのスタイル設定が同値か（過剰な書き込みを避ける同値判定用）。 */
export function stylePrefsEqual(a: StylePrefs, b: StylePrefs): boolean {
	return (
		a.stroke === b.stroke &&
		a.dash === b.dash &&
		a.fontSize === b.fontSize &&
		a.arrowStyle === b.arrowStyle &&
		a.fill === b.fill &&
		a.intensity === b.intensity &&
		a.spotlightAlpha === b.spotlightAlpha &&
		tailsEqual(a.calloutTails, b.calloutTails) &&
		a.cropRatio === b.cropRatio &&
		a.exportFormat === b.exportFormat &&
		a.exportQuality === b.exportQuality &&
		borderEqual(a.border, b.border)
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
 * 色・線種・フォントサイズ等が変わったときに save() を呼べば、直前に書いた値と
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
