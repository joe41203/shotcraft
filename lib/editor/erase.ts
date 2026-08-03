/**
 * スマート消しゴム（なじませ）の純粋ロジック。モザイク・ぼかしの姉妹（mosaic.ts /
 * blur.ts と同じ思想）。
 *
 * スマート消しゴムは「ドラッグした矩形内のベース画像を、周辺の色を取り込んで自然に
 * 塗り潰す」注釈。モザイク・ぼかしが「何かを隠した」痕跡を残すのに対し、こちらは
 * 通知バッジ・カーソル・不要な UI 要素などを消して背景に溶け込ませる用途に使う。
 *
 * 実際の描画（オフスクリーン canvas への転写・弱いぼかしの適用）は DOM 依存なので
 * render.ts 側（buildEraseNode）に置く。ここには描画に依らない純粋計算だけを置き、
 * テスト可能にする:
 *   - 領域内を「周長（4 辺の縁）全ピクセルからの逆距離重み（IDW）平均」で埋める塗り
 *     アルゴリズム（fillErasedRegion）。縁色は denoiseEdgeLine で前処理する。
 *   - 周長サンプルの等間隔間引き（samplePerimeter）。
 *   - 粗グリッドでの IDW 計算（computeIdwGrid）とバイリニア拡大（bilinearUpscaleRgb）。
 *   - 領域を画像範囲へクランプする座標計算（clampEraseRect）。
 * 入力・出力は ImageData 相当のプレーンな RGBA 配列（Uint8ClampedArray でも number[]
 * でも可）で表現し、canvas 無しでテストできるようにする。
 *
 * 塗り方式（周長 IDW ブレンド）: 各内部ピクセル p の色 = Σ(w_i·c_i)/Σw_i、
 * w_i = 1/(dist(p, 縁ピクセル i)^3 + 1)。べき 3 で遠方の縁色の影響を強く減衰させるので、
 * 縁の一部に写り込んだ別物体（通知バッジ隣のベル絵文字など）の色は、その縁の近傍にだけ
 * 淡く残り、領域全体へ縦/横の筋（スメア）として伸びない。行/列の線形補間（旧方式）が
 * 縁ピクセルをそのまま軸方向へ引き延ばして筋になったのを、距離減衰で根本から避ける。
 */

import type { Rect, Size } from "../messages";

/** 塗りの下地をならすために領域内へ 1 回かける弱いぼかしの半径（px）の下限。 */
export const MIN_ERASE_BLUR_RADIUS = 2;
/** 同上・上限（px）。強くしすぎると溶けて周囲との差が目立つので控えめに抑える。 */
export const MAX_ERASE_BLUR_RADIUS = 8;

/**
 * なじませ後に領域内へかける弱いぼかしの半径（px）を領域の寸法から決める純粋関数。
 * ぼかしツール（blurRadius）はガウスぼかしで「情報を伏せる」ため強めだが、こちらは
 * グラデーション補間で生じる横縞・縦縞をならす目的なので、ずっと弱くする。短辺の
 * 約 3% を目安に、下限 MIN_ERASE_BLUR_RADIUS・上限 MAX_ERASE_BLUR_RADIUS でクランプ
 * する（大きい領域ほど少しだけ強くならす）。
 */
export function eraseBlurRadius(width: number, height: number): number {
	const shortSide = Math.min(Math.abs(width), Math.abs(height));
	const base = shortSide * 0.03;
	return Math.min(MAX_ERASE_BLUR_RADIUS, Math.max(MIN_ERASE_BLUR_RADIUS, base));
}

/**
 * 領域矩形（消して塗り潰す範囲）を画像全体の範囲内へクランプした整数の矩形へ
 * 正規化する純粋関数。負の寸法や画像外へはみ出す矩形でも安全に扱えるようにする
 * （スポットライトの clampSpotlightHole と同じ思想）。
 *
 * - 左上・右下を画像境界 [0, size] にクランプしてから幅・高さを求める。
 * - 座標・寸法は floor / ceil で整数へ丸める（ピクセルインデックスに使うため）。
 * - 完全に画像外・幅か高さが 1px 未満になる矩形は null を返す（塗るものが無い）。
 */
