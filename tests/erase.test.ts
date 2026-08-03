import { describe, expect, it } from "vitest";
import {
	bilinearUpscaleRgb,
	clampEraseRect,
	computeIdwGrid,
	denoiseEdgeLine,
	denoisePerimeter,
	EDGE_OUTLIER_THRESHOLD,
	eraseBlurRadius,
	fillErasedRegion,
	MAX_ERASE_BLUR_RADIUS,
	MAX_IDW_GRID,
	MAX_PERIMETER_SAMPLES,
	MIN_ERASE_BLUR_RADIUS,
	type PerimeterSample,
	PERIMETER_OUTLIER_THRESHOLD,
	type RgbaImage,
	samplePerimeter,
} from "../lib/editor/erase";

/**
 * 単色で塗り潰した width×height の RgbaImage を作る（テスト用）。
 * color は [r, g, b]（alpha は 255 固定）。
 */
function solidImage(
	width: number,
	height: number,
	color: [number, number, number],
): RgbaImage {
	const data: number[] = [];
	for (let i = 0; i < width * height; i++) {
		data.push(color[0], color[1], color[2], 255);
	}
	return { width, height, data };
}

/** fillErasedRegion の戻り値配列から領域内 (i, j) の RGB を読む。 */
function outPixel(
	out: number[],
	width: number,
	i: number,
	j: number,
): [number, number, number] {
	const o = (j * width + i) * 4;
	return [out[o] ?? 0, out[o + 1] ?? 0, out[o + 2] ?? 0];
}

/** img の矩形 [x0,y0]〜[x0+w,y0+h) を color で塗り替える（破壊的。異物の描き込み用）。 */
function paintRect(
	img: RgbaImage,
	x0: number,
	y0: number,
	w: number,
	h: number,
	color: [number, number, number],
): void {
	for (let y = y0; y < y0 + h; y++) {
		for (let x = x0; x < x0 + w; x++) {
			const i = (y * img.width + x) * 4;
			img.data[i] = color[0];
			img.data[i + 1] = color[1];
			img.data[i + 2] = color[2];
			img.data[i + 3] = 255;
		}
	}
}

/**
 * fillErasedRegion の出力について、指定した列 i の縦帯（全行）の色分散（3 チャンネル分散の
 * 合計）を返す。筋（スメア）が出ると縦方向に色が大きく変動して分散が跳ね上がるので、
 * 「筋が出ていないこと」を分散の小ささで判定する。
 */
function columnVariance(
	out: number[],
	width: number,
	height: number,
	i: number,
): number {
	const ch: [number[], number[], number[]] = [[], [], []];
	for (let j = 0; j < height; j++) {
		const [r, g, b] = outPixel(out, width, i, j);
		ch[0].push(r);
		ch[1].push(g);
		ch[2].push(b);
	}
	const varOf = (xs: number[]): number => {
		const mean = xs.reduce((a, b) => a + b, 0) / xs.length;
		return xs.reduce((a, b) => a + (b - mean) ** 2, 0) / xs.length;
	};
	return varOf(ch[0]) + varOf(ch[1]) + varOf(ch[2]);
}

