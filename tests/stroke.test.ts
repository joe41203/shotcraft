import { describe, expect, it } from "vitest";
import { STROKE_MIN_POINT_DISTANCE, thinPoints } from "../lib/editor/stroke";

describe("thinPoints", () => {
	it("しきい値未満で密に並んだ点を間引く（先頭と末尾は残す）", () => {
		// x=0,1,2,3,4（間隔 1px < 2.5px）。先頭(0)と末尾(4)は残り、間は落ちる。
		const pts = [0, 0, 1, 0, 2, 0, 3, 0, 4, 0];
		const out = thinPoints(pts, 2.5);
		expect(out.slice(0, 2)).toEqual([0, 0]);
		expect(out.slice(-2)).toEqual([4, 0]);
		expect(out.length).toBeLessThan(pts.length);
	});

	it("しきい値以上離れた点は全て残す", () => {
		const pts = [0, 0, 10, 0, 20, 0];
		expect(thinPoints(pts, 2.5)).toEqual(pts);
	});

	it("末尾点は必ず残る（指を止めた位置まで線が届く）", () => {
		// 0 と 2（<2.5）だが 2 は末尾なので残す。
		const out = thinPoints([0, 0, 2, 0], 2.5);
		expect(out).toEqual([0, 0, 2, 0]);
	});

	it("minDist=0 は間引かない（そのまま返す）", () => {
		const pts = [0, 0, 1, 0, 2, 0];
		expect(thinPoints(pts, 0)).toEqual(pts);
	});

	it("点が 1 個以下（長さ 2 以下）はそのまま返す", () => {
		expect(thinPoints([5, 6], 2.5)).toEqual([5, 6]);
		expect(thinPoints([], 2.5)).toEqual([]);
	});

	it("入力配列を破壊しない", () => {
		const pts = [0, 0, 1, 0, 2, 0, 10, 0];
		const copy = [...pts];
		thinPoints(pts, 2.5);
		expect(pts).toEqual(copy);
	});

	it("既定しきい値でも動作する", () => {
		const out = thinPoints([0, 0, 100, 100], STROKE_MIN_POINT_DISTANCE);
		expect(out).toEqual([0, 0, 100, 100]);
	});
});
