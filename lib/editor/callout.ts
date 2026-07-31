/**
 * コールアウト（フキダシ）注釈の寸法・色の純粋計算。
 * 本体の角丸・パディング・しっぽの形状、淡い背景色の解決など、
 * 描画（render.ts）とテキスト折返し高さの算出で共有する値をここに集める。
 */

/** 本体（角丸長方形）の角丸半径（px）。 */
export const CALLOUT_CORNER_RADIUS = 8;

/** 本体内側のパディング（px）。テキストは本体からこの分だけ内側に置く。 */
export const CALLOUT_PADDING = 10;

/** 下辺中央から出すしっぽ（三角）の幅・高さ（px）。 */
export const CALLOUT_TAIL_WIDTH = 18;
export const CALLOUT_TAIL_HEIGHT = 12;

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
 * 本体矩形（x,y,width,height）から、下辺中央に付けるしっぽ（三角）の
 * 3 頂点を返す。頂点は左→右→下先端の順。本体下辺の中央から真下へ尖らせる。
 */
export function calloutTailPoints(
	x: number,
	y: number,
	width: number,
	height: number,
	tailWidth: number = CALLOUT_TAIL_WIDTH,
	tailHeight: number = CALLOUT_TAIL_HEIGHT,
): number[] {
	const cx = x + width / 2;
	const bottom = y + height;
	const half = tailWidth / 2;
	return [cx - half, bottom, cx + half, bottom, cx, bottom + tailHeight];
}