export function clampEraseRect(region: Rect, size: Size): Rect | null {
	const rawLeft = Math.min(region.x, region.x + region.width);
	const rawRight = Math.max(region.x, region.x + region.width);
	const rawTop = Math.min(region.y, region.y + region.height);
	const rawBottom = Math.max(region.y, region.y + region.height);

	const left = Math.floor(clamp(rawLeft, 0, size.width));
	const right = Math.ceil(clamp(rawRight, 0, size.width));
	const top = Math.floor(clamp(rawTop, 0, size.height));
	const bottom = Math.ceil(clamp(rawBottom, 0, size.height));

	const width = right - left;
	const height = bottom - top;
	if (width < 1 || height < 1) return null;
	return { x: left, y: top, width, height };
}

/**
 * ImageData 相当の RGBA バッファ（1 ピクセル 4 バイト・行優先）。canvas 無しで
 * テストできるよう、Uint8ClampedArray でも number[] でも受けられる形にする。
 */
export interface RgbaImage {
	/** 幅（px）。 */
	width: number;
	/** 高さ（px）。 */
	height: number;
	/** RGBA 値（length = width*height*4）。 */
	data: Uint8ClampedArray | number[];
}

/** (x, y) の RGBA を読む。範囲外は最寄りの端へクランプして読む（端の縁色を安定させる）。 */
function readRgba(
	img: RgbaImage,
	x: number,
	y: number,
): [number, number, number, number] {
	const cx = clamp(Math.round(x), 0, img.width - 1);
	const cy = clamp(Math.round(y), 0, img.height - 1);
	const i = (cy * img.width + cx) * 4;
	return [
		img.data[i] ?? 0,
		img.data[i + 1] ?? 0,
		img.data[i + 2] ?? 0,
		img.data[i + 3] ?? 255,
	];
}

/**
 * 縁ラインの外れ値除去に使う近傍ウィンドウの片側幅（px）。位置 i を中心に i-RADIUS..i+RADIUS の
 * (2*RADIUS+1) 画素でチャンネル別メディアンを取る。既定 6 → 13 画素窓。メディアンは窓の過半が
 * 異物色になると異物側へ倒れてしまう（＝異物幅が窓の半分を超えると弾けない）ので、想定する
 * 「縁を横切る小さな物体（絵文字・アイコン・文字）」の幅（〜10px 強）が確実に少数派に収まるよう、
 * 半径を広めに取る。広げるほど頑健だが、なだらかなグラデーションの追従は少し鈍る。
 */
export const EDGE_MEDIAN_WINDOW_RADIUS = 6;

/**
 * 縁ピクセルを「外れ値」とみなす、近傍メディアン色からの RGB ユークリッド距離のしきい値。
 * これを超えて乖離した画素（縁を横切る絵文字・アイコン・文字などの小さな高彩度スポット）は
 * メディアン色へ置換してから補間に使う。緩いグラデーションでは隣接画素差が小さくメディアンに
 * 近いので置換されず、そのまま追従する。48 は「明確に別物体の色」を弾きつつ、通常の
 * グラデーション段差は残す実用値。
 */
export const EDGE_OUTLIER_THRESHOLD = 48;

/**
 * 周長全体の代表色（全サンプルのチャンネル別メディアン）から、この距離を超えて乖離した
 * 周長サンプルを「別物体（前景）」とみなして代表色へ置換するしきい値（RGB 距離）。
 *
 * denoiseEdgeLine の近傍メディアンは「異物が近傍窓の過半を占めると弾けない」ため、幅の広い
 * 物体（通知バッジ隣のベル絵文字＝幅 20px 超など）には無力だった。そこで周長「全体」の
 * 多数派色を基準に、そこから大きく外れたサンプルをまとめて背景色へ寄せる第 2 段を設ける。
 * 幅の広い物体でも、周長全体（4 辺の総ピクセル）の中では少数派であれば確実に除去できる。
 *
 * しきい値は EDGE_OUTLIER_THRESHOLD より緩め（大きめ）にして、なだらかなグラデーション背景
 * （周長の端どうしが緩やかに違う）を誤って潰さないようにする。90 は「彩度の高い明確な前景色」
 * を弾きつつ、通常の背景グラデーションの広がりは残す実用値。
 */
