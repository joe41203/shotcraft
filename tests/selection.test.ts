import { describe, expect, it } from "vitest";
import type {
	ArrowShape,
	RectShape,
	Shape,
	StepShape,
	TextShape,
} from "../lib/editor/doc";
import {
	type BBox,
	expandSelectionToGroups,
	rectsIntersect,
	shapeBoundingBox,
	shapesInBand,
} from "../lib/editor/selection";

function rect(id: string, x: number, y: number): RectShape {
	return {
		id,
		type: "rect",
		x,
		y,
		width: 20,
		height: 20,
		stroke: "#fff",
		strokeWidth: 4,
		rotation: 0,
		opacity: 1,
	};
}

function arrow(id: string, points: number[]): ArrowShape {
	return {
		id,
		type: "arrow",
		points,
		stroke: "#fff",
		strokeWidth: 4,
		rotation: 0,
		opacity: 1,
	};
}

describe("rectsIntersect", () => {
	const a: BBox = { x: 0, y: 0, width: 10, height: 10 };

	it("重なる矩形は true", () => {
		expect(rectsIntersect(a, { x: 5, y: 5, width: 10, height: 10 })).toBe(true);
	});

	it("完全に離れた矩形は false", () => {
		expect(rectsIntersect(a, { x: 100, y: 100, width: 5, height: 5 })).toBe(
			false,
		);
	});

	it("辺が接するだけでも交差とみなす", () => {
		expect(rectsIntersect(a, { x: 10, y: 0, width: 5, height: 5 })).toBe(true);
	});

	it("一方が他方を完全に包含する場合も true", () => {
		expect(rectsIntersect(a, { x: 2, y: 2, width: 3, height: 3 })).toBe(true);
	});
});

describe("shapeBoundingBox", () => {
	it("x/y/width/height を持つ図形はそのまま", () => {
		expect(shapeBoundingBox(rect("r", 10, 20))).toEqual({
			x: 10,
			y: 20,
			width: 20,
			height: 20,
		});
	});

	it("スマート消しゴム（erase）も x/y/width/height の外接矩形をそのまま返す", () => {
		const erase: Shape = {
			id: "e",
			type: "erase",
			x: 5,
			y: 15,
			width: 40,
			height: 30,
			stroke: "#fff",
			strokeWidth: 4,
			rotation: 0,
			opacity: 1,
		};
		expect(shapeBoundingBox(erase)).toEqual({
			x: 5,
			y: 15,
			width: 40,
			height: 30,
		});
	});

	it("points を持つ矢印は点列の外接矩形（負方向でも正規化）", () => {
		expect(shapeBoundingBox(arrow("a", [30, 40, 10, 5]))).toEqual({
			x: 10,
			y: 5,
			width: 20,
			height: 35,
		});
	});

	it("step は中心 ± 半径の正方形", () => {
		const step: StepShape = {
			id: "s",
			type: "step",
			x: 50,
			y: 50,
			number: 1,
			radius: 16,
			stroke: "#fff",
			strokeWidth: 4,
			rotation: 0,
			opacity: 1,
		};
		expect(shapeBoundingBox(step)).toEqual({
			x: 34,
			y: 34,
			width: 32,
			height: 32,
		});
	});

	it("text は概算の外接矩形を返す（幅・高さが正）", () => {
		const text: TextShape = {
			id: "t",
			type: "text",
			x: 0,
			y: 0,
			text: "hello\nworld!",
			fontSize: 20,
			stroke: "#fff",
			strokeWidth: 4,
			rotation: 0,
			opacity: 1,
		};
		const box = shapeBoundingBox(text);
		expect(box.x).toBe(0);
		expect(box.y).toBe(0);
		expect(box.width).toBeGreaterThan(0);
		// 2 行 × 20px × 1.2 = 48px。
		expect(box.height).toBeCloseTo(48);
	});
});

describe("shapesInBand", () => {
	const shapes: Shape[] = [
		rect("a", 0, 0),
		rect("b", 100, 100),
		arrow("c", [10, 10, 15, 15]),
	];

	it("バンドに交差する図形の id を描画順で返す", () => {
		const band: BBox = { x: -5, y: -5, width: 30, height: 30 };
		// a（0-20）と c（10-15）は交差、b（100-120）は外れる。
		expect(shapesInBand(shapes, band)).toEqual(["a", "c"]);
	});

	it("何も交差しなければ空配列", () => {
		expect(
			shapesInBand(shapes, { x: 500, y: 500, width: 10, height: 10 }),
		).toEqual([]);
	});

	it("全体を覆うバンドは全 id を返す", () => {
		expect(
			shapesInBand(shapes, { x: -10, y: -10, width: 200, height: 200 }),
		).toEqual(["a", "b", "c"]);
	});
});

describe("expandSelectionToGroups", () => {
	/** groupId 付きの矩形を作るヘルパー。 */
	function grouped(id: string, groupId?: string): RectShape {
		return { ...rect(id, 0, 0), groupId };
	}

	it("グループ所属の 1 つを選ぶと同グループ全体へ拡張する", () => {
		const shapes: Shape[] = [
			grouped("a", "g1"),
			grouped("b", "g1"),
			grouped("c"),
		];
		// a だけ選んでも b（同 g1）が加わる。c は非所属なので入らない。
		expect(expandSelectionToGroups(["a"], shapes)).toEqual(["a", "b"]);
	});

	it("非所属の図形はそのまま単独で扱う", () => {
		const shapes: Shape[] = [grouped("a"), grouped("b", "g1")];
		expect(expandSelectionToGroups(["a"], shapes)).toEqual(["a"]);
	});

	it("複数グループに触れると各グループ全体を含む（描画順）", () => {
		const shapes: Shape[] = [
			grouped("a", "g1"),
			grouped("b", "g2"),
			grouped("c", "g1"),
			grouped("d", "g2"),
			grouped("e"),
		];
		// a（g1）と d（g2）を選ぶと g1={a,c}・g2={b,d} 全員へ拡張し、doc 順で返す。
		expect(expandSelectionToGroups(["a", "d"], shapes)).toEqual([
			"a",
			"b",
			"c",
			"d",
		]);
	});

	it("選択に触れないグループ・非所属図形は加えない", () => {
		const shapes: Shape[] = [
			grouped("a", "g1"),
			grouped("b", "g1"),
			grouped("c", "g2"),
			grouped("d"),
		];
		// c(g2)・d は選択にも同グループにも触れないので入らない。
		expect(expandSelectionToGroups(["a"], shapes)).toEqual(["a", "b"]);
	});

	it("空の選択は空のまま", () => {
		const shapes: Shape[] = [grouped("a", "g1")];
		expect(expandSelectionToGroups([], shapes)).toEqual([]);
	});

	it("存在しない id は無視する", () => {
		const shapes: Shape[] = [grouped("a", "g1"), grouped("b", "g1")];
		expect(expandSelectionToGroups(["a", "zzz"], shapes)).toEqual(["a", "b"]);
	});
});
