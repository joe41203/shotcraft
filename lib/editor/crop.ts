/**
 * クロップの純粋な座標ロジック。
 *
 * crop は常に「元画像座標系の単一 Rect」で保持する（doc.crop）。再クロップしても
 * 入れ子にはせず、現在の有効領域（bounds）内に収めた 1 個の矩形へ合成する。
 * これにより undo 一発で 1 段戻せる。ここには DOM 非依存の計算だけを置く。
 */

import { clamp } from "../geometry";
import type { Size } from "../messages";
import type { CropRect } from "./doc";

/** クロップ矩形として許容する最小の一辺（元画像座標系の px）。 */
export const MIN_CROP = 10;

/**
 * クロップ枠のアスペクト比拘束。"free" は拘束なし（現状の自由リサイズ）。
 * それ以外は幅 : 高さ の比で枠を固定する（1:1 / 4:3 / 16:9）。省略・未設定は "free"。
 */
export type CropRatio = "free" | "1:1" | "4:3" | "16:9";

/** 比率選択肢（フライアウトの「比率」セクションの並び）。値と表示ラベル。 */
export const CROP_RATIO_OPTIONS: { value: CropRatio; label: string }[] = [
	{ value: "free", label: "自由" },
	{ value: "1:1", label: "1:1" },
	{ value: "4:3", label: "4:3" },
	{ value: "16:9", label: "16:9" },
];

/** CROP_RATIO_OPTIONS の値の集合（正規化・プリセット一致判定に使う）。 */
const CROP_RATIO_VALUES: ReadonlySet<string> = new Set(
	CROP_RATIO_OPTIONS.map((o) => o.value),
);

/**
 * 任意の値を CropRatio へ正規化する純粋関数。
 * "free" / "1:1" / "4:3" / "16:9" のいずれかならそのまま、それ以外（未設定・不正値）は
 * "free"（拘束なし＝後方互換の既定）へ落とす。style-prefs の検証で使う。
 */
export function normalizeCropRatio(raw: unknown): CropRatio {
	return typeof raw === "string" && CROP_RATIO_VALUES.has(raw)
		? (raw as CropRatio)
		: "free";
}

/**
 * 比率（幅 / 高さ）を数値で返す純粋関数。"free" は拘束なしを表す null。
 * 1:1=1、4:3≈1.333、16:9≈1.778。
 */
export function cropRatioValue(ratio: CropRatio): number | null {
	switch (ratio) {
		case "1:1":
			return 1;
		case "4:3":
			return 4 / 3;
		case "16:9":
			return 16 / 9;
		default:
			return null;
	}
}

/**
 * 現在の有効領域（クロップの基準となる bounds）を返す。
 * crop があればそれ自身、無ければ画像全体。再クロップはこの領域内で行う。
 */
export function cropBounds(crop: CropRect | null, imageSize: Size): CropRect {
	return (
		crop ?? { x: 0, y: 0, width: imageSize.width, height: imageSize.height }
	);
}

/**
 * 選択矩形（元画像座標系）を bounds 内に収めた最終的なクロップ矩形へ合成する。
 * 端は右下基準で丸めてから左上へ引くことで境界超過・1px ずれを防ぎ、
 * 最小サイズ MIN_CROP を保証する。bounds と一致する（＝実質クロップ無し）場合は
 * 呼び出し側で no-op 判定できるよう、そのまま bounds に丸まった矩形を返す。
 */
export function clampCropRect(selection: CropRect, bounds: CropRect): CropRect {
	const right = bounds.x + bounds.width;
	const bottom = bounds.y + bounds.height;

	const x = clamp(Math.round(selection.x), bounds.x, right - MIN_CROP);
	const y = clamp(Math.round(selection.y), bounds.y, bottom - MIN_CROP);
	const r = clamp(
		Math.round(selection.x + selection.width),
		x + MIN_CROP,
		right,
	);
	const b = clamp(
		Math.round(selection.y + selection.height),
		y + MIN_CROP,
		bottom,
	);

	return { x, y, width: r - x, height: b - y };
}

/** 2 つのクロップ矩形が同一（座標・寸法とも一致）か。no-op 判定に使う。 */
export function cropRectEquals(a: CropRect, b: CropRect): boolean {
	return (
		a.x === b.x && a.y === b.y && a.width === b.width && a.height === b.height
	);
}

/**
 * クロップ適用後のコンテンツ寸法（表示・エクスポートの基準サイズ）を返す。
 * crop があればその寸法、無ければ画像全体の寸法。
 */
export function croppedSize(crop: CropRect | null, imageSize: Size): Size {
	return crop
		? { width: crop.width, height: crop.height }
		: { width: imageSize.width, height: imageSize.height };
}