describe("clampEraseRect", () => {
	const size = { width: 100, height: 80 };

	it("範囲内の矩形はそのまま整数の矩形を返す", () => {
		expect(
			clampEraseRect({ x: 10, y: 20, width: 30, height: 40 }, size),
		).toEqual({ x: 10, y: 20, width: 30, height: 40 });
	});

	it("負の寸法（逆方向ドラッグ）でも正の矩形へ正規化する", () => {
		// 右下 → 左上のドラッグ相当。x=40,width=-30 → [10,40]。
		expect(
			clampEraseRect({ x: 40, y: 60, width: -30, height: -40 }, size),
		).toEqual({ x: 10, y: 20, width: 30, height: 40 });
	});

	it("画像外へはみ出す矩形は境界でクランプする", () => {
		expect(
			clampEraseRect({ x: -20, y: -10, width: 200, height: 200 }, size),
		).toEqual({ x: 0, y: 0, width: 100, height: 80 });
	});

	it("小数座標は floor/ceil で整数へ丸める（ピクセルを取りこぼさない）", () => {
		// x: floor(10.4)=10 〜 ceil(15.5)=16 → 幅 6。y: floor(20.6)=20 〜 ceil(25.7)=26 → 高さ 6。
		expect(
			clampEraseRect({ x: 10.4, y: 20.6, width: 5.1, height: 5.1 }, size),
		).toEqual({ x: 10, y: 20, width: 6, height: 6 });
	});

	it("完全に画像外・寸法 0 は null（塗るものが無い）", () => {
		expect(
			clampEraseRect({ x: 200, y: 200, width: 10, height: 10 }, size),
		).toBeNull();
		expect(
			clampEraseRect({ x: 10, y: 10, width: 0, height: 10 }, size),
		).toBeNull();
	});
});

describe("eraseBlurRadius", () => {
	it("短辺の約 3% を基準にする（下限・上限の内側）", () => {
		// 短辺 200 の 3% = 6px。
		expect(eraseBlurRadius(400, 200)).toBeCloseTo(6);
		// 幅・高さの順に依らず短辺で決まる。
		expect(eraseBlurRadius(200, 400)).toBeCloseTo(6);
	});

	it("小さい領域は下限へ、大きい領域は上限へクランプする", () => {
		// 短辺 20 の 3% = 0.6 → 下限。
		expect(eraseBlurRadius(20, 20)).toBe(MIN_ERASE_BLUR_RADIUS);
		// 短辺 1000 の 3% = 30 → 上限。
		expect(eraseBlurRadius(1000, 1000)).toBe(MAX_ERASE_BLUR_RADIUS);
	});

	it("弱いぼかしで、ぼかしツールより控えめ（下限・上限が小さい）", () => {
		expect(MIN_ERASE_BLUR_RADIUS).toBeLessThan(MAX_ERASE_BLUR_RADIUS);
		expect(MIN_ERASE_BLUR_RADIUS).toBeGreaterThanOrEqual(1);
		// ぼかしツール（MAX_BLUR_RADIUS=32）より弱いことを固定値で確認。
		expect(MAX_ERASE_BLUR_RADIUS).toBeLessThan(32);
	});
});