export const PERIMETER_OUTLIER_THRESHOLD = 90;

/** RGB の 3 チャンネルからなる縁ピクセルの色。 */
type Rgb = [number, number, number];

/** 2 色の RGB ユークリッド距離。 */
function rgbDistance(a: Rgb, b: Rgb): number {
	const dr = a[0] - b[0];
	const dg = a[1] - b[1];
	const db = a[2] - b[2];
	return Math.sqrt(dr * dr + dg * dg + db * db);
}

/** number 配列のメディアン（要素数偶数なら中央 2 値の平均）。空配列は 0。 */
function median(values: number[]): number {
	if (values.length === 0) return 0;
	const sorted = [...values].sort((a, b) => a - b);
	const mid = sorted.length >> 1;
	if (sorted.length % 2 === 1) return sorted[mid] ?? 0;
	return ((sorted[mid - 1] ?? 0) + (sorted[mid] ?? 0)) / 2;
}

/**
 * 縁ラインの色列（1 辺に沿った縁ピクセルの並び）から外れ値を除去した色列を返す純粋関数。
 *
 * 各位置 i について、近傍ウィンドウ（i±EDGE_MEDIAN_WINDOW_RADIUS）のチャンネル別メディアンを
 * 取り、元の色がそのメディアン色から EDGE_OUTLIER_THRESHOLD を超えて乖離していれば
 * メディアン色で置換する。これにより:
 * - 縁を横切る小さな物体（絵文字・アイコン・文字）の高彩度スポットは近傍メディアンで
 *   埋められ、補間で領域内へ縦（横）に伸びる筋（スメア）にならない。
 * - なだらかなグラデーション（隣接画素差が小さい）はメディアンとの乖離が小さく置換されず、
 *   そのまま補間に使われて追従する。
 * メディアンは近傍の「多数派の色」なので、異物が窓の過半を占めない限り背景色を選ぶ。
 */
export function denoiseEdgeLine(line: Rgb[]): Rgb[] {
	const n = line.length;
	const out: Rgb[] = new Array(n);
	for (let i = 0; i < n; i++) {
		const lo = Math.max(0, i - EDGE_MEDIAN_WINDOW_RADIUS);
		const hi = Math.min(n - 1, i + EDGE_MEDIAN_WINDOW_RADIUS);
		const rs: number[] = [];
		const gs: number[] = [];
		const bs: number[] = [];
		for (let k = lo; k <= hi; k++) {
			const c = line[k];
			if (!c) continue;
			rs.push(c[0]);
			gs.push(c[1]);
			bs.push(c[2]);
		}
		const med: Rgb = [median(rs), median(gs), median(bs)];
		const cur = line[i] ?? med;
		out[i] = rgbDistance(cur, med) > EDGE_OUTLIER_THRESHOLD ? med : cur;
	}
	return out;
}

/** 縁ライン（1 辺の縁ピクセル列）を source から読み、外れ値除去した色列を返す。 */
function readDenoisedEdge(
	source: RgbaImage,
	length: number,
	at: (index: number) => { x: number; y: number },
): Rgb[] {
	const raw: Rgb[] = new Array(length);
	for (let i = 0; i < length; i++) {
		const { x, y } = at(i);
		const [r, g, b] = readRgba(source, x, y);
		raw[i] = [r, g, b];
	}
	return denoiseEdgeLine(raw);
}

/**
 * 周長サンプル列（4 辺の縁色を集めたもの）から、周長「全体」の多数派色を大きく外れた
 * サンプルを代表色へ置換した色列を返す純粋関数。denoiseEdgeLine（近傍メディアン）の第 2 段。
 *
 * 近傍メディアンは異物が近傍窓の過半を占めると弾けないため、幅の広い前景物体（バッジ隣の
 * ベル絵文字など）を除けない。ここでは周長全体のチャンネル別メディアン（＝多数派＝背景色）を
 * 基準に、そこから PERIMETER_OUTLIER_THRESHOLD を超えて乖離したサンプルを代表色へ寄せる。
 * 物体が周長全体（4 辺の総ピクセル）の中で少数派である限り、幅に依らず確実に除去できる。
 * なだらかな背景グラデーションは、端どうしの色差が緩やかで代表色からの乖離も小さいので残す。
 *
 * 返す配列は入力と同じ長さ・順序で、置換されたサンプルだけ color が代表色に差し替わる。
 */
