/**
 * コールアウト（フキダシ）注釈の寸法・色の純粋計算。
 * 本体の角丸・パディング・しっぽの形状、淡い背景色の解決など、
 * 描画（render.ts）とテキスト折返し高さの算出で共有する値をここに集める。
 */

import type { CalloutTail } from "./doc";

// しっぽの向きの型は doc.ts が正（CalloutShape.tails と一致させるため）。
// しっぽ関連のロジック（正規化・頂点計算）をここに集約するので、利用側が
// callout.ts から型も取れるよう再エクスポートする。
export type { CalloutTail };

/** 本体（角丸長方形）の角丸半径（px）。 */
export const CALLOUT_CORNER_RADIUS = 8;

/** 本体内側のパディング（px）。テキストは本体からこの分だけ内側に置く。 */
export const CALLOUT_PADDING = 10;

/** 辺の中央から出すしっぽ（三角）の幅（付け根の長さ）・高さ（外への突き出し）（px）。 */
export const CALLOUT_TAIL_WIDTH = 18;
export const CALLOUT_TAIL_HEIGHT = 12;

/** しっぽの向きの既定（省略時）。下辺中央から下向き＝従来の形状。 */
export const DEFAULT_CALLOUT_TAIL: CalloutTail = "down";

/**
 * 任意の値を CalloutTail（下 / 上 / 左 / 右）へ正規化する純粋関数。
 * 4 値のいずれかならそのまま、それ以外（未設定・不正値・旧データ）は "down"
 * （後方互換の既定）へ落とす。doc の読み込み・style-prefs の検証で使う。
 */
export function normalizeCalloutTail(raw: unknown): CalloutTail {
	if (raw === "down" || raw === "up" || raw === "left" || raw === "right") {
		return raw;
	}
	return DEFAULT_CALLOUT_TAIL;
}

/** しっぽの 4 方向の並び順（重複除去・出力順の正）。 */
const TAIL_ORDER: readonly CalloutTail[] = ["down", "up", "left", "right"];

/**
 * フキダシのしっぽ集合（複数選択）を正規化する純粋関数。空配列 = しっぽなし。
 *
 * 後方互換の読み込み正規化を兼ねる:
 * - `tails`（配列）があればそれを採る。各要素を CalloutTail として検証し、不正値を
 *   除き、重複を畳んで TAIL_ORDER（下→上→左→右）の順に整える。**空配列はそのまま
 *   空配列**（しっぽなし＝背景プレート付きテキスト）として通す。
 * - `tails` が無く `tail`（旧・単一値）があれば、それ 1 個の配列へ変換する。
 * - どちらも無ければ従来互換の既定 ["down"]（下辺中央から下向き）。
 *
 * @param tails CalloutShape.tails（新）。配列でなければ「未設定」として扱う。
 * @param legacyTail CalloutShape.tail（旧・単一値）。tails 未設定時のフォールバック元。
 */
export function normalizeCalloutTails(
	tails: unknown,
	legacyTail?: unknown,
): CalloutTail[] {
	if (Array.isArray(tails)) {
		const set = new Set<CalloutTail>();
		for (const raw of tails) {
			if (raw === "down" || raw === "up" || raw === "left" || raw === "right") {
				set.add(raw);
			}
		}
		// 空配列はしっぽなしとしてそのまま返す（既定 ["down"] へ落とさない）。
		return TAIL_ORDER.filter((t) => set.has(t));
	}
	// tails 未設定なら旧 tail（あれば）1 個、無ければ従来互換の ["down"]。
	if (legacyTail !== undefined) {
		return [normalizeCalloutTail(legacyTail)];
	}
	return [DEFAULT_CALLOUT_TAIL];
}

/** 新規フキダシの既定サイズ（ドラッグが極小だったときのフォールバックにも使う）。 */
export const CALLOUT_DEFAULT_WIDTH = 160;
export const CALLOUT_DEFAULT_HEIGHT = 64;

/** 本体背景に使う淡い塗りの不透明度（枠線・文字は不透明色のまま）。 */
export const CALLOUT_FILL_ALPHA = 0.15;

/**
 * 本体幅からテキスト描画領域の幅（px）を求める。左右パディングを差し引く。
 * パディングで潰れないよう最低 1px を保証する。
 */
export function calloutInnerWidth(
	width: number,
	padding: number = CALLOUT_PADDING,
): number {
	return Math.max(1, width - padding * 2);
}

/**
 * テキストの描画高さ（px）から本体の高さ（px）を求める。上下パディングを足す。
 * テキストが空でも潰れないよう最低 1 行分＋パディングを下限にする。
 */
export function calloutBodyHeight(
	textHeight: number,
	fontSize: number,
	padding: number = CALLOUT_PADDING,
): number {
	const minText = Math.max(textHeight, fontSize);
	return Math.ceil(minText + padding * 2);
}

/**
 * `#rgb` / `#rrggbb` を rgba() 文字列へ変換する（本体の淡い背景色に使う）。
 * 解釈できない入力はそのまま返す（Konva 側で無害にフォールバックさせる）。
 */
export function hexToRgba(hex: string, alpha: number): string {
	const m = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(hex.trim());
	const digits = m?.[1];
	if (!digits) return hex;
	const body =
		digits.length === 3
			? digits
					.split("")
					.map((c) => c + c)
					.join("")
			: digits;
	const r = Number.parseInt(body.slice(0, 2), 16);
	const g = Number.parseInt(body.slice(2, 4), 16);
	const b = Number.parseInt(body.slice(4, 6), 16);
	const a = Math.min(1, Math.max(0, alpha));
	return `rgba(${r}, ${g}, ${b}, ${a})`;
}

/**
 * 本体矩形（x,y,width,height）から、指定した向きの辺の中央に付けるしっぽ（三角）の
 * 3 頂点を返す。頂点は「付け根の一方 → 付け根の他方 → 外向きの先端」の順（付け根 2 点は
 * 辺に沿い、先端は辺の中央から tailHeight だけ外へ突き出す）。tail 既定は "down"
 * （下辺中央から下向き＝従来形状）で、この既定のとき戻り値は従来と完全一致する。
 * tailWidth はしっぽの付け根の長さ、tailHeight は外への突き出し量。
 */
export function calloutTailPoints(
	x: number,
	y: number,
	width: number,
	height: number,
	tailWidth: number = CALLOUT_TAIL_WIDTH,
	tailHeight: number = CALLOUT_TAIL_HEIGHT,
	tail: CalloutTail = DEFAULT_CALLOUT_TAIL,
): number[] {
	const cx = x + width / 2;
	const cy = y + height / 2;
	const left = x;
	const right = x + width;
	const top = y;
	const bottom = y + height;
	const half = tailWidth / 2;

	switch (tail) {
		case "up":
			// 上辺中央から上向き。付け根は上辺（左→右）、先端は上へ。
			return [cx - half, top, cx + half, top, cx, top - tailHeight];
		case "left":
			// 左辺中央から左向き。付け根は左辺（上→下）、先端は左へ。
			return [left, cy - half, left, cy + half, left - tailHeight, cy];
		case "right":
			// 右辺中央から右向き。付け根は右辺（上→下）、先端は右へ。
			return [right, cy - half, right, cy + half, right + tailHeight, cy];
		default:
			// "down": 下辺中央から下向き（従来形状）。付け根は下辺（左→右）、先端は下へ。
			return [cx - half, bottom, cx + half, bottom, cx, bottom + tailHeight];
	}
}