describe("fillErasedRegion", () => {
	it("単色背景では領域全体がその色で埋まる（golden）", () => {
		// 10x10 の一様なグレー背景の中央 4x4 を消す → すべて同じグレーになる。
		const src = solidImage(10, 10, [120, 130, 140]);
		const rect = { x: 3, y: 3, width: 4, height: 4 };
		const out = fillErasedRegion(src, rect);
		for (let j = 0; j < rect.height; j++) {
			for (let i = 0; i < rect.width; i++) {
				expect(outPixel(out, rect.width, i, j)).toEqual([120, 130, 140]);
			}
		}
		// alpha は不透明固定。
		expect(out[3]).toBe(255);
	});

	it("水平グラデ背景では横方向に補間される（左縁色→右縁色）", () => {
		// 幅 7 の画像。x 列ごとに R = x*30 の水平グラデーション（緑・青は固定）。
		const width = 7;
		const height = 5;
		const data: number[] = [];
		for (let y = 0; y < height; y++) {
			for (let x = 0; x < width; x++) {
				data.push(x * 30, 50, 60, 255);
			}
		}
		const src: RgbaImage = { width, height, data };
		// 中央の 3 列（x=2..4）を縦いっぱい手前まで消す。左縁 x=1（R=30）、右縁 x=5（R=150）。
		const rect = { x: 2, y: 1, width: 3, height: 3 };
		const out = fillErasedRegion(src, rect);

		// 各行で、左端ピクセルの R < 中央 < 右端ピクセルの R（水平単調増加）。
		for (let j = 0; j < rect.height; j++) {
			const [lR] = outPixel(out, rect.width, 0, j);
			const [mR] = outPixel(out, rect.width, 1, j);
			const [rR] = outPixel(out, rect.width, 2, j);
			expect(lR).toBeLessThan(mR);
			expect(mR).toBeLessThan(rR);
			// 左端は左縁色(30)寄り、右端は右縁色(150)寄りの範囲に収まる。
			expect(lR).toBeGreaterThanOrEqual(30);
			expect(rR).toBeLessThanOrEqual(150);
		}
	});

	it("画像端に接する辺は補間から除外される（縦帯・上下辺欠け）", () => {
		// 縦のグラデーション（行ごとに G = y*20）。左右いっぱいの縦帯を消すと
		// 上下辺だけで補間され、縦方向に単調変化する。
		const width = 5;
		const height = 7;
		const data: number[] = [];
		for (let y = 0; y < height; y++) {
			for (let x = 0; x < width; x++) {
				data.push(40, y * 20, 60, 255);
			}
		}
		const src: RgbaImage = { width, height, data };
		// 画像の左右いっぱい（x=0..width）を消す → 左右縁が無い。上縁 y=1、下縁 y=5。
		const rect = { x: 0, y: 2, width, height: 3 };
		const out = fillErasedRegion(src, rect);

		// 各列で上→下に G が単調増加（上縁 y=1 の G=20、下縁 y=5 の G=100）。
		for (let i = 0; i < rect.width; i++) {
			const [, tG] = outPixel(out, rect.width, i, 0);
			const [, mG] = outPixel(out, rect.width, i, 1);
			const [, bG] = outPixel(out, rect.width, i, 2);
			expect(tG).toBeLessThan(mG);
			expect(mG).toBeLessThan(bG);
			expect(tG).toBeGreaterThanOrEqual(20);
			expect(bG).toBeLessThanOrEqual(100);
		}
	});

	it("画像全体を消す（4 辺すべて欠け）ても異常な値を出さず塗る", () => {
		// 縁が 1 つも取れないケース。均等割りフォールバックで、端ピクセルの色に
		// クランプ読みされた平均が入る（クラッシュ・NaN が無いことを確認）。
		const src = solidImage(4, 4, [200, 100, 50]);
		const rect = { x: 0, y: 0, width: 4, height: 4 };
		const out = fillErasedRegion(src, rect);
		expect(out).toHaveLength(4 * 4 * 4);
		for (const v of out) {
			expect(Number.isFinite(v)).toBe(true);
			expect(v).toBeGreaterThanOrEqual(0);
			expect(v).toBeLessThanOrEqual(255);
		}
	});

	it("1px 幅・高さの領域でも安全に塗る（境界の f=0.5 扱い）", () => {
		const src = solidImage(6, 6, [10, 20, 30]);
		const out = fillErasedRegion(src, { x: 2, y: 2, width: 1, height: 1 });
		expect(out).toHaveLength(4);
		expect([out[0], out[1], out[2]]).toEqual([10, 20, 30]);
	});

	it("出力配列は領域サイズ×4 の長さ", () => {
		const src = solidImage(10, 10, [0, 0, 0]);
		const out = fillErasedRegion(src, { x: 1, y: 1, width: 5, height: 3 });
		expect(out).toHaveLength(5 * 3 * 4);
	});

	// 補間結果が縁のクランプ読みに依存しないことの確認（元画像は不変）。
	it("元画像（source）を書き換えない", () => {
		const src = solidImage(8, 8, [77, 88, 99]);
		const before = [...src.data];
		fillErasedRegion(src, { x: 2, y: 2, width: 3, height: 3 });
		expect([...src.data]).toEqual(before);
	});
});