export function denoisePerimeter(
	samples: PerimeterSample[],
): PerimeterSample[] {
	if (samples.length === 0) return samples;
	const rs = samples.map((s) => s.color[0]);
	const gs = samples.map((s) => s.color[1]);
	const bs = samples.map((s) => s.color[2]);
	const rep: Rgb = [median(rs), median(gs), median(bs)];
	return samples.map((s) =>
		rgbDistance(s.color, rep) > PERIMETER_OUTLIER_THRESHOLD
			? { ...s, color: rep }
			: s,
	);
}

/** IDW の重み計算に使う距離の累乗。3 で遠方の縁色の影響を強く減衰させる（筋の抑制）。 */
export const IDW_POWER = 3;

/**
 * 周長サンプルの最大点数。大領域でも IDW の計算量を抑えるため、周長ピクセルはこの数まで
 * 等間隔に間引く。塗り場は本質的に滑らかなので、256 点あれば縁色の分布は十分再現できる。
 */
export const MAX_PERIMETER_SAMPLES = 256;

/**
 * IDW を実際に評価する粗グリッドの各軸の最大分割数。領域が大きくてもグリッドは最大
 * MAX_IDW_GRID×MAX_IDW_GRID までで、そこから実解像度へバイリニア拡大する。塗り場は
 * 滑らかなので粗グリッドでも画質劣化はほぼ無く、演算量を領域面積に依存させない。
 */
export const MAX_IDW_GRID = 64;

/** 周長サンプル点（source 内の絶対座標と、denoise 済みの縁色）。 */
export interface PerimeterSample {
	x: number;
	y: number;
	color: Rgb;
}

/**
 * rect の 4 辺のすぐ外側の縁ピクセル（存在する辺のみ）を 2 段の外れ値除去で前処理して集め、
 * 等間隔に最大 maxSamples 点へ間引いた周長サンプル列を返す純粋関数。
 *
 * - 左縁 = rect.x-1 列 / 右縁 = rect.x+width 列（行方向に height 個）。
 * - 上縁 = rect.y-1 行 / 下縁 = rect.y+height 行（列方向に width 個）。
 * - 画像端に接して外側 1px が取れない辺は集めない（存在する縁だけで塗る）。
 * 4 辺すべてが欠ける（画像全体を消す）場合は空配列（呼び出し側でフォールバック）。
 *
 * 外れ値除去は 2 段構え:
 *   1) 各辺を denoiseEdgeLine（近傍メディアン）で処理し、縁を横切る「小さな」異物を平す。
 *   2) 集めた周長全体へ denoisePerimeter（周長全体の多数派色基準）を掛け、近傍窓の過半を
 *      占める「幅の広い」前景物体（バッジ隣のベル絵文字など）も背景色へ寄せる。
 * この 2 段の後の縁色を IDW（距離減衰）でブレンドするので、万一残った縁色も筋にならない。
 */
export function samplePerimeter(
	source: RgbaImage,
	rect: Rect,
	maxSamples: number = MAX_PERIMETER_SAMPLES,
): PerimeterSample[] {
	const { x, y, width, height } = rect;
	const hasLeft = x - 1 >= 0;
	const hasRight = x + width <= source.width - 1;
	const hasTop = y - 1 >= 0;
	const hasBottom = y + height <= source.height - 1;

	const all: PerimeterSample[] = [];

	if (hasLeft) {
		const edge = readDenoisedEdge(source, height, (j) => ({
			x: x - 1,
			y: y + j,
		}));
		for (let j = 0; j < height; j++)
			all.push({ x: x - 1, y: y + j, color: edge[j] ?? [0, 0, 0] });
	}
	if (hasRight) {
		const edge = readDenoisedEdge(source, height, (j) => ({
			x: x + width,
			y: y + j,
		}));
		for (let j = 0; j < height; j++)
			all.push({ x: x + width, y: y + j, color: edge[j] ?? [0, 0, 0] });
	}
	if (hasTop) {
		const edge = readDenoisedEdge(source, width, (i) => ({
			x: x + i,
			y: y - 1,
		}));
		for (let i = 0; i < width; i++)
			all.push({ x: x + i, y: y - 1, color: edge[i] ?? [0, 0, 0] });
	}
	if (hasBottom) {
		const edge = readDenoisedEdge(source, width, (i) => ({
			x: x + i,
			y: y + height,
		}));
		for (let i = 0; i < width; i++)
			all.push({ x: x + i, y: y + height, color: edge[i] ?? [0, 0, 0] });
	}

	// 第 2 段: 周長全体の多数派色から大きく外れたサンプル（幅の広い前景物体）を背景色へ寄せる。
	const cleaned = denoisePerimeter(all);

	// 等間隔間引き（最大 maxSamples 点）。全周長が maxSamples 以下ならそのまま。
	if (cleaned.length <= maxSamples) return cleaned;
	const out: PerimeterSample[] = [];
	for (let k = 0; k < maxSamples; k++) {
		const idx = Math.floor((k * cleaned.length) / maxSamples);
		const s = cleaned[idx];
		if (s) out.push(s);
	}
	return out;
}

