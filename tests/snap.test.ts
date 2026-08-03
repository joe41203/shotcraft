import { describe, expect, it } from "vitest";
import type { BBox } from "../lib/editor/selection";
import { computeSnap } from "../lib/editor/snap";

/** テスト用の軸並行矩形を簡潔に作る。 */
function box(x: number, y: number, width: number, height: number): BBox {
	return { x, y, width, height };
}

describe("computeSnap", () => {
	it("しきい値内で左端どうしが近ければ x に吸着する", () => {
		// 自分 left=13、相手 left=10。差 3px（<=6）で吸着し dx=-3。
		const moving = box(13, 100, 20, 20);
		const other = box(10, 300, 40, 40);
		const result = computeSnap(moving, [other], 6);
		expect(result.dx).toBe(-3);
		expect(result.dy).toBe(0);
		expect(result.guides).toHaveLength(1);
		const guide = result.guides[0];
		expect(guide?.axis).toBe("x");
		// 整列座標は相手の left=10。
		expect(guide?.position).toBe(10);
	});

	it("しきい値を超える距離では吸着しない（dx=dy=0・ガイドなし）", () => {
		// 全ての端どうしが 6px より離れるよう相手を十分遠くに置く
		// （自分 right=120 と相手 left=200 でも 80px 離れている）。
		const moving = box(100, 100, 20, 20);
		const other = box(200, 300, 20, 20);
		const result = computeSnap(moving, [other], 6);
		expect(result.dx).toBe(0);
		expect(result.dy).toBe(0);
		expect(result.guides).toEqual([]);
	});

	it("x/y の両軸で同時に吸着すると dx/dy とも非 0・ガイド 2 本", () => {
		// 自分 left=12/top=8、相手 left=10/top=10。x は -2、y は +2 で吸着。
		const moving = box(12, 8, 20, 20);
		const other = box(10, 10, 20, 20);
		const result = computeSnap(moving, [other], 6);
		expect(result.dx).toBe(-2);
		expect(result.dy).toBe(2);
		expect(result.guides).toHaveLength(2);
		const axes = result.guides.map((g) => g.axis).sort();
		expect(axes).toEqual(["x", "y"]);
	});

	it("複数候補があるとき最も近い端へ吸着する（最近傍選択）", () => {
		// 相手 A: left=10（自分 left=15 との差 5）。相手 B: left=17（差 2）。
		// より近い B の left=17 へ吸着し dx=+2。
		const moving = box(15, 100, 20, 20);
		const a = box(10, 300, 20, 20);
		const b = box(17, 400, 20, 20);
		const result = computeSnap(moving, [a, b], 6);
		expect(result.dx).toBe(2);
		expect(result.guides[0]?.position).toBe(17);
	});

	it("中央どうしの整列にも吸着する（centerX）", () => {
		// 自分の各端 [20,30,40]、相手の各端 [22,32,42]（left=22,width=20）。
		// left どうし・center どうし・right どうしがいずれも +2 のずれで並ぶ。
		// 同ずれ（+2）が複数あるときは先に見つかる left どうしを採るため dx=+2、
		// ガイドは相手 left=22 に立つ（最近傍が同点なら安定して先勝ち）。
		const moving = box(20, 100, 20, 20);
		const other = box(22, 300, 20, 20);
		const result = computeSnap(moving, [other], 6);
		expect(result.dx).toBe(2);
		expect(result.guides[0]?.position).toBe(22);
	});

	it("自分の右端が相手の左端に吸着する（辺どうしの隣接整列）", () => {
		// 自分 right=100+20=120 の左上 x=100,width=20。相手 left=123。差 3 → dx=+3。
		const moving = box(100, 100, 20, 20);
		const other = box(123, 300, 40, 40);
		const result = computeSnap(moving, [other], 6);
		expect(result.dx).toBe(3);
		// right が相手 left=123 に揃う → ガイド縦線は x=123。
		expect(result.guides[0]?.position).toBe(123);
	});

	it("ガイド線の区間は自分と相手の両ボックスを覆う（縦線は y、横線は x）", () => {
		// x 吸着のみ。自分 y=100..120、相手 y=300..340 → 区間 100..340。
		const moving = box(13, 100, 20, 20);
		const other = box(10, 300, 40, 40);
		const result = computeSnap(moving, [other], 6);
		const guide = result.guides[0];
		expect(guide?.axis).toBe("x");
		expect(guide?.from).toBe(100);
		expect(guide?.to).toBe(340);
	});

	it("otherBoxes が空なら吸着しない", () => {
		const result = computeSnap(box(0, 0, 10, 10), [], 6);
		expect(result).toEqual({ dx: 0, dy: 0, guides: [] });
	});

	it("しきい値ちょうど（境界）は吸着する", () => {
		// 全ての端どうしがちょうど 6px 離れる配置（自分 [6,56,106]・相手 [0,50,100]）。
		// 最近傍の候補が 6px ちょうどでも吸着する（<= 判定）→ dx=-6。
		const moving = box(6, 100, 100, 100);
		const other = box(0, 300, 100, 100);
		const result = computeSnap(moving, [other], 6);
		expect(result.dx).toBe(-6);
	});
});