describe("denoiseEdgeLine", () => {
	it("単発の高彩度外れ値を近傍メディアン色へ置換する", () => {
		// 一様なグレー列の中央 1 画素だけ金色（別物体）。→ グレーへ均される。
		const gray: [number, number, number] = [120, 120, 120];
		const gold: [number, number, number] = [230, 190, 40];
		const line: [number, number, number][] = [];
		for (let i = 0; i < 11; i++) line.push(i === 5 ? gold : [...gray]);
		const out = denoiseEdgeLine(line);
		// 外れ値位置はグレーに戻り、金色は残らない。
		expect(out[5]).toEqual(gray);
		// 外れ値でない画素は元のまま。
		expect(out[0]).toEqual(gray);
		expect(out[10]).toEqual(gray);
	});

	it("なだらかなグラデーション（隣接差が小さい）は置換せず追従する", () => {
		// 1 段 15 ずつの緩い増加（しきい値 48 未満）。全画素そのまま残るはず。
		const line: [number, number, number][] = [];
		for (let i = 0; i < 11; i++) line.push([i * 15, 100, 60]);
		const out = denoiseEdgeLine(line);
		expect(out).toEqual(line);
	});

	it("しきい値は妥当な正の範囲", () => {
		expect(EDGE_OUTLIER_THRESHOLD).toBeGreaterThan(0);
	});
});

describe("fillErasedRegion（縁の外れ値による筋の抑制・周長 IDW）", () => {
	// 実機で踏んだ不具合の再現構図: 消去矩形の下辺が隣の「幅の広い」高彩度物体（ベル絵文字の
	// 金色・幅 24px）にかかると、旧線形補間では金色が縦の筋（スメア）になり、メディアン除去
	// だけでも幅が窓の過半を超えるため残った。周長全体の多数派色基準の除去（denoisePerimeter）
	// ＋周長 IDW で、幅の広い物体でも筋が出ないことを分散で確認する。
	it("下辺を横切る幅広（24px）の高彩度物体が縦の筋にならない（分散が基準と同等）", () => {
		const W = 80;
		const H = 80;
		const gray: [number, number, number] = [200, 200, 205];
		// 外れ値なしの基準画像。
		const clean = solidImage(W, H, gray);
		// 外れ値あり画像: 消す矩形の「下辺のすぐ外側の行」に幅 24px の金色物体を描く。
		const dirty = solidImage(W, H, gray);
		// 消す矩形（下辺のすぐ外側の行 y=50 が縁。矩形は y=20..50）。
		const rect = { x: 20, y: 20, width: 40, height: 30 };
		const bottomEdgeRow = rect.y + rect.height; // = 50
		// 下辺の縁上、列 28..51（幅 24px）に金色の物体（ベル絵文字相当）。近傍メディアン窓
		// （13px）の過半を超える幅でも、周長全体では少数派なので denoisePerimeter で除ける。
		paintRect(dirty, 28, bottomEdgeRow, 24, 3, [235, 185, 35]);

		const outClean = fillErasedRegion(clean, rect);
		const outDirty = fillErasedRegion(dirty, rect);

		// 金色物体の中央に当たる列（source x=40 → 領域内 i=20）で縦帯の分散を比べる。
		const localI = 40 - rect.x; // = 20
		const varClean = columnVariance(outClean, rect.width, rect.height, localI);
		const varDirty = columnVariance(outDirty, rect.width, rect.height, localI);

		// 基準（単色）の縦帯はほぼ無分散。物体があっても筋が出なければ分散はごくわずかな差に
		// 収まる。旧線形補間なら金色が縦に伸びて分散が数千規模に跳ねるところを、5 未満で抑える。
		expect(varDirty).toBeLessThan(varClean + 5);
	});

	it("幅広の外れ値の色（金色）が塗り結果へ滲み出さない", () => {
		const W = 80;
		const H = 80;
		const gray: [number, number, number] = [200, 200, 205];
		const dirty = solidImage(W, H, gray);
		const rect = { x: 20, y: 20, width: 40, height: 30 };
		paintRect(dirty, 28, rect.y + rect.height, 24, 3, [235, 185, 35]);
		const out = fillErasedRegion(dirty, rect);
		// 塗り結果はグレー近傍に収まる（金色の R>G>B の偏りが出ない）。
		for (let j = 0; j < rect.height; j++) {
			for (let i = 0; i < rect.width; i++) {
				const [r, g, b] = outPixel(out, rect.width, i, j);
				// R と B の差（金色だと R が突出）が小さいこと＝金色が滲んでいない。
				expect(Math.abs(r - b)).toBeLessThan(20);
				expect(Math.abs(r - g)).toBeLessThan(20);
			}
		}
	});
});