/** IDW で 1 点 (px, py) の色を周長サンプルから求める（Σ w·c / Σ w、w=1/(dist^power+1)）。 */
function idwColorAt(px: number, py: number, samples: PerimeterSample[]): Rgb {
	let sr = 0;
	let sg = 0;
	let sb = 0;
	let sw = 0;
	for (const s of samples) {
		const dx = px - s.x;
		const dy = py - s.y;
		const dist = Math.sqrt(dx * dx + dy * dy);
		// べき 3 の逆距離。+1 で 0 除算を避けつつ、極近傍でも重みが発散しないようにする。
		const w = 1 / (dist ** IDW_POWER + 1);
		sr += s.color[0] * w;
		sg += s.color[1] * w;
		sb += s.color[2] * w;
		sw += w;
	}
	if (sw <= 0) return [0, 0, 0];
	return [sr / sw, sg / sw, sb / sw];
}

/**
 * 領域内の各グリッド節点を IDW で評価した粗グリッド（gridW×gridH の RGB 配列）を返す純粋関数。
 *
 * グリッド節点 (gi, gj) は領域内の実座標 (x + fx*(width-1), y + fy*(height-1)) に対応させ、
 * その点の色を周長サンプルからの IDW で求める。gridW/gridH は各軸 MAX_IDW_GRID までに
 * 抑えるので、領域が大きくても IDW 評価回数は gridW*gridH*samples で頭打ちになる。
 * 戻り値は行優先の Rgb 配列（長さ gridW*gridH）。
 */
export function computeIdwGrid(
	rect: Rect,
	samples: PerimeterSample[],
	gridW: number,
	gridH: number,
): Rgb[] {
	const { x, y, width, height } = rect;
	const grid: Rgb[] = new Array(gridW * gridH);
	for (let gj = 0; gj < gridH; gj++) {
		const fy = gridH > 1 ? gj / (gridH - 1) : 0.5;
		const py = y + fy * (height - 1);
		for (let gi = 0; gi < gridW; gi++) {
			const fx = gridW > 1 ? gi / (gridW - 1) : 0.5;
			const px = x + fx * (width - 1);
			grid[gj * gridW + gi] = idwColorAt(px, py, samples);
		}
	}
	return grid;
}

/**
 * 粗グリッド（gridW×gridH の RGB）を、outW×outH の RGBA 配列へバイリニア拡大する純粋関数。
 *
 * 出力ピクセル (i, j) をグリッド座標へ写像し、囲む 4 節点を双線形補間する。塗り場は本質的に
 * 滑らかなので、粗グリッド → 実解像度の拡大でも画質劣化はほぼ無い。alpha は不透明（255）固定。
 * gridW/gridH が 1 の軸はその軸方向に一定（単純に同じ節点を使う）。
 */
