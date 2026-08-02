/**
 * テキスト注釈（テキスト・フキダシ内テキスト）の縁取り（ハロー）の純粋計算。
 *
 * どんな背景色の上でも文字が読めるよう、文字の外側に細い縁を常時付ける。
 * 縁色は文字色の輝度から自動判定し（明るい文字にはダーク縁、暗い文字には白縁）、
 * 縁の太さはフォントサイズに連動させる。描画（render.ts）は Konva.Text の
 * stroke（縁色）＋ strokeWidth（縁幅）＋ fillAfterStrokeEnabled=true を使い、
 * 「文字色（fill）の外側に縁（stroke）」の見た目にする。エディタ表示と PNG 書き出しは
 * 同じ描画関数を通るので見た目が一致する。
 */

/** 明るい文字に付けるダーク縁の色（スレート寄りのほぼ黒）。 */
export const HALO_DARK = "#0b0f19";
/** 暗い文字に付ける白縁の色。 */
export const HALO_LIGHT = "#ffffff";

/**
 * 縁幅をフォントサイズの何割にするか。小さめの割合で、文字を潰さず輪郭だけ縁取る。
 */
const HALO_WIDTH_RATIO = 0.08;
/** 縁幅の下限（px）。小さいフォントでも縁が消えないようにする。 */
export const HALO_MIN_WIDTH = 1.5;
/** 縁幅の上限（px）。大きいフォントでも縁が太くなりすぎないようにする。 */
export const HALO_MAX_WIDTH = 6;

/**
 * `#rgb` / `#rrggbb` を [r, g, b]（0-255）へ分解する。解釈できない入力は null。
 * ハロー色は輝度判定にだけ使うので、名前色・rgb() 等が来たら判定不能として扱い、
 * 呼び出し側で安全側（ダーク縁）へフォールバックさせる。
 */
function parseHex(color: string): [number, number, number] | null {
	const m = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(color.trim());
	const digits = m?.[1];
	if (!digits) return null;
	const body =
		digits.length === 3
			? digits
					.split("")
					.map((c) => c + c)
					.join("")
			: digits;
	return [
		Number.parseInt(body.slice(0, 2), 16),
		Number.parseInt(body.slice(2, 4), 16),
		Number.parseInt(body.slice(4, 6), 16),
	];
}

/**
 * 文字色の相対輝度（0=黒〜1=白）を返す純粋関数。
 * sRGB の知覚輝度係数（0.2126 / 0.7152 / 0.0722）で加重する。`#rgb`/`#rrggbb`
 * 以外（解釈できない色）は判定不能として null を返す。
 */
export function colorLuminance(color: string): number | null {
	const rgb = parseHex(color);
	if (!rgb) return null;
	const [r, g, b] = rgb;
	return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
}

/**
 * 文字色から縁（ハロー）の色を決める純粋関数。
 * - 明るい文字（輝度が高い）→ ダーク縁（HALO_DARK）でコントラストを付ける。
 * - 暗い文字（輝度が低い）→ 白縁（HALO_LIGHT）。
 * - 色を解釈できない（名前色・rgb() 等）ときはダーク縁へフォールバックする
 *   （白背景が多い前提で無難な既定）。
 * 閾値 0.5 は中間グレー相当。ちょうど 0.5 は暗い側扱い（白縁）にする。
 */
export function haloColor(color: string): string {
	const lum = colorLuminance(color);
	if (lum === null) return HALO_DARK;
	return lum > 0.5 ? HALO_DARK : HALO_LIGHT;
}

/**
 * フォントサイズから縁（ハロー）の太さ（px）を決める純粋関数。
 * フォントサイズの HALO_WIDTH_RATIO 倍を基準に、[HALO_MIN_WIDTH, HALO_MAX_WIDTH]
 * へクランプする。非有限・非正のフォントサイズは下限へ落とす（NaN を出さない）。
 */
export function haloStrokeWidth(fontSize: number): number {
	if (!Number.isFinite(fontSize) || fontSize <= 0) return HALO_MIN_WIDTH;
	const w = fontSize * HALO_WIDTH_RATIO;
	return Math.min(HALO_MAX_WIDTH, Math.max(HALO_MIN_WIDTH, w));
}