describe("denoisePerimeter", () => {
	/** 単純な周長サンプル配列を作る（座標は 0 起点の一列。除去判定は色だけで決まる）。 */
	function samplesOf(colors: [number, number, number][]): PerimeterSample[] {
		return colors.map((color, i) => ({ x: i, y: 0, color }));
	}

	it("周長の多数派色から大きく外れた（幅広でも）サンプルを代表色へ寄せる", () => {
		const gray: [number, number, number] = [200, 200, 205];
		const gold: [number, number, number] = [235, 185, 35];
		// 20 個中 6 個が金色（少数派）。金色は幅（連続数）に依らず代表色へ置換される。
		const colors: [number, number, number][] = [];
		for (let i = 0; i < 20; i++) colors.push(i >= 7 && i < 13 ? gold : gray);
		const out = denoisePerimeter(samplesOf(colors));
		// 金色サンプルはすべてグレー近傍（代表色）へ。金色の R>G>B の偏りが消える。
		for (const s of out) {
			expect(Math.abs(s.color[0] - s.color[2])).toBeLessThan(20);
		}
	});

	it("なだらかなグラデーション（多数派色から緩やかに離れる）は潰さない", () => {
		// 周長に沿って R が 60..136 まで 4 ずつ増える緩い変化。代表色（中央値 ≈ 98）からの
		// 乖離は最大でも ~38 でしきい値 90 の内側なので、両端まで元の値が残る（レンジが保たれる）。
		const colors: [number, number, number][] = [];
		for (let i = 0; i < 20; i++) colors.push([60 + i * 4, 100, 60]);
		const out = denoisePerimeter(samplesOf(colors));
		const rs = out.map((s) => s.color[0]);
		expect(Math.min(...rs)).toBe(60);
		expect(Math.max(...rs)).toBe(136);
	});

	it("空配列はそのまま", () => {
		expect(denoisePerimeter([])).toEqual([]);
	});

	it("しきい値は EDGE_OUTLIER_THRESHOLD より緩め（グラデを守るため）", () => {
		expect(PERIMETER_OUTLIER_THRESHOLD).toBeGreaterThan(EDGE_OUTLIER_THRESHOLD);
	});
});

describe("samplePerimeter", () => {
	it("4 辺が取れる領域では周長ぶんのサンプルを返す（間引き前は 2*(W+H)）", () => {
		const src = solidImage(40, 40, [120, 130, 140]);
		const rect = { x: 10, y: 10, width: 8, height: 6 };
		const samples = samplePerimeter(src, rect);
		// 左右 = 各 height、上下 = 各 width。2*(8+6) = 28。
		expect(samples.length).toBe(2 * (8 + 6));
		// 単色なので全サンプル同色。
		for (const s of samples) expect(s.color).toEqual([120, 130, 140]);
	});

	it("画像端に接する辺は集めない（存在する縁だけ）", () => {
		const src = solidImage(20, 20, [10, 20, 30]);
		// 左上隅に密着（左辺・上辺の外側が取れない）。右辺・下辺のみ。
		const rect = { x: 0, y: 0, width: 6, height: 5 };
		const samples = samplePerimeter(src, rect);
		// 右辺 height=5 + 下辺 width=6 = 11。
		expect(samples.length).toBe(5 + 6);
	});

	it("4 辺すべて欠ける（画像全体）と空配列", () => {
		const src = solidImage(6, 6, [50, 60, 70]);
		expect(samplePerimeter(src, { x: 0, y: 0, width: 6, height: 6 })).toEqual(
			[],
		);
	});

	it("大領域では最大 MAX_PERIMETER_SAMPLES 点へ間引く", () => {
		const src = solidImage(600, 600, [0, 0, 0]);
		const rect = { x: 10, y: 10, width: 500, height: 400 };
		const samples = samplePerimeter(src, rect);
		// 生の周長 2*(500+400)=1800 → MAX_PERIMETER_SAMPLES で頭打ち。
		expect(samples.length).toBeLessThanOrEqual(MAX_PERIMETER_SAMPLES);
		expect(MAX_PERIMETER_SAMPLES).toBe(256);
	});
});