export function bilinearUpscaleRgb(
	grid: Rgb[],
	gridW: number,
	gridH: number,
	outW: number,
	outH: number,
): number[] {
	const out = new Array<number>(outW * outH * 4);
	const at = (gi: number, gj: number): Rgb =>
		grid[gj * gridW + gi] ?? [0, 0, 0];

	for (let j = 0; j < outH; j++) {
		// 出力行 j を [0, gridH-1] のグリッド座標へ。
		const gy = outH > 1 ? (j / (outH - 1)) * (gridH - 1) : 0;
		const gy0 = Math.floor(gy);
		const gy1 = Math.min(gridH - 1, gy0 + 1);
		const ty = gy - gy0;

		for (let i = 0; i < outW; i++) {
			const gx = outW > 1 ? (i / (outW - 1)) * (gridW - 1) : 0;
			const gx0 = Math.floor(gx);
			const gx1 = Math.min(gridW - 1, gx0 + 1);
			const tx = gx - gx0;

			const c00 = at(gx0, gy0);
			const c10 = at(gx1, gy0);
			const c01 = at(gx0, gy1);
			const c11 = at(gx1, gy1);

			const o = (j * outW + i) * 4;
			for (let ch = 0; ch < 3; ch++) {
				const top = (c00[ch] ?? 0) * (1 - tx) + (c10[ch] ?? 0) * tx;
				const bot = (c01[ch] ?? 0) * (1 - tx) + (c11[ch] ?? 0) * tx;
				out[o + ch] = Math.round(top * (1 - ty) + bot * ty);
			}
			out[o + 3] = 255;
		}
	}
	return out;
}

/**
 * 消す領域（rect）を、周長（4 辺の縁）全ピクセルからの逆距離重み（IDW）ブレンドで埋めた
 * RGBA 配列（領域サイズ rect.width × rect.height 分）を返す純粋関数。塗りアルゴリズムの本体。
 *
 * 手順:
 *   0) 4 辺の縁ピクセル列を denoiseEdgeLine で外れ値除去しつつ集め、等間隔に最大
 *      MAX_PERIMETER_SAMPLES 点へ間引く（samplePerimeter）。画像端に接して縁が取れない辺は
 *      集めない（存在する縁だけで塗る）。
 *   1) 各軸 MAX_IDW_GRID までの粗グリッドで IDW を評価する（computeIdwGrid）。各節点の色は
 *      周長サンプルからの Σ(w·c)/Σw、w=1/(dist^3+1)。べき 3 の距離減衰で、縁の一部に写り込んだ
 *      別物体（ベル絵文字など）の色はその縁近傍にだけ淡く残り、領域全体へ筋にならない。
 *   2) 粗グリッドを実解像度へバイリニア拡大する（bilinearUpscaleRgb）。塗り場は滑らかなので
 *      粗グリッドでも劣化しない。これにより演算量が領域面積に依存せず、大領域でも安定する。
 *
 * サンプリング元 source は画像全体（またはクランプ後の rect を内包する領域）で、rect は
 * source の座標系。rect は clampEraseRect 済み（source 範囲内・正の寸法）を渡す前提。
 * 4 辺すべてが欠ける（画像全体を消す）異常系は、領域の代表色（左上隅）で一様に塗る。
 *
 * 戻り値の alpha は不透明（255）固定にする（ベース画像を置き換える塗りなので）。
 */
export function fillErasedRegion(source: RgbaImage, rect: Rect): number[] {
	const { width, height } = rect;

	const samples = samplePerimeter(source, rect);

	// 周長が 1 点も取れない（画像全体を消す）異常系: 領域内の代表色で一様に塗る。
	if (samples.length === 0) {
		const [r, g, b] = readRgba(source, rect.x, rect.y);
		const out = new Array<number>(width * height * 4);
		for (let p = 0; p < width * height; p++) {
			const o = p * 4;
			out[o] = r;
			out[o + 1] = g;
			out[o + 2] = b;
			out[o + 3] = 255;
		}
		return out;
	}

	// 粗グリッド分割数（各軸 [1, MAX_IDW_GRID]）。領域が小さいときは実寸を上限にして無駄を省く。
	const gridW = Math.max(1, Math.min(MAX_IDW_GRID, width));
	const gridH = Math.max(1, Math.min(MAX_IDW_GRID, height));

	const grid = computeIdwGrid(rect, samples, gridW, gridH);
	return bilinearUpscaleRgb(grid, gridW, gridH, width, height);
}

function clamp(value: number, min: number, max: number): number {
	return Math.min(Math.max(value, min), max);
}