/**
 * 既存のクロップ枠（rect）を、中心を保ったまま指定比率（幅 / 高さ）へ整形し、
 * bounds 内へ収めた矩形を返す純粋関数。比率変更時に既存枠を作り直す用途。
 *
 * ratio が null（自由）のときは rect を bounds 内へクランプするだけ（比率は変えない）。
 * それ以外は:
 *   1) 現在の面積相当の一辺（√(w*h)）を基準に、その比率で幅・高さを決める。
 *   2) bounds に収まるよう幅・高さを縮め（アスペクト維持）、最小 MIN_CROP を保証。
 *   3) 中心を保ったまま bounds 内へ平行移動してクランプする。
 * 返す矩形は常に bounds 内・比率どおり（丸め誤差を除く）・最小サイズ以上。
 */
export function fitRectToRatio(
	rect: CropRect,
	ratio: number | null,
	bounds: CropRect,
): CropRect {
	const cx = rect.x + rect.width / 2;
	const cy = rect.y + rect.height / 2;

	let width: number;
	let height: number;
	if (ratio == null) {
		width = rect.width;
		height = rect.height;
	} else {
		// 現在の面積相当を基準に比率どおりの幅・高さを作る（極端に潰れないように）。
		const base = Math.sqrt(Math.max(1, rect.width * rect.height));
		width = base * Math.sqrt(ratio);
		height = base / Math.sqrt(ratio);
	}

	// bounds に収まるよう縮める。ratio 指定時はアスペクトを保って両辺を同率で縮小、
	// free（ratio=null）時は各辺を独立にクランプする。
	if (ratio == null) {
		width = clamp(width, MIN_CROP, bounds.width);
		height = clamp(height, MIN_CROP, bounds.height);
	} else {
		const shrink = Math.min(1, bounds.width / width, bounds.height / height);
		width = Math.max(MIN_CROP, width * shrink);
		height = Math.max(MIN_CROP, height * shrink);
		// MIN_CROP 下限で比率が崩れた場合に備え、bounds を超えないよう最終クランプ。
		width = Math.min(width, bounds.width);
		height = Math.min(height, bounds.height);
	}

	// 中心を保ったまま bounds 内へ平行移動。
	const x = clamp(cx - width / 2, bounds.x, bounds.x + bounds.width - width);
	const y = clamp(cy - height / 2, bounds.y, bounds.y + bounds.height - height);
	return { x, y, height, width };
}

/**
 * リサイズ中の新しい枠（newBox）を、比率（幅 / 高さ）を保ちつつ動いていない辺
 * （アンカー）を固定して整形する純幾何計算。ハンドル操作のアスペクト維持に使う。
 *
 * oldBox からの各辺の変化量で「どのハンドルを動かしたか」を推定し、動かした側の
 * 辺を残して反対側（アンカー）を固定する。幅の変化量が大きければ幅を主導寸法にして
 * 高さを width/ratio で決め、そうでなければ高さを主導にして幅を height*ratio で決める。
 * これにより左右ハンドルは高さを、上下ハンドルは幅を、比率に従って追従させる。
 *
 * bounds によるクランプはここでは行わない（呼び出し側 = crop-controller が
 * boundBoxFunc で別途 bounds を判定する）。ratio が null（自由）のときは newBox を
 * そのまま返す。最小サイズは MIN_CROP を下限にする。
 */
export function constrainResizeToRatio(
	oldBox: CropRect,
	newBox: CropRect,
	ratio: number | null,
): CropRect {
	if (ratio == null) return newBox;

	const movedLeft = Math.abs(newBox.x - oldBox.x) > 1e-6;
	const movedTop = Math.abs(newBox.y - oldBox.y) > 1e-6;
	const dw = Math.abs(newBox.width - oldBox.width);
	const dh = Math.abs(newBox.height - oldBox.height);

	// 主導寸法（動かした量が大きい辺）を採り、もう一方を比率から決める。
	let width: number;
	let height: number;
	if (dw >= dh) {
		width = Math.max(MIN_CROP, newBox.width);
		height = Math.max(MIN_CROP, width / ratio);
	} else {
		height = Math.max(MIN_CROP, newBox.height);
		width = Math.max(MIN_CROP, height * ratio);
	}

	// アンカー（動かしていない辺）を固定する。左/上ハンドルを動かしたなら右/下端を、
	// そうでなければ左/上端をアンカーにする。
	const right = oldBox.x + oldBox.width;
	const bottom = oldBox.y + oldBox.height;
	const x = movedLeft ? right - width : oldBox.x;
	const y = movedTop ? bottom - height : oldBox.y;
	return { x, y, width, height };
}