describe("computeIdwGrid", () => {
	it("全周長サンプルが同色なら、グリッド全節点もその色", () => {
		const gray: [number, number, number] = [150, 160, 170];
		const rect = { x: 0, y: 0, width: 20, height: 20 };
		const samples: PerimeterSample[] = [
			{ x: -1, y: 5, color: gray },
			{ x: 20, y: 5, color: gray },
			{ x: 5, y: -1, color: gray },
			{ x: 5, y: 20, color: gray },
		];
		const grid = computeIdwGrid(rect, samples, 4, 4);
		expect(grid).toHaveLength(16);
		for (const c of grid) {
			expect(c[0]).toBeCloseTo(150);
			expect(c[1]).toBeCloseTo(160);
			expect(c[2]).toBeCloseTo(170);
		}
	});

	it("近い縁サンプルの色へ強く寄る（べき 3 の距離減衰）", () => {
		// 左に赤・右に青の 2 点だけ。左寄りの節点は赤側、右寄りは青側へ寄る。
		const rect = { x: 0, y: 0, width: 20, height: 1 };
		const samples: PerimeterSample[] = [
			{ x: -1, y: 0, color: [255, 0, 0] },
			{ x: 20, y: 0, color: [0, 0, 255] },
		];
		const grid = computeIdwGrid(rect, samples, 5, 1);
		// 左端節点は R>B、右端節点は B>R。
		expect(grid[0]?.[0]).toBeGreaterThan(grid[0]?.[2] ?? 0);
		expect(grid[4]?.[2]).toBeGreaterThan(grid[4]?.[0] ?? 0);
	});

	it("グリッド分割数は各軸 MAX_IDW_GRID までを上限に使う想定", () => {
		expect(MAX_IDW_GRID).toBe(64);
	});
});

describe("bilinearUpscaleRgb", () => {
	it("2x2 グリッドを 3x3 へ拡大すると四隅は元の節点・中央は 4 節点の平均", () => {
		// 四隅: 黒・白・白・黒（行優先で [00,10,01,11]）。
		const grid: [number, number, number][] = [
			[0, 0, 0],
			[255, 255, 255],
			[255, 255, 255],
			[0, 0, 0],
		];
		const out = bilinearUpscaleRgb(grid, 2, 2, 3, 3);
		const px = (i: number, j: number): [number, number, number] => {
			const o = (j * 3 + i) * 4;
			return [out[o] ?? 0, out[o + 1] ?? 0, out[o + 2] ?? 0];
		};
		// 四隅は節点そのまま。
		expect(px(0, 0)).toEqual([0, 0, 0]);
		expect(px(2, 0)).toEqual([255, 255, 255]);
		expect(px(0, 2)).toEqual([255, 255, 255]);
		expect(px(2, 2)).toEqual([0, 0, 0]);
		// 中央は 4 節点平均 = 約 128。
		expect(px(1, 1)[0]).toBeGreaterThanOrEqual(127);
		expect(px(1, 1)[0]).toBeLessThanOrEqual(128);
		// alpha は不透明。
		expect(out[3]).toBe(255);
	});

	it("出力長は outW*outH*4、値は 0..255 に収まる", () => {
		const grid: [number, number, number][] = [
			[10, 20, 30],
			[40, 50, 60],
			[70, 80, 90],
			[100, 110, 120],
		];
		const out = bilinearUpscaleRgb(grid, 2, 2, 8, 6);
		expect(out).toHaveLength(8 * 6 * 4);
		for (const v of out) {
			expect(v).toBeGreaterThanOrEqual(0);
			expect(v).toBeLessThanOrEqual(255);
		}
	});
});
