import { describe, expect, it } from "vitest";
import {
	clampScale,
	fitTransform,
	MAX_SCALE,
	MIN_SCALE,
	zoomAtTransform,
} from "../entrypoints/editor/geometry-view";

describe("clampScale", () => {
	it("下限・上限でクランプする", () => {
		expect(clampScale(0.001)).toBe(MIN_SCALE);
		expect(clampScale(1000)).toBe(MAX_SCALE);
		expect(clampScale(1)).toBe(1);
	});
});

describe("fitTransform", () => {
	it("コンテナに収まる小さい画像は拡大せず中央寄せする（scale=1）", () => {
		// container 1000x800, content 400x300, padding 24 → 余裕あり
		const t = fitTransform(
			{ width: 1000, height: 800 },
			{ width: 400, height: 300 },
		);
		expect(t.scale).toBe(1);
		expect(t.x).toBe((1000 - 400) / 2);
		expect(t.y).toBe((800 - 300) / 2);
	});

	it("原寸で収まる画像は余白を理由に縮小せず 100% で表示する", () => {
		// container 1280x720, content 1280x680（幅はコンテナと同じ・原寸で収まる）
		// パディングを差し引くと幅が足りないが、原寸で収まるので scale=1 を維持する
		const t = fitTransform(
			{ width: 1280, height: 720 },
			{ width: 1280, height: 680 },
		);
		expect(t.scale).toBe(1);
		expect(t.x).toBe(0);
		expect(t.y).toBe((720 - 680) / 2);
	});

	it("大きい画像は縦横比を保って縮小しつつ中央寄せする", () => {
		// container 500x500(padding込みで452有効), content 904x452 → 幅で決まる
		const t = fitTransform(
			{ width: 500, height: 500 },
			{ width: 904, height: 452 },
		);
		// scaleX=(500-48)/904=0.5, scaleY=(500-48)/452=1.0 → min=0.5
		expect(t.scale).toBeCloseTo(0.5, 5);
		expect(t.x).toBeCloseTo((500 - 904 * 0.5) / 2, 5);
	});

	it("コンテンツが 0 サイズでも例外を投げず等倍を返す", () => {
		const t = fitTransform(
			{ width: 500, height: 500 },
			{ width: 0, height: 0 },
		);
		expect(t).toEqual({ scale: 1, x: 0, y: 0 });
	});

	it("コンテナが極端に小さいと最小スケールにクランプする", () => {
		const t = fitTransform(
			{ width: 10, height: 10 },
			{ width: 800, height: 500 },
		);
		expect(t.scale).toBe(MIN_SCALE);
	});
});

describe("zoomAtTransform", () => {
	it("ピボット直下のドキュメント点が画面上で動かない", () => {
		const current = { scale: 1, x: 0, y: 0 };
		const pivot = { x: 200, y: 150 };
		// ピボット直下のドキュメント座標
		const docBefore = {
			x: (pivot.x - current.x) / current.scale,
			y: (pivot.y - current.y) / current.scale,
		};
		const next = zoomAtTransform(current, pivot, 2);
		// 新スケールでの同じドキュメント点の画面位置
		const screenAfter = {
			x: next.x + docBefore.x * next.scale,
			y: next.y + docBefore.y * next.scale,
		};
		expect(screenAfter.x).toBeCloseTo(pivot.x, 5);
		expect(screenAfter.y).toBeCloseTo(pivot.y, 5);
		expect(next.scale).toBe(2);
	});

	it("スケールは上限・下限でクランプされる", () => {
		const current = { scale: 4, x: 0, y: 0 };
		const next = zoomAtTransform(current, { x: 0, y: 0 }, 100);
		expect(next.scale).toBe(MAX_SCALE);
	});
});
